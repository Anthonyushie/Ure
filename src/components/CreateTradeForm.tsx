"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { parseNgnToKobo, parseStxToMicroStx } from "@/lib/money";

export function CreateTradeForm({ walletAddress }: { walletAddress: string }) {
  const router = useRouter();
  const [stx, setStx] = useState("");
  const [ngn, setNgn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    let cryptoAmountMicro: string;
    let fiatExpectedMinor: string;
    try {
      cryptoAmountMicro = parseStxToMicroStx(stx).toString();
      fiatExpectedMinor = parseNgnToKobo(ngn).toString();
    } catch (parseError) {
      setError(
        parseError instanceof Error ? parseError.message : "Invalid amount.",
      );
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerWalletAddress: walletAddress,
          cryptoAsset: "STX",
          cryptoAmountMicro,
          fiatExpectedMinor,
        }),
      });
      const result = (await res.json()) as {
        ok: boolean;
        data?: { tradeId: string };
        error?: { message: string };
      };
      if (!res.ok || !result.ok || !result.data) {
        throw new Error(result.error?.message ?? "Could not create trade.");
      }
      router.push(`/trade/${result.data.tradeId}`);
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create trade.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-200" htmlFor="stx-amount">
          STX amount
        </label>
        <input
          className="h-11 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/60"
          id="stx-amount"
          inputMode="decimal"
          placeholder="100.000000"
          value={stx}
          onChange={(e) => setStx(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-200" htmlFor="ngn-amount">
          NGN expected
        </label>
        <input
          className="h-11 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/60"
          id="ngn-amount"
          inputMode="decimal"
          placeholder="150000.00"
          value={ngn}
          onChange={(e) => setNgn(e.target.value)}
        />
      </div>
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:opacity-60"
        type="button"
        disabled={busy}
        onClick={submit}
      >
        <Plus className="size-4" aria-hidden="true" />
        {busy ? "Creating…" : "Create Trade"}
      </button>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </div>
  );
}
