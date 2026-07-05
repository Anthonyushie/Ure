import { apiError, apiSuccess, parseJsonBody } from "@/lib/api";
import { authNonceSchema } from "@/lib/validation";
import { createAuthChallenge } from "@/server/auth-service";

export async function POST(request: Request) {
  try {
    const body = authNonceSchema.parse(await parseJsonBody(request));
    const challenge = await createAuthChallenge(body.walletAddress);

    return apiSuccess(
      {
        nonce: challenge.nonce,
        message: challenge.message,
        expiresAt: challenge.expiresAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
