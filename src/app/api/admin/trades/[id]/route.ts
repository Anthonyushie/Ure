import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminRequest } from "@/lib/auth";
import { getAdminTradeView } from "@/server/admin-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireAdminRequest(request);
    const { id } = await context.params;
    const view = await getAdminTradeView(id);
    return apiSuccess(view);
  } catch (error) {
    return apiError(error);
  }
}
