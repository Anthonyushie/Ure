import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { nairaToKobo } from "@/lib/money";
import { getNombaClient, mapNombaEventType } from "@/lib/nomba";
import { transitionTradeStatusInTx } from "@/server/trade-service";
import { JOB_TYPES, enqueueJob } from "@/server/jobs/queue";

export type PaymentOutcome =
  | "EXACT"
  | "UNDERPAID"
  | "OVERPAID"
  | "WRONG_CURRENCY"
  | "NOT_SUCCESSFUL";

/**
 * Pure decision: is fiat secured? MVP is exact-payment only, so anything that
 * is not an exact NGN success is rejected (spec §1.1, §13 money safety). Kept
 * pure so the rejection rules are unit-testable without a provider.
 */
export function evaluateFiatPayment(input: {
  authoritativeAmountMinor: bigint;
  expectedAmountMinor: bigint;
  currency: string;
  providerStatus: "SUCCESS" | "PENDING" | "FAILED";
}): { secured: boolean; outcome: PaymentOutcome } {
  if (input.providerStatus !== "SUCCESS") {
    return { secured: false, outcome: "NOT_SUCCESSFUL" };
  }
  if (input.currency !== "NGN") {
    return { secured: false, outcome: "WRONG_CURRENCY" };
  }
  if (input.authoritativeAmountMinor < input.expectedAmountMinor) {
    return { secured: false, outcome: "UNDERPAID" };
  }
  if (input.authoritativeAmountMinor > input.expectedAmountMinor) {
    return { secured: false, outcome: "OVERPAID" };
  }
  return { secured: true, outcome: "EXACT" };
}

type ParsedPaymentWebhook = {
  eventType: string;
  providerTransactionId: string | null;
  accountReference: string | null;
  /** Virtual-account (VNUBAN) number the payment landed in — real Nomba maps by this. */
  aliasAccountNumber: string | null;
  /** Converted from Nomba's Naira amount to our internal kobo. */
  reportedAmountMinor: bigint;
  currency: string;
  payerName: string | null;
};

/**
 * Normalize a Nomba payment webhook payload. Real Nomba nests transaction data
 * under `data.transaction` and reports amounts in Naira; the mock uses a flat
 * `data` shape. This tolerates both. Amounts are converted Naira → kobo here so
 * the rest of the system stays in minor units.
 */
export function parsePaymentWebhook(payload: unknown): ParsedPaymentWebhook {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const txn = ((data.transaction ?? data) ?? {}) as Record<string, unknown>;

  const amountRaw = txn.amount ?? data.amount ?? "0";

  return {
    eventType: String(root.event_type ?? root.eventType ?? root.type ?? ""),
    providerTransactionId:
      (txn.transactionId as string) ??
      (txn.id as string) ??
      (data.id as string) ??
      null,
    accountReference:
      (data.accountRef as string) ??
      (data.reference as string) ??
      (txn.accountRef as string) ??
      null,
    aliasAccountNumber:
      (txn.aliasAccountNumber as string) ??
      (data.aliasAccountNumber as string) ??
      null,
    reportedAmountMinor: nairaToKobo(amountRaw as string | number),
    currency: String(txn.currency ?? data.currency ?? "NGN"),
    payerName:
      (txn.payerName as string) ??
      (data.payerName as string) ??
      (data.payer as string) ??
      null,
  };
}

/**
 * Process a stored payment webhook event: requery the provider, decide whether
 * fiat is secured, and (only if exact) move the trade to FIAT_SECURED and
 * enqueue crypto release. Idempotent: a webhook already PROCESSED/IGNORED is a
 * no-op, and the FiatTransaction unique constraint blocks double-counting.
 */
