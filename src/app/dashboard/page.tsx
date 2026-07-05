import { CreateTradeForm } from "@/components/CreateTradeForm";
import { TradeCard } from "@/components/TradeCard";
import { ConnectWallet } from "@/components/ConnectWallet";
import { getCurrentSession } from "@/lib/auth";
import { getTradesForWallet } from "@/server/trade-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getCurrentSession().catch(() => null);
  const { selling, buying } = session
    ? await getTradesForWallet(session.walletAddress)
    : { selling: [], buying: [] };

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[24rem_1fr]">
      <aside className="grid content-start gap-5">
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <p className="text-sm text-zinc-400">Wallet</p>
          <div className="mt-4">
            <ConnectWallet
              initialRole={session?.role}
              initialWalletAddress={session?.walletAddress}
            />
          </div>
        </section>
        {session ? (
          <CreateTradeForm walletAddress={session.walletAddress} />
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/[0.02] p-5 text-sm text-zinc-400">
            Connect your Stacks wallet to create a trade.
          </p>
        )}
      </aside>

      <section className="grid content-start gap-8">
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-emerald-200">You are selling</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">
                Selling trades
              </h1>
            </div>
          </div>
          {selling.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {selling.map((trade) => (
                <TradeCard
                  key={trade.id}
                  id={trade.id}
                  status={trade.status}
                  cryptoAmountMicro={trade.cryptoAmountMicro}
                  fiatExpectedMinor={trade.fiatExpectedMinor}
                  sellerWalletAddress={trade.seller.walletAddress}
                />
              ))}
            </div>
          ) : (
            <EmptyState label="No selling trades yet." />
          )}
        </div>

        <div>
          <div className="mb-5">
            <p className="text-sm text-sky-200">You are buying</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Buying trades
            </h2>
          </div>
          {buying.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {buying.map((trade) => (
                <TradeCard
                  key={trade.id}
                  id={trade.id}
                  status={trade.status}
                  cryptoAmountMicro={trade.cryptoAmountMicro}
                  fiatExpectedMinor={trade.fiatExpectedMinor}
                  sellerWalletAddress={trade.seller.walletAddress}
                />
              ))}
            </div>
          ) : (
            <EmptyState label="No buying trades yet." />
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}
