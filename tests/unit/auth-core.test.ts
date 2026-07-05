import { describe, expect, it } from "vitest";
import {
  createSessionPayload,
  createSessionToken,
  isAdminWallet,
  verifySessionToken,
} from "@/lib/auth-core";

const adminWallet = "SP3V111HAE657T94YZE9FAE4EHHR6VBFNVHJ60ZZ0";
const nonAdminWallet = "SP000000000000000000000000000000000000000";
const secret = "test-secret-that-is-long-enough";

describe("auth core", () => {
  it("matches admin wallets case-insensitively", () => {
    expect(isAdminWallet(adminWallet.toLowerCase(), adminWallet)).toBe(true);
    expect(isAdminWallet(nonAdminWallet, adminWallet)).toBe(false);
  });

  it("creates admin sessions for configured creator wallets", () => {
    const session = createSessionPayload({
      walletAddress: adminWallet,
      rawAdminWallets: adminWallet,
      now: new Date("2026-07-05T00:00:00.000Z"),
    });

    expect(session.role).toBe("ADMIN");
    expect(session.walletAddress).toBe(adminWallet);
  });

  it("rejects tampered session tokens", () => {
    const session = createSessionPayload({
      walletAddress: adminWallet,
      rawAdminWallets: adminWallet,
      now: new Date("2026-07-05T00:00:00.000Z"),
    });
    const token = createSessionToken(session, secret);

    expect(verifySessionToken(`${token}tampered`, secret)).toBeNull();
  });

  it("rejects expired session tokens", () => {
    const session = {
      walletAddress: adminWallet,
      role: "ADMIN" as const,
      expiresAt: "2026-07-04T00:00:00.000Z",
    };
    const token = createSessionToken(session, secret);

    expect(
      verifySessionToken(token, secret, new Date("2026-07-05T00:00:00.000Z")),
    ).toBeNull();
  });
});
