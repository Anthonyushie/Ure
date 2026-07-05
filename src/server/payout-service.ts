import type { Prisma } from "@/generated/prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";
import {
  getNombaClient,
  mapNombaEventType,
  payoutIdempotencyKey,
} from "@/lib/nomba";
import { transitionTradeStatusInTx } from "@/server/trade-service";
import { JOB_TYPES, enqueueJob } from "@/server/jobs/queue";

export function payoutMerchantTxRef(tradeId: string): string {
  return `ure-payout-${tradeId}`;
}

type PayoutDestination = {
  bankAccountId: string | null;
  bankCode: string;
  accountNumber: string;
  accountName: string;
};

/**
 * Resolve where to send the seller's fiat. Uses the seller's verified bank
 * account when the trade has one; otherwise falls back to a mock destination so
 * the demo loop can complete.
 * TODO(nomba-sandbox): require a verified bank account in production and run a
 * Nomba account-name lookup before transferring.
 */
async function resolvePayoutDestination(
  tx: Prisma.TransactionClient,
  trade: { sellerBankAccountId: string | null; sellerId: string },
): Promise<PayoutDestination> {
  if (trade.sellerBankAccountId) {
    const bank = await tx.bankAccount.findUnique({
      where: { id: trade.sellerBankAccountId },
    });
    if (bank) {
      return {
        bankAccountId: bank.id,
        bankCode: bank.bankCode,
        accountNumber: bank.accountNumber,
        accountName: bank.accountName,
      };
    }
  }
  return {
    bankAccountId: null,
    bankCode: "000",
    accountNumber: "0000000000",
    accountName: "URE MOCK SELLER PAYOUT",
  };
}

/**
 * Create (idempotently) and submit the seller payout for a released trade.
 * The Payout is keyed by a unique merchantTxRef per trade, so a retry reuses
 * the same record and the transfer call carries a stable idempotency key.
 */
export async function initiateSellerPayout(tradeId: string): Promise<void> {
  const prisma = getPrisma();

  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) {
    throw new NotFoundError("Trade");
  }
  if (trade.status !== "CRYPTO_RELEASED") {
    if (trade.status === "PAYOUT_PENDING" || trade.status === "COMPLETED") {
      return; // idempotent
    }
    throw new AppError(
      "PAYOUT_NOT_ALLOWED",
      `Cannot start payout while trade is ${trade.status}.`,
      409,
    );
  }

  const merchantTxRef = payoutMerchantTxRef(tradeId);

  // Create-or-get the payout row and move to PAYOUT_PENDING atomically.
  const payout = await prisma.$transaction(async (tx) => {
    const existing = await tx.payout.findUnique({ where: { merchantTxRef } });
    if (existing) {
      return existing;
    }

    const dest = await resolvePayoutDestination(tx, trade);
    const created = await tx.payout.create({
      data: {
        tradeId,
        sellerId: trade.sellerId,
        bankAccountId: dest.bankAccountId,
        merchantTxRef,
        idempotencyKey: payoutIdempotencyKey(tradeId, merchantTxRef),
        amountMinor: trade.fiatExpectedMinor,
        status: "PENDING",
        initiatedAt: new Date(),
      },
    });

    await transitionTradeStatusInTx(tx, {
      tradeId,
      to: "PAYOUT_PENDING",
      actorType: "SYSTEM",
      metadata: { merchantTxRef },
    });

    return created;
  });

  if (payout.status === "SUCCESS") {
    return;
  }

  // Call the provider transfer API (outside the DB transaction).
  const nomba = getNombaClient();
  const dest = await resolvePayoutDestination(prisma, trade);
  const result = await nomba.initiateTransfer({
    merchantTxRef,
    idempotencyKey: payout.idempotencyKey,
    amountMinor: trade.fiatExpectedMinor,
    bankCode: dest.bankCode,
    accountNumber: dest.accountNumber,
    accountName: dest.accountName,
  });

  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      status: "PROCESSING",
      providerTransferId: result.providerTransferId,
      providerStatus: result.status,
      rawProviderPayload: result.raw as Prisma.InputJsonValue,
    },
  });

  // Confirm via a follow-up job (mirrors the real payout-webhook flow).
  await prisma.$transaction(async (tx) => {
    await enqueueJob(tx, {
      type: JOB_TYPES.PROCESS_PAYOUT_WEBHOOK,
      payload: { payoutId: payout.id },
    });
  });
}

