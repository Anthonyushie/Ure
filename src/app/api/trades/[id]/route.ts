import { apiError, apiSuccess } from "@/lib/api";
import { getTradeDetail } from "@/server/trade-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const trade = await getTradeDetail(id);

    return apiSuccess(trade);
  } catch (error) {
    return apiError(error);
  }
}
