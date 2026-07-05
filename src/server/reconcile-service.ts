import { getPrisma } from "@/lib/prisma";
import { confirmCryptoRelease, releaseEscrow } from "@/server/escrow-service";
import { confirmPayout, initiateSellerPayout } from "@/server/payout-service";

/**
 * Re-drive a single trade that appears stuck in an intermediate state. Each
 * downstream call is idempotent, so re-driving is safe. This is the recovery
 * path for trades whose forward job was lost or crashed.
 */
export async function reconcileStaleTrade(tradeId: string): Promise<void> {
  const prisma = getPrisma();
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { payouts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!trade) {
    return;
  }

  switch (trade.status) {
    case "FIAT_SECURED":
      await releaseEscrow(tradeId);
      break;
    case "RELEASING_CRYPTO":
      await confirmCryptoRelease(tradeId);
      break;
    case "CRYPTO_RELEASED":
      await initiateSellerPayout(tradeId);
      break;
    case "PAYOUT_PENDING":
      if (trade.payouts[0]) {
        await confirmPayout(trade.payouts[0].id);
      }
      break;
    default:
      // AWAITING_FIAT / terminal states: nothing to re-drive here.
      break;
  }
}

const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Nightly-style sweep: find trades stuck in a non-terminal automated state and
 * re-drive them. Returns the ids it re-drove.
 */
export async function sweepStaleTrades(now = new Date()): Promise<string[]> {
  const prisma = getPrisma();
  const cutoff = new Date(now.getTime() - STALE_AFTER_MS);

  const stuck = await prisma.trade.findMany({
    where: {
      status: {
        in: ["FIAT_SECURED", "RELEASING_CRYPTO", "CRYPTO_RELEASED", "PAYOUT_PENDING"],
      },
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
    take: 100,
  });

  for (const trade of stuck) {
    await reconcileStaleTrade(trade.id);
  }

  return stuck.map((t) => t.id);
}
