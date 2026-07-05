"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, WalletCards } from "lucide-react";

type ConnectWalletProps = {
  initialWalletAddress?: string;
  initialRole?: "USER" | "ADMIN";
};

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: { message: string };
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as ApiResult<T>;

  if (!response.ok || !result.ok || !result.data) {
    throw new Error(result.error?.message ?? "Request failed.");
  }

  return result.data;
}

export function ConnectWallet({
  initialWalletAddress,
  initialRole,
}: ConnectWalletProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);

    try {
      // Load the browser-only wallet SDK lazily so it never enters the server
      // bundle (keeps SSR/prerender clean).
      const { connect, request } = await import("@stacks/connect");

      // 1. Ask the wallet for accounts. Wallets return several chains (BTC,
      //    Stacks, etc.) and don't agree on the `symbol` field, so pick the
      //    Stacks account by its address format (SP/ST/SM/SN…), not by symbol
      //    or array position.
      const { addresses } = await connect();
      const looksLikeStacks = (a?: string) =>
        /^S[TPMN][0-9A-HJKMNP-Z]{37,40}$/i.test(a ?? "");
      const stx =
        addresses.find(
          (entry) => entry.symbol === "STX" && looksLikeStacks(entry.address),
        ) ?? addresses.find((entry) => looksLikeStacks(entry.address));

      if (!stx?.address || !stx.publicKey) {
        throw new Error("No Stacks account returned by the wallet.");
      }

      // 2. Get a server-issued single-use challenge for that address.
      const challenge = await postJson<{ message: string; nonce: string }>(
        "/api/auth/nonce",
        { walletAddress: stx.address },
      );

      // 3. Sign the exact challenge message in the wallet.
      const signed = await request("stx_signMessage", {
        message: challenge.message,
      });

      // 4. Exchange the signature for a session cookie.
      await postJson("/api/auth/session", {
        walletAddress: stx.address,
        publicKey: signed.publicKey || stx.publicKey,
        signature: signed.signature,
        nonce: challenge.nonce,
      });

      router.refresh();
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Could not sign in.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);

    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (initialWalletAddress) {
    return (
      <div className="grid gap-3">
        <div className="rounded-md border border-white/10 bg-black/25 p-3">
          <p className="text-xs text-zinc-500">Signed in wallet</p>
          <p className="mt-1 truncate font-mono text-xs text-zinc-100">
            {initialWalletAddress}
          </p>
          <p className="mt-2 text-xs text-emerald-200">{initialRole}</p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-medium text-zinc-100 transition hover:bg-white/10 disabled:opacity-60"
          disabled={busy}
          onClick={signOut}
          type="button"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/15 px-4 text-sm font-medium text-emerald-50 transition hover:bg-emerald-300/25 disabled:opacity-60"
        disabled={busy}
        onClick={signIn}
        type="button"
      >
        <WalletCards className="size-4" aria-hidden="true" />
        {busy ? "Connecting…" : "Connect Stacks wallet"}
      </button>
      <p className="text-xs text-zinc-500">
        Sign a message with Leather or Xverse to prove wallet ownership. No fees,
        no transaction.
      </p>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
