import { PaymentInstructionCard } from "@/components/PaymentInstructionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { TradeStatusTimeline } from "@/components/TradeStatusTimeline";

export default async function TradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1fr_24rem]">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs text-zinc-500">{id}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Trade detail</h1>
          </div>
          <StatusBadge status="DRAFT" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-zinc-400">Crypto amount</p>
            <p className="mt-2 font-mono text-lg text-white">100.000000 STX</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-zinc-400">Fiat amount</p>
            <p className="mt-2 font-mono text-lg text-white">NGN 150000.00</p>
          </div>
        </div>
        <div className="mt-6">
          <PaymentInstructionCard
            accountNumber="pending"
            bankName="Nomba integration deferred"
            accountName="Virtual account unavailable"
            amountMinor={15_000_000n}
          />
        </div>
      </section>
      <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h2 className="mb-4 text-base font-semibold text-white">Status timeline</h2>
        <TradeStatusTimeline status="DRAFT" />
      </aside>
    </div>
  );
}
