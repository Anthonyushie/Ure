import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = requireAdminRequest(request);

    return apiSuccess({
      status: "admin-ok",
      walletAddress: session.walletAddress,
    });
  } catch (error) {
    return apiError(error);
  }
}
