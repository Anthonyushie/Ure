import { randomBytes } from "node:crypto";
import { normalizeWalletAddress } from "@/lib/auth-core";
import { getEnv } from "@/lib/env";
import { UnauthorizedError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";
import { buildChallengeMessage, isStacksAddress } from "@/lib/stacks-auth";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type AuthChallenge = {
  nonce: string;
  message: string;
  expiresAt: Date;
};

/**
 * Create a single-use sign-in challenge for a wallet. The wallet must sign the
 * returned `message`; the signature is later checked against an unconsumed,
 * unexpired row in `consumeAuthChallenge`.
 */
export async function createAuthChallenge(
  walletAddress: string,
  now = new Date(),
): Promise<AuthChallenge> {
  const normalized = normalizeWalletAddress(walletAddress);

  if (!isStacksAddress(normalized)) {
    throw new UnauthorizedError("A valid Stacks wallet address is required.");
  }

  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const message = buildChallengeMessage({
    walletAddress: normalized,
    nonce,
    domain: new URL(getEnv().NEXT_PUBLIC_APP_URL).host,
    issuedAt: now.toISOString(),
  });

  await getPrisma().authChallenge.create({
    data: { walletAddress: normalized, nonce, message, expiresAt },
  });

  return { nonce, message, expiresAt };
}

/**
 * Atomically consume a challenge: mark it used only if it exists, belongs to
 * the wallet, is unconsumed, and is unexpired. Returns the signed `message`.
 * Throws UnauthorizedError otherwise. Using updateMany with those conditions
 * makes consumption race-safe (a replay finds count === 0).
 */
export async function consumeAuthChallenge(
  input: { walletAddress: string; nonce: string },
  now = new Date(),
): Promise<{ message: string }> {
  const prisma = getPrisma();
  const normalized = normalizeWalletAddress(input.walletAddress);

  const challenge = await prisma.authChallenge.findUnique({
    where: { nonce: input.nonce },
  });

  if (
    !challenge ||
    challenge.walletAddress !== normalized ||
    challenge.consumedAt !== null ||
    challenge.expiresAt.getTime() <= now.getTime()
  ) {
    throw new UnauthorizedError("Sign-in challenge is invalid or expired.");
  }

  const claimed = await prisma.authChallenge.updateMany({
    where: { nonce: input.nonce, consumedAt: null },
    data: { consumedAt: now },
  });

  if (claimed.count !== 1) {
    throw new UnauthorizedError("Sign-in challenge was already used.");
  }

  return { message: challenge.message };
}
