import { CreateTradeForm } from "@/components/CreateTradeForm";
import { TradeCard } from "@/components/TradeCard";
import { ConnectWallet } from "@/components/ConnectWallet";

const sampleTrades = [
  {
    id: "draft-preview",
    status: "DRAFT" as const,
    cryptoAmountMicro: 100_000_000n,
    fiatExpectedMinor: 15_000_000n,
    sellerWalletAddress: "STSELLERWALLET000000000000000000000",
  },
  {
    id: "lock-preview",
    status: "AWAITING_CRYPTO_LOCK" as const,
    cryptoAmountMicro: 250_000_000n,
    fiatExpectedMinor: 37_500_000n,
    sellerWalletAddress: "STSELLERWALLET111111111111111111111",
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[24rem_1fr]">
      <aside className="grid content-start gap-5">
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-zinc-400">Wallet</p>
          <div className="mt-4">
            <ConnectWallet />
          </div>
        </section>
        <CreateTradeForm />
      </aside>
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-emerald-200">Phase 1/2 shell</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Trades</h1>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {sampleTrades.map((trade) => (
            <TradeCard key={trade.id} {...trade} />
          ))}
        </div>
      </section>
    </div>
  );
}
