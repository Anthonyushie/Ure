import { apiError, apiSuccess, parseJsonBody } from "@/lib/api";
import { createSessionCookie, clearSessionCookie } from "@/lib/auth-core";
import { createSessionForWallet, getCurrentSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { UnauthorizedError } from "@/lib/errors";
import { toAddressNetwork, verifyWalletSignature } from "@/lib/stacks-auth";
import { createSessionSchema } from "@/lib/validation";
import { consumeAuthChallenge } from "@/server/auth-service";
import { upsertUser } from "@/server/user-service";

export async function GET() {
  try {
    const session = await getCurrentSession();

    return apiSuccess({ session });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createSessionSchema.parse(await parseJsonBody(request));
    const env = getEnv();

    // 1. Consume the single-use challenge (throws if replayed/expired/foreign).
    const { message } = await consumeAuthChallenge({
      walletAddress: body.walletAddress,
      nonce: body.nonce,
    });

    // 2. Prove the caller controls the claimed wallet by verifying the
    //    signature over that exact challenge message.
    const ownsWallet = verifyWalletSignature({
      message,
      signature: body.signature,
      publicKey: body.publicKey,
      expectedAddress: body.walletAddress,
      network: toAddressNetwork(env.STACKS_NETWORK),
    });

    if (!ownsWallet) {
      throw new UnauthorizedError("Wallet signature could not be verified.");
    }

    // 3. Only now do we trust the address enough to mint a session for it.
    const { payload, token } = createSessionForWallet(body.walletAddress);
    await upsertUser({ walletAddress: payload.walletAddress });

    return apiSuccess(
      { session: payload },
      {
        status: 201,
        headers: {
          "Set-Cookie": createSessionCookie(
            token,
            env.NODE_ENV === "production",
          ),
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  return apiSuccess(
    { signedOut: true },
    {
      headers: {
        "Set-Cookie": clearSessionCookie(),
      },
    },
  );
}
