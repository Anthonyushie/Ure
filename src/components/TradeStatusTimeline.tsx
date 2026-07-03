import { CheckCircle2, CircleDashed } from "lucide-react";
import type { TradeStatus } from "@/generated/prisma/enums";

const milestones: TradeStatus[] = [
  "DRAFT",
  "AWAITING_CRYPTO_LOCK",
  "CRYPTO_LOCKED",
  "AWAITING_FIAT",
  "FIAT_SECURED",
  "RELEASING_CRYPTO",
  "CRYPTO_RELEASED",
  "PAYOUT_PENDING",
  "COMPLETED",
];

export function TradeStatusTimeline({ status }: { status: TradeStatus }) {
  const activeIndex = milestones.indexOf(status);

  return (
    <ol className="grid gap-3">
      {milestones.map((milestone, index) => {
        const complete = activeIndex >= index;
        const Icon = complete ? CheckCircle2 : CircleDashed;

        return (
          <li
            key={milestone}
            className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <Icon
              aria-hidden="true"
              className={complete ? "size-4 text-emerald-300" : "size-4 text-zinc-500"}
            />
            <span className="text-sm text-zinc-200">
              {milestone.replaceAll("_", " ")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
