import { Landmark } from "lucide-react";
import { AmountDisplay } from "@/components/AmountDisplay";

type PaymentInstructionCardProps = {
  accountNumber: string;
  bankName: string;
  accountName?: string | null;
  amountMinor: bigint;
  expiresAt?: Date | null;
};

export function PaymentInstructionCard(props: PaymentInstructionCardProps) {
  return (
    <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-5">
      <div className="mb-4 flex items-center gap-3">
        <Landmark className="size-5 text-amber-200" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Payment rail</h2>
      </div>
      <dl className="grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-6">
          <dt className="text-zinc-400">Bank</dt>
          <dd className="text-right text-zinc-100">{props.bankName}</dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="text-zinc-400">Account number</dt>
          <dd className="font-mono text-zinc-100">{props.accountNumber}</dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="text-zinc-400">Account name</dt>
          <dd className="text-right text-zinc-100">{props.accountName ?? "Ure escrow"}</dd>
        </div>
        <div className="flex items-center justify-between gap-6">
          <dt className="text-zinc-400">Exact amount</dt>
          <dd className="text-right text-amber-100">
            <AmountDisplay kind="fiat" amount={props.amountMinor} />
          </dd>
        </div>
        {props.expiresAt ? (
          <div className="flex items-center justify-between gap-6">
            <dt className="text-zinc-400">Expires</dt>
            <dd className="text-right text-zinc-100">
              {props.expiresAt.toLocaleString("en-NG")}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
