import Link from "next/link";
import { AcceptTradeButton } from "@/components/AcceptTradeButton";
import { AmountDisplay } from "@/components/AmountDisplay";
import { PaymentInstructionCard } from "@/components/PaymentInstructionCard";
import { TradeLiveStatus } from "@/components/TradeLiveStatus";
import { TradeStatusTimeline } from "@/components/TradeStatusTimeline";
import { getCurrentSession } from "@/lib/auth";
import { getTradeDetail } from "@/server/trade-service";

export const dynamic = "force-dynamic";

const ACCEPTABLE = new Set(["CRYPTO_LOCKED", "AWAITING_BUYER"]);

export default async function TradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCurrentSession().catch(() => null);

  const trade = await getTradeDetail(id).catch(() => null);
  if (!trade) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-2xl font-semibold text-white">Trade not found</h1>
        <p className="mt-3 text-sm text-zinc-400">
          No trade exists with id <span className="font-mono">{id}</span>.
        </p>
        <Link href="/dashboard" className="mt-6 inline-block text-emerald-200 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const wallet = session?.walletAddress ?? null;
  const isSeller = wallet === trade.seller.walletAddress;
  const isBuyer = !!trade.buyer && wallet === trade.buyer.walletAddress;
  const isParty = isSeller || isBuyer;

  const canAccept =
    !!wallet &&
    !isSeller &&
    ACCEPTABLE.has(trade.status) &&
    (!trade.buyerId || isBuyer);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1fr_24rem]">
      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-xs text-zinc-500">{trade.id}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Trade detail</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {isSeller ? "You are the seller" : isBuyer ? "You are the buyer" : "Viewing"}
            </p>
          </div>
          <TradeLiveStatus tradeId={trade.id} initialStatus={trade.status} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-zinc-400">Crypto amount</p>
            <p className="mt-2 font-mono text-lg text-white">
              <AmountDisplay kind="crypto" amount={trade.cryptoAmountMicro} />
            </p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-zinc-400">Fiat amount</p>
            <p className="mt-2 font-mono text-lg text-white">
              <AmountDisplay kind="fiat" amount={trade.fiatExpectedMinor} />
            </p>
          </div>
        </div>

        {canAccept ? (
          <div className="mt-6">
            <AcceptTradeButton tradeId={trade.id} walletAddress={wallet!} />
          </div>
        ) : null}

        {isParty && trade.virtualAccount ? (
          <div className="mt-6">
            <PaymentInstructionCard
              accountNumber={trade.virtualAccount.accountNumber}
              bankName={trade.virtualAccount.bankName}
              accountName={trade.virtualAccount.accountName}
              amountMinor={trade.virtualAccount.expectedAmountMinor}
              expiresAt={trade.virtualAccount.expiresAt}
            />
          </div>
        ) : null}

        {!isParty ? (
          <p className="mt-6 rounded-md border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
            Payment instructions are visible only to the buyer and seller of this
            trade.
          </p>
        ) : null}
      </section>

      <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h2 className="mb-4 text-base font-semibold text-white">Status timeline</h2>
        <TradeStatusTimeline status={trade.status} />
      </aside>
    </div>
  );
}
