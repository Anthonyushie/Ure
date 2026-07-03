import { WalletCards } from "lucide-react";

export function ConnectWallet() {
  return (
    <button
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/15 px-4 text-sm font-medium text-emerald-50 transition hover:bg-emerald-300/25"
      type="button"
    >
      <WalletCards className="size-4" aria-hidden="true" />
      Connect Wallet
    </button>
  );
}
