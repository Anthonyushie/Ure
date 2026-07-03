import { Plus } from "lucide-react";

export function CreateTradeForm() {
  return (
    <form className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-200" htmlFor="stx-amount">
          STX amount
        </label>
        <input
          className="h-11 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/60"
          id="stx-amount"
          inputMode="decimal"
          placeholder="100.000000"
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
        />
      </div>
      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
        type="button"
      >
        <Plus className="size-4" aria-hidden="true" />
        Create Trade
      </button>
    </form>
  );
}
