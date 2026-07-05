import { describe, expect, it, vi } from "vitest";
import {
  SESSION_COOKIE_NAME,
  createSessionPayload,
  createSessionToken,
} from "@/lib/auth-core";

const adminWallet = "SP3V111HAE657T94YZE9FAE4EHHR6VBFNVHJ60ZZ0";
const nonAdminWallet = "SP000000000000000000000000000000000000000";
const secret = "test-secret-that-is-long-enough";

async function loadAdminHealthRoute() {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_SECRET", secret);
  vi.stubEnv("DATABASE_URL", "postgresql://ure:ure_password@localhost:5432/ure");
  vi.stubEnv("ADMIN_WALLET_ADDRESSES", adminWallet);

  return import("@/app/api/admin/health/route");
}

function requestWithWallet(walletAddress: string) {
  const session = createSessionPayload({
    walletAddress,
    rawAdminWallets: adminWallet,
    now: new Date("2026-07-05T00:00:00.000Z"),
  });
  const token = createSessionToken(session, secret);

  return new Request("http://localhost/api/admin/health", {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
  });
}

describe("admin API protection", () => {
  it("rejects missing sessions", async () => {
    const { GET } = await loadAdminHealthRoute();
    const response = await GET(new Request("http://localhost/api/admin/health"));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects non-admin wallets", async () => {
    const { GET } = await loadAdminHealthRoute();
    const response = await GET(requestWithWallet(nonAdminWallet));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows the creator wallet", async () => {
    const { GET } = await loadAdminHealthRoute();
    const response = await GET(requestWithWallet(adminWallet));
    const body = (await response.json()) as {
      ok: true;
      data: { status: string; walletAddress: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("admin-ok");
    expect(body.data.walletAddress).toBe(adminWallet);
  });
});
