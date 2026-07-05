"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

export function AcceptTradeButton({
  tradeId,
  walletAddress,
}: {
  tradeId: string;
  walletAddress: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/${tradeId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerWalletAddress: walletAddress }),
      });
      const result = (await res.json()) as {
        ok: boolean;
        error?: { message: string };
      };
      if (!res.ok || !result.ok) {
        throw new Error(result.error?.message ?? "Could not accept trade.");
      }
      router.refresh();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Could not accept trade.",
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
        onClick={accept}
      >
        <Check className="size-4" aria-hidden="true" />
        {busy ? "Accepting…" : "Accept trade"}
      </button>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
