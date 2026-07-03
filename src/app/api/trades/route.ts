import { apiError, apiSuccess, parseJsonBody } from "@/lib/api";
import { createTradeSchema, listTradesQuerySchema } from "@/lib/validation";
import { createTrade, listTrades } from "@/server/trade-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = listTradesQuerySchema.parse(
      Object.fromEntries(searchParams.entries()),
    );
    const trades = await listTrades(query);

    return apiSuccess(trades);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createTradeSchema.parse(await parseJsonBody(request));
    const trade = await createTrade(body);

    return apiSuccess(
      {
        tradeId: trade.id,
        status: trade.status,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
