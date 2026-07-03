import { apiError, parseJsonBody } from "@/lib/api";
import { acceptTradeSchema } from "@/lib/validation";
import { acceptTrade } from "@/server/trade-service";

export async function POST(request: Request) {
  try {
    acceptTradeSchema.parse(await parseJsonBody(request));
    await acceptTrade();
  } catch (error) {
    return apiError(error);
  }
}