/**
 * Confirm a payout by requerying the provider. Success completes the trade;
 * failure moves it to review. Idempotent on terminal trade states.
 */
export async function confirmPayout(payoutId: string): Promise<void> {
  const prisma = getPrisma();

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { trade: true },
  });
  if (!payout) {
    throw new NotFoundError("Payout");
  }
  if (payout.trade.status === "COMPLETED") {
    return;
  }

  const nomba = getNombaClient();
  const transfer = await nomba.fetchTransfer(payout.merchantTxRef);
  const status = transfer?.status ?? "PENDING";

  if (status === "SUCCESS") {
    await prisma.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: payout.id },
        data: {
          status: "SUCCESS",
          providerStatus: status,
          completedAt: new Date(),
        },
      });
      await transitionTradeStatusInTx(tx, {
        tradeId: payout.tradeId,
        to: "COMPLETED",
        actorType: "SYSTEM",
        metadata: { payoutId: payout.id, merchantTxRef: payout.merchantTxRef },
      });
    });
    return;
  }

  if (status === "FAILED") {
    await prisma.$transaction(async (tx) => {
      await tx.payout.update({
        where: { id: payout.id },
        data: { status: "FAILED", providerStatus: status, failureReason: "Provider reported failure." },
      });
      await transitionTradeStatusInTx(tx, {
        tradeId: payout.tradeId,
        to: "FAILED_NEEDS_REVIEW",
        actorType: "SYSTEM",
        metadata: { payoutId: payout.id, reason: "payout_failed" },
      });
    });
    return;
  }

  // Still pending — throw so the job retries with backoff.
  throw new AppError("PAYOUT_PENDING", "Payout still pending confirmation.", 409);
}

type ParsedPayoutWebhook = {
  eventType: string;
  merchantTxRef: string | null;
  providerTransferId: string | null;
};

/** Tolerates both the mock flat shape and real Nomba's data.transaction nesting. */
export function parsePayoutWebhook(payload: unknown): ParsedPayoutWebhook {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const txn = ((data.transaction ?? data) ?? {}) as Record<string, unknown>;
  return {
    eventType: String(root.event_type ?? root.eventType ?? root.type ?? ""),
    merchantTxRef:
      (txn.merchantTxRef as string) ??
      (data.merchantTxRef as string) ??
      (data.reference as string) ??
      null,
    providerTransferId:
      (txn.transactionId as string) ??
      (data.id as string) ??
      (data.transferId as string) ??
      null,
  };
}

export async function processPayoutWebhookEvent(
  webhookEventId: string,
): Promise<void> {
  const prisma = getPrisma();
  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
  });
  if (!event || event.status !== "RECEIVED") {
    return;
  }

  const parsed = parsePayoutWebhook(event.rawPayload);
  const internal = mapNombaEventType(parsed.eventType);
  if (internal !== "PAYOUT_SUCCESS" && internal !== "PAYOUT_FAILED") {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "IGNORED", processedAt: new Date() },
    });
    return;
  }

  if (!parsed.merchantTxRef) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", errorMessage: "Missing merchantTxRef.", processedAt: new Date() },
    });
    return;
  }

  const payout = await prisma.payout.findUnique({
    where: { merchantTxRef: parsed.merchantTxRef },
  });
  if (!payout) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "IGNORED", errorMessage: "No payout for merchantTxRef.", processedAt: new Date() },
    });
    return;
  }

  await confirmPayout(payout.id);
  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: { status: "PROCESSED", processedAt: new Date() },
  });
}