export async function processPaymentWebhookEvent(
  webhookEventId: string,
): Promise<void> {
  const prisma = getPrisma();

  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
  });
  if (!event || event.status !== "RECEIVED") {
    return; // unknown or already handled
  }

  const parsed = parsePaymentWebhook(event.rawPayload);

  if (mapNombaEventType(parsed.eventType) !== "PAYMENT_SUCCESS") {
    await markWebhook(event.id, "IGNORED", "Not a payment_success event.");
    return;
  }

  if (!parsed.accountReference && !parsed.aliasAccountNumber) {
    await markWebhook(
      event.id,
      "FAILED",
      "Webhook missing account reference and account number.",
    );
    return;
  }

  // Map to a trade by our accountReference, or by the VNUBAN Nomba paid into.
  const virtualAccount = await prisma.virtualAccount.findFirst({
    where: {
      OR: [
        parsed.accountReference
          ? { accountReference: parsed.accountReference }
          : undefined,
        parsed.aliasAccountNumber
          ? { accountNumber: parsed.aliasAccountNumber }
          : undefined,
      ].filter(Boolean) as Prisma.VirtualAccountWhereInput[],
    },
    include: { trade: true },
  });

  if (!virtualAccount) {
    await markWebhook(event.id, "IGNORED", "No trade matches this payment.");
    return;
  }

  const trade = virtualAccount.trade;
  if (trade.status !== "AWAITING_FIAT") {
    await markWebhook(
      event.id,
      "IGNORED",
      `Trade ${trade.id} is not awaiting fiat (status ${trade.status}).`,
    );
    return;
  }

  // Reconcile before release: requery the provider for the authoritative
  // transaction. The mock returns amount 0 (no independent source) → fall back
  // to the webhook-reported amount; a real provider returns the true amount.
  const nomba = getNombaClient();
  const requeried = await nomba.fetchTransactionByReference(
    virtualAccount.accountReference,
  );
  const providerStatus = requeried?.status ?? "PENDING";
  const authoritativeAmountMinor =
    requeried && requeried.amountMinor > 0n
      ? requeried.amountMinor
      : parsed.reportedAmountMinor;

  const decision = evaluateFiatPayment({
    authoritativeAmountMinor,
    expectedAmountMinor: virtualAccount.expectedAmountMinor,
    currency: parsed.currency,
    providerStatus,
  });

  if (!decision.secured) {
    // Record the receipt but do NOT secure the trade (exact-payment MVP).
    await prisma.$transaction(async (tx) => {
      await upsertFiatTransaction(tx, {
        tradeId: trade.id,
        providerTransactionId: parsed.providerTransactionId,
        accountReference: parsed.accountReference,
        amountMinor: authoritativeAmountMinor,
        status: "IGNORED",
        providerStatus: decision.outcome,
        payerName: parsed.payerName,
        rawPayload: event.rawPayload,
      });
      await markWebhookTx(
        tx,
        event.id,
        "PROCESSED",
        `Payment not secured: ${decision.outcome}.`,
      );
    });
    return;
  }

  // Exact payment: secure fiat and enqueue crypto release, atomically.
  await prisma.$transaction(async (tx) => {
    await upsertFiatTransaction(tx, {
      tradeId: trade.id,
      providerTransactionId: parsed.providerTransactionId,
      accountReference: parsed.accountReference,
      amountMinor: authoritativeAmountMinor,
      status: "CONFIRMED",
      providerStatus: "SUCCESS",
      payerName: parsed.payerName,
      rawPayload: event.rawPayload,
    });

    await tx.trade.update({
      where: { id: trade.id },
      data: { fiatReceivedMinor: authoritativeAmountMinor },
    });

    await transitionTradeStatusInTx(tx, {
      tradeId: trade.id,
      to: "FIAT_SECURED",
      actorType: "SYSTEM",
      metadata: {
        outcome: decision.outcome,
        amountMinor: authoritativeAmountMinor.toString(),
      },
    });

    await enqueueJob(tx, {
      type: JOB_TYPES.RELEASE_CRYPTO,
      payload: { tradeId: trade.id },
    });

    await markWebhookTx(tx, event.id, "PROCESSED", null);
  });
}

async function upsertFiatTransaction(
  tx: Prisma.TransactionClient,
  input: {
    tradeId: string;
    providerTransactionId: string | null;
    accountReference: string | null;
    amountMinor: bigint;
    status: "RECEIVED" | "CONFIRMED" | "IGNORED" | "REVERSED" | "FAILED";
    providerStatus: string;
    payerName: string | null;
    rawPayload: Prisma.JsonValue;
  },
) {
  // Idempotency: skip if we already recorded this provider transaction.
  if (input.providerTransactionId) {
    const existing = await tx.fiatTransaction.findUnique({
      where: { providerTransactionId: input.providerTransactionId },
    });
    if (existing) {
      return existing;
    }
  }

  return tx.fiatTransaction.create({
    data: {
      tradeId: input.tradeId,
      providerTransactionId: input.providerTransactionId,
      accountReference: input.accountReference,
      amountMinor: input.amountMinor,
      status: input.status,
      providerStatus: input.providerStatus,
      payerName: input.payerName,
      confirmedAt: input.status === "CONFIRMED" ? new Date() : null,
      receivedAt: new Date(),
      rawProviderPayload: input.rawPayload as Prisma.InputJsonValue,
    },
  });
}

async function markWebhook(
  id: string,
  status: "PROCESSED" | "IGNORED" | "FAILED",
  errorMessage: string | null,
) {
  await getPrisma().webhookEvent.update({
    where: { id },
    data: { status, errorMessage, processedAt: new Date() },
  });
}

async function markWebhookTx(
  tx: Prisma.TransactionClient,
  id: string,
  status: "PROCESSED" | "IGNORED" | "FAILED",
  errorMessage: string | null,
) {
  await tx.webhookEvent.update({
    where: { id },
    data: { status, errorMessage, processedAt: new Date() },
  });
}
