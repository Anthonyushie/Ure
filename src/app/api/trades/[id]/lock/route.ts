import { apiError, apiSuccess, parseJsonBody } from "@/lib/api";
import { recordLockTransactionSchema } from "@/lib/validation";
import { recordLockTransaction } from "@/server/trade-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = recordLockTransactionSchema.parse(await parseJsonBody(request));
    const trade = await recordLockTransaction({
      tradeId: id,
      sellerWalletAddress: body.sellerWalletAddress,
      lockTxId: body.lockTxId,
    });

    return apiSuccess({
      tradeId: trade.id,
      status: trade.status,
      escrowStatus: trade.escrowLock?.status,
      lockTxId: trade.escrowLock?.lockTxId,
    });
  } catch (error) {
    return apiError(error);
  }
}
