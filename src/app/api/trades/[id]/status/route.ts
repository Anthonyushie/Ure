import { apiError, apiSuccess } from "@/lib/api";
import { getTradeStatus } from "@/server/trade-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const status = await getTradeStatus(id);

    return apiSuccess(status);
  } catch (error) {
    return apiError(error);
  }
}
