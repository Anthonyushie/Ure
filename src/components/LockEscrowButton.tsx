"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

/**
 * Seller action to lock STX into escrow (moves DRAFT → CRYPTO_LOCKED).
 *
 * Escrow is still mocked (Phase D), so this records a placeholder lock tx id and
 * the backend auto-confirms it. When the real Clarity contract lands, this is
 * where the wallet contract-call is signed and the real tx id is submitted.
 */
export function LockEscrowButton({
  tradeId,
  sellerWalletAddress,
}: {
  tradeId: string;
  sellerWalletAddress: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lock() {
    setBusy(true);
    setError(null);
    try {
      // TODO(stacks-testnet): replace with a real escrow contract-call and use
      // the broadcast tx id here.
      const lockTxId = `mock-lock-${crypto.randomUUID()}`;
      const res = await fetch(`/api/trades/${tradeId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerWalletAddress, lockTxId }),
      });
      const result = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!res.ok || !result.ok) {
        throw new Error(result.error?.message ?? "Could not lock escrow.");
      }
      router.refresh();
    } catch (lockError) {
      setError(
        lockError instanceof Error ? lockError.message : "Could not lock escrow.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:opacity-60"
        type="button"
        disabled={busy}
        onClick={lock}
      >
        <Lock className="size-4" aria-hidden="true" />
        {busy ? "Locking…" : "Lock STX in escrow"}
      </button>
      <p className="text-xs text-zinc-500">
        Simulated escrow lock (on-chain escrow coming in a later phase). Moves the
        trade to CRYPTO_LOCKED so a buyer can accept.
      </p>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
