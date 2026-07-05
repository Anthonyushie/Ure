import { apiError, apiSuccess, parseJsonBody } from "@/lib/api";
import { acceptTradeSchema } from "@/lib/validation";
import { acceptTrade } from "@/server/trade-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = acceptTradeSchema.parse(await parseJsonBody(request));
    const trade = await acceptTrade({
      tradeId: id,
      buyerWalletAddress: body.buyerWalletAddress,
    });

    return apiSuccess({
      tradeId: trade.id,
      status: trade.status,
      payment: trade.virtualAccount
        ? {
            accountNumber: trade.virtualAccount.accountNumber,
            bankName: trade.virtualAccount.bankName,
            accountName: trade.virtualAccount.accountName,
            accountReference: trade.virtualAccount.accountReference,
            amountMinor: trade.virtualAccount.expectedAmountMinor,
            currency: trade.virtualAccount.currency,
            expiresAt: trade.virtualAccount.expiresAt,
          }
        : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
