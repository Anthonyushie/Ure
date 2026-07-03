import Link from "next/link";
import { ArrowRight, Banknote, ShieldCheck, TimerReset } from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";

const safetyPoints = [
  {
    icon: ShieldCheck,
    title: "Escrow-first flow",
    copy: "Crypto lock status is separated from fiat confirmation so releases only happen after verified payment state.",
  },
  {
    icon: Banknote,
    title: "Exact NGN accounting",
    copy: "Amounts are stored in integer minor units, keeping display formatting away from core money logic.",
  },
  {
    icon: TimerReset,
    title: "Recoverable states",
    copy: "Every trade status change is constrained by a state machine and written to the audit trail.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-16 px-5 py-12 lg:py-16">
      <section className="grid min-h-[68vh] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-normal text-emerald-200">
            STX to NGN escrow bridge
          </p>
          <h1 className="text-5xl font-semibold leading-tight text-white sm:text-6xl">
            P2P crypto trades without screenshot fraud
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
            Ure gives each trade a strict state path: seller lock, buyer payment,
            provider confirmation, crypto release, and seller payout.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ConnectWallet />
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 px-4 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
            >
              Open dashboard
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30">
          <div className="grid gap-3">
            {["Seller locks STX", "Buyer pays exact NGN", "Ure confirms fiat", "Escrow releases STX"].map(
              (step, index) => (
                <div
                  className="flex items-center gap-4 rounded-md border border-white/10 bg-black/25 p-4"
                  key={step}
                >
                  <span className="grid size-9 place-items-center rounded-md bg-emerald-300/15 font-mono text-sm text-emerald-100">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-zinc-100">{step}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {safetyPoints.map((point) => {
          const Icon = point.icon;
          return (
            <article
              className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
              key={point.title}
            >
              <Icon className="mb-5 size-5 text-emerald-200" aria-hidden="true" />
              <h2 className="text-base font-semibold text-white">{point.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{point.copy}</p>
            </article>
          );
        })}
      </section>
    </div>
  );
}
