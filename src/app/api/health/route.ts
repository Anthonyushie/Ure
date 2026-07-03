import { apiSuccess } from "@/lib/api";

export async function GET() {
  return apiSuccess({ status: "healthy" });
}
