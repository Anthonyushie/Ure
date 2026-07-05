import { redirect } from "next/navigation";
import { AdminTradeInspector } from "@/components/AdminTradeInspector";
import { StatusBadge } from "@/components/StatusBadge";
import { requireAdminSession } from "@/lib/auth";

export default async function AdminPage() {
  const session = await requireAdminSession().catch(() => redirect("/dashboard"));

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-10">
      <div>
        <p className="text-sm text-emerald-200">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Admin dashboard</h1>
        <p className="mt-2 font-mono text-xs text-zinc-500">
          {session.walletAddress}
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <AdminTradeInspector />
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-base font-semibold text-white">Stuck states</h2>
          <div className="mt-4 grid gap-3">
            <StatusBadge status="FAILED_NEEDS_REVIEW" />
            <StatusBadge status="REFUND_PENDING" />
            <StatusBadge status="PAYOUT_PENDING" />
          </div>
        </section>
      </div>
    </div>
  );
}
