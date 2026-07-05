import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "ure_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionRole = "USER" | "ADMIN";

export type SessionPayload = {
  walletAddress: string;
  role: SessionRole;
  expiresAt: string;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function normalizeWalletAddress(walletAddress: string): string {
  return walletAddress.trim().toUpperCase();
}

export function parseAdminWallets(rawWallets: string): Set<string> {
  return new Set(
    rawWallets
      .split(",")
      .map((wallet) => normalizeWalletAddress(wallet))
      .filter(Boolean),
  );
}

export function isAdminWallet(
  walletAddress: string,
  rawAdminWallets: string,
): boolean {
  return parseAdminWallets(rawAdminWallets).has(
    normalizeWalletAddress(walletAddress),
  );
}

export function createSessionPayload(input: {
  walletAddress: string;
  rawAdminWallets: string;
  now?: Date;
}): SessionPayload {
  const now = input.now ?? new Date();
  const walletAddress = normalizeWalletAddress(input.walletAddress);

  return {
    walletAddress,
    role: isAdminWallet(walletAddress, input.rawAdminWallets) ? "ADMIN" : "USER",
    expiresAt: new Date(
      now.getTime() + SESSION_MAX_AGE_SECONDS * 1000,
    ).toISOString(),
  };
}

export function createSessionToken(
  payload: SessionPayload,
  secret: string,
): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = new Date(),
): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;

    if (!payload.walletAddress || !payload.expiresAt || !payload.role) {
      return null;
    }

    if (Date.parse(payload.expiresAt) <= now.getTime()) {
      return null;
    }

    return {
      walletAddress: normalizeWalletAddress(payload.walletAddress),
      role: payload.role === "ADMIN" ? "ADMIN" : "USER",
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export function createSessionCookie(token: string, secure: boolean): string {
  const secureAttribute = secure ? "; Secure" : "";

  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureAttribute}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
