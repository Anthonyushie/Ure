import { clsx } from "clsx";
import type { TradeStatus } from "@/generated/prisma/enums";

const statusStyles: Record<TradeStatus, string> = {
  DRAFT: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200",
  AWAITING_CRYPTO_LOCK: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  CRYPTO_LOCKED: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  AWAITING_BUYER: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
  AWAITING_FIAT: "border-amber-400/50 bg-amber-400/10 text-amber-100",
  FIAT_SECURED: "border-teal-400/50 bg-teal-400/10 text-teal-100",
  RELEASING_CRYPTO: "border-indigo-400/50 bg-indigo-400/10 text-indigo-100",
  CRYPTO_RELEASED: "border-violet-400/50 bg-violet-400/10 text-violet-100",
  PAYOUT_PENDING: "border-orange-400/50 bg-orange-400/10 text-orange-100",
  COMPLETED: "border-emerald-300/60 bg-emerald-300/15 text-emerald-100",
  CANCELLED: "border-zinc-600/50 bg-zinc-700/20 text-zinc-300",
  REFUND_PENDING: "border-rose-400/50 bg-rose-400/10 text-rose-100",
  FAILED_NEEDS_REVIEW: "border-red-400/50 bg-red-400/10 text-red-100",
};

export function StatusBadge({ status }: { status: TradeStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium",
        statusStyles[status],
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
