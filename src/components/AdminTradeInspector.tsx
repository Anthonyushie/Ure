import { Search } from "lucide-react";

export function AdminTradeInspector() {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex items-center gap-3">
        <Search className="size-5 text-emerald-200" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Trade inspector</h2>
      </div>
      <form className="flex flex-col gap-3 sm:flex-row">
        <input
          className="h-11 flex-1 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/60"
          placeholder="trade uuid"
        />
        <button
          className="inline-flex h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          type="button"
        >
          Search
        </button>
      </form>
    </section>
  );
}
