import { cookies } from "next/headers";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import {
  SESSION_COOKIE_NAME,
  createSessionPayload,
  createSessionToken,
  isAdminWallet,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth-core";
import { getEnv } from "@/lib/env";

function getSessionSecret(): string {
  const env = getEnv();
  const secret = env.APP_SECRET;

  if (!secret) {
    throw new Error("APP_SECRET is required for session auth.");
  }

  return secret;
}

export function createSessionForWallet(walletAddress: string): {
  payload: SessionPayload;
  token: string;
} {
  const env = getEnv();
  const payload = createSessionPayload({
    walletAddress,
    rawAdminWallets: env.ADMIN_WALLET_ADDRESSES,
  });
  const token = createSessionToken(payload, getSessionSecret());

  return { payload, token };
}

export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return verifySessionToken(token, getSessionSecret());
}

export function getSessionFromRequest(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie");
  const token = cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  return verifySessionToken(token, getSessionSecret());
}

export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await getCurrentSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  if (session.role !== "ADMIN") {
    throw new ForbiddenError("Only the creator wallet can access admin.");
  }

  return session;
}

export function requireAdminRequest(request: Request): SessionPayload {
  const session = getSessionFromRequest(request);

  if (!session) {
    throw new UnauthorizedError();
  }

  if (session.role !== "ADMIN") {
    throw new ForbiddenError("Only the creator wallet can access admin APIs.");
  }

  return session;
}

export function currentWalletIsAdmin(walletAddress: string): boolean {
  return isAdminWallet(walletAddress, getEnv().ADMIN_WALLET_ADDRESSES);
}
