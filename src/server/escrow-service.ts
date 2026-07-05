import { AppError, NotFoundError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";
import { isStacksConfigured, mockTxId } from "@/lib/stacks";
import { transitionTradeStatusInTx } from "@/server/trade-service";
import { JOB_TYPES, enqueueJob } from "@/server/jobs/queue";

/**
 * Submit the crypto release for a fiat-secured trade. In mock mode the release
 * tx id is synthetic and confirmed by a follow-up job; in live mode this is
 * where the oracle contract-call goes (Phase D).
 *
 * TODO(stacks-testnet): replace mock tx id with a real oracle makeContractCall
 * to the escrow `release` function and broadcast.
 */
export async function releaseEscrow(tradeId: string): Promise<void> {
  const prisma = getPrisma();

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { escrowLock: true, buyer: true },
  });

  if (!trade) {
    throw new NotFoundError("Trade");
  }
  if (trade.status !== "FIAT_SECURED") {
    // Idempotent: already past release.
    if (
      trade.status === "RELEASING_CRYPTO" ||
      trade.status === "CRYPTO_RELEASED" ||
      trade.status === "PAYOUT_PENDING" ||
      trade.status === "COMPLETED"
    ) {
      return;
    }
    throw new AppError(
      "RELEASE_NOT_ALLOWED",
      `Cannot release crypto while trade is ${trade.status}.`,
      409,
    );
  }
  if (!trade.escrowLock) {
    throw new AppError("NO_ESCROW_LOCK", "Trade has no escrow lock.", 409);
  }

  if (isStacksConfigured()) {
    // TODO(stacks-testnet): build + broadcast the oracle release tx here.
    throw new AppError(
      "STACKS_RELEASE_NOT_IMPLEMENTED",
      "Live Stacks release is not implemented yet.",
      501,
    );
  }

  const releaseTxId = mockTxId("release", tradeId);

  await prisma.$transaction(async (tx) => {
    await tx.escrowLock.update({
      where: { tradeId },
      data: {
        status: "RELEASE_PENDING",
        releaseTxId,
        buyerAddress: trade.buyer?.walletAddress ?? null,
        rawReleasePayload: { integration: "stacks", phase: "mock", releaseTxId },
      },
    });

    await transitionTradeStatusInTx(tx, {
      tradeId,
      to: "RELEASING_CRYPTO",
      actorType: "SYSTEM",
      metadata: { releaseTxId },
    });

    await enqueueJob(tx, {
      type: JOB_TYPES.CONFIRM_CRYPTO_RELEASE,
      payload: { tradeId },
    });
  });
}

/**
 * Confirm the release transaction on-chain. Mock mode confirms immediately;
 * live mode would poll the Stacks API for tx confirmation before proceeding.
 */
export async function confirmCryptoRelease(tradeId: string): Promise<void> {
  const prisma = getPrisma();

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { escrowLock: true },
  });

  if (!trade) {
    throw new NotFoundError("Trade");
  }
  if (trade.status !== "RELEASING_CRYPTO") {
    if (
      trade.status === "CRYPTO_RELEASED" ||
      trade.status === "PAYOUT_PENDING" ||
      trade.status === "COMPLETED"
    ) {
      return; // idempotent
    }
    throw new AppError(
      "CONFIRM_RELEASE_NOT_ALLOWED",
      `Cannot confirm release while trade is ${trade.status}.`,
      409,
    );
  }

  // TODO(stacks-testnet): poll Stacks API for release tx confirmation.

  await prisma.$transaction(async (tx) => {
    await tx.escrowLock.update({
      where: { tradeId },
      data: { status: "RELEASE_CONFIRMED", confirmations: 1 },
    });

    await transitionTradeStatusInTx(tx, {
      tradeId,
      to: "CRYPTO_RELEASED",
      actorType: "SYSTEM",
      metadata: { releaseConfirmed: true },
    });

    await enqueueJob(tx, {
      type: JOB_TYPES.INITIATE_SELLER_PAYOUT,
      payload: { tradeId },
    });
  });
}
