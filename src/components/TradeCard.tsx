import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AmountDisplay } from "@/components/AmountDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import type { TradeStatus } from "@/generated/prisma/enums";

type TradeCardProps = {
  id: string;
  status: TradeStatus;
  cryptoAmountMicro: bigint;
  fiatExpectedMinor: bigint;
  sellerWalletAddress: string;
};

export function TradeCard(props: TradeCardProps) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-zinc-500">{props.id}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">
            <AmountDisplay kind="crypto" amount={props.cryptoAmountMicro} />
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            for <AmountDisplay kind="fiat" amount={props.fiatExpectedMinor} />
          </p>
        </div>
        <StatusBadge status={props.status} />
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
        <p className="truncate font-mono text-xs text-zinc-500">
          {props.sellerWalletAddress}
        </p>
        <Link
          href={`/trade/${props.id}`}
          className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 text-zinc-200 transition hover:border-emerald-300/50 hover:bg-emerald-300/10 hover:text-emerald-100"
          title="Open trade"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          <span className="sr-only">Open trade</span>
        </Link>
      </div>
    </article>
  );
}
