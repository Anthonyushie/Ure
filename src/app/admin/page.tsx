import { AdminTradeInspector } from "@/components/AdminTradeInspector";
import { StatusBadge } from "@/components/StatusBadge";

export default function AdminPage() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-10">
      <div>
        <p className="text-sm text-emerald-200">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Admin dashboard</h1>
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
