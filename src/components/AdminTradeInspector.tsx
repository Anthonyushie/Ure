"use client";

import { useState } from "react";
import { Search } from "lucide-react";

type AdminTradeView = {
  trade: {
    id: string;
    status: string;
    cryptoAmountMicro: string;
    fiatExpectedMinor: string;
    fiatReceivedMinor: string;
    seller: { walletAddress: string };
    buyer: { walletAddress: string } | null;
    virtualAccount: { accountNumber: string; bankName: string } | null;
    escrowLock: { status: string; releaseTxId: string | null } | null;
    payouts: { status: string; merchantTxRef: string }[];
    auditLogs: { action: string; createdAt: string; metadata: unknown }[];
  };
  webhookEvents: {
    id: string;
    eventType: string;
    status: string;
    signatureValid: boolean;
    createdAt: string;
  }[];
  jobs: { id: string; type: string; status: string; attempts: number }[];
};

export function AdminTradeInspector() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<AdminTradeView | null>(null);

  async function search() {
    const id = query.trim();
    if (!id) return;
    setBusy(true);
    setError(null);
    setView(null);
    try {
      const res = await fetch(`/api/admin/trades/${id}`, { cache: "no-store" });
      const result = (await res.json()) as {
        ok: boolean;
        data?: AdminTradeView;
        error?: { message: string };
      };
      if (!res.ok || !result.ok || !result.data) {
        throw new Error(result.error?.message ?? "Trade not found.");
      }
      setView(result.data);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Lookup failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex items-center gap-3">
        <Search className="size-5 text-emerald-200" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Trade inspector</h2>
      </div>
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          className="h-11 flex-1 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/60"
          placeholder="trade uuid"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="inline-flex h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-60"
          type="submit"
          disabled={busy}
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-200">{error}</p> : null}

      {view ? (
        <div className="mt-5 grid gap-4 text-sm">
          <Block title={`Trade — ${view.trade.status}`}>
            <Row k="Seller" v={view.trade.seller.walletAddress} mono />
            <Row k="Buyer" v={view.trade.buyer?.walletAddress ?? "—"} mono />
            <Row k="Crypto (µSTX)" v={view.trade.cryptoAmountMicro} mono />
            <Row
              k="Fiat expected/received (kobo)"
              v={`${view.trade.fiatExpectedMinor} / ${view.trade.fiatReceivedMinor}`}
              mono
            />
            <Row
              k="Escrow"
              v={
                view.trade.escrowLock
                  ? `${view.trade.escrowLock.status} ${view.trade.escrowLock.releaseTxId ?? ""}`
                  : "—"
              }
              mono
            />
            <Row
              k="Virtual account"
              v={
                view.trade.virtualAccount
                  ? `${view.trade.virtualAccount.accountNumber} (${view.trade.virtualAccount.bankName})`
                  : "—"
              }
              mono
            />
          </Block>

          <Block title={`Payouts (${view.trade.payouts.length})`}>
            {view.trade.payouts.length ? (
              view.trade.payouts.map((p) => (
                <Row key={p.merchantTxRef} k={p.merchantTxRef} v={p.status} mono />
              ))
            ) : (
              <p className="text-zinc-500">None</p>
            )}
          </Block>

          <Block title={`Webhook events (${view.webhookEvents.length})`}>
            {view.webhookEvents.length ? (
              view.webhookEvents.map((w) => (
                <Row
                  key={w.id}
                  k={`${w.eventType} ${w.signatureValid ? "✓" : "✗sig"}`}
                  v={w.status}
                />
              ))
            ) : (
              <p className="text-zinc-500">None</p>
            )}
          </Block>

          <Block title={`Jobs (${view.jobs.length})`}>
            {view.jobs.length ? (
              view.jobs.map((j) => (
                <Row key={j.id} k={`${j.type} (att ${j.attempts})`} v={j.status} />
              ))
            ) : (
              <p className="text-zinc-500">None</p>
            )}
          </Block>

          <Block title={`Audit log (${view.trade.auditLogs.length})`}>
            {view.trade.auditLogs.map((a, i) => (
              <Row key={i} k={a.action} v={new Date(a.createdAt).toLocaleTimeString()} />
            ))}
          </Block>
        </div>
      ) : null}
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </p>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-zinc-400">{k}</span>
      <span className={`text-right text-zinc-100 ${mono ? "font-mono text-xs" : ""}`}>
        {v}
      </span>
    </div>
  );
}
