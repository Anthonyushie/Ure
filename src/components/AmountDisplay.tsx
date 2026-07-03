import { formatKoboAsNgn, formatMicroStxAsStx } from "@/lib/money";

type AmountDisplayProps =
  | {
      kind: "fiat";
      amount: bigint;
      currency?: "NGN";
    }
  | {
      kind: "crypto";
      amount: bigint;
      asset?: "STX";
    };

export function AmountDisplay(props: AmountDisplayProps) {
  if (props.kind === "fiat") {
    return (
      <span className="font-mono tabular-nums">
        {props.currency ?? "NGN"} {formatKoboAsNgn(props.amount)}
      </span>
    );
  }

  return (
    <span className="font-mono tabular-nums">
      {formatMicroStxAsStx(props.amount)} {props.asset ?? "STX"}
    </span>
  );
}
