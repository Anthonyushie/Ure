import { NotFoundError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";
import { tradeAccountReference } from "@/server/trade-service";

/**
 * Full admin view of a trade: the trade with all related records, plus the
 * webhook events and jobs linked to it (webhooks are not FK-related to trades,
 * so we correlate by account reference / trade id in the payload).
 */
export async function getAdminTradeView(tradeId: string) {
  const prisma = getPrisma();

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: {
      seller: true,
      buyer: true,
      sellerBankAccount: true,
      virtualAccount: true,
      escrowLock: true,
      fiatTransactions: { orderBy: { createdAt: "desc" } },
      payouts: { orderBy: { createdAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!trade) {
    throw new NotFoundError("Trade");
  }

  const accountReference = tradeAccountReference(tradeId);

  const [webhookEvents, jobs] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: {
        OR: [
          { rawPayload: { path: ["data", "reference"], equals: accountReference } },
          { rawPayload: { path: ["data", "merchantTxRef"], equals: `ure-payout-${tradeId}` } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.job.findMany({
      where: {
        OR: [
          { payload: { path: ["tradeId"], equals: tradeId } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return { trade, webhookEvents, jobs };
}
