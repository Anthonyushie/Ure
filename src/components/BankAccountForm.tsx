"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Plus } from "lucide-react";
import { BANKS, type Bank } from "@/lib/banks";

type BankAccount = {
  id: string;
  bankName: string | null;
  accountNumberMasked: string;
  accountName: string;
  isPrimary: boolean;
  verified: boolean;
};

export function BankAccountForm({
  initialAccounts,
}: {
  initialAccounts: BankAccount[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[]>(initialAccounts);
  const [banks, setBanks] = useState<Bank[]>(BANKS);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Nomba's real bank list (their codes, not NIP codes).
  useEffect(() => {
    let active = true;
    fetch("/api/banks")
      .then((r) => r.json())
      .then((j) => {
        if (active && j?.data?.banks?.length) {
          setBanks(j.data.banks as Bank[]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function addAccount() {
    setError(null);
    if (!bankCode) {
      setError("Select a bank.");
      return;
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      setError("Account number must be 10 digits.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber }),
      });
      const result = (await res.json()) as {
        ok: boolean;
        data?: { account: BankAccount };
        error?: { message: string };
      };
      if (!res.ok || !result.ok || !result.data) {
        throw new Error(result.error?.message ?? "Could not add account.");
      }
      setAccounts((prev) => [
        result.data!.account,
        ...prev.map((a) => ({ ...a, isPrimary: false })),
      ]);
      setAccountNumber("");
      router.refresh();
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Could not add account.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <Landmark className="size-5 text-emerald-200" aria-hidden="true" />
        <h2 className="text-base font-semibold text-white">Payout bank account</h2>
      </div>

      {accounts.length ? (
        <ul className="grid gap-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-white/10 bg-black/25 p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-100">{a.bankName ?? "Bank"}</span>
                {a.isPrimary ? (
                  <span className="rounded bg-emerald-300/15 px-2 py-0.5 text-xs text-emerald-200">
                    Primary
                  </span>
                ) : null}
              </div>
              <p className="mt-1 font-mono text-xs text-zinc-400">
                {a.accountNumberMasked} · {a.accountName}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          Add the account where you want to receive NGN payouts.
        </p>
      )}

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-200" htmlFor="bank">
          Bank
        </label>
        <select
          id="bank"
          className="h-11 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-emerald-300/60"
          value={bankCode}
          onChange={(e) => setBankCode(e.target.value)}
        >
          <option value="">Select bank…</option>
          {banks.map((b) => (
            <option key={`${b.code}-${b.name}`} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-200" htmlFor="acct">
          Account number
        </label>
        <input
          id="acct"
          inputMode="numeric"
          maxLength={10}
          className="h-11 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/60"
          placeholder="0123456789"
          value={accountNumber}
          onChange={(e) =>
            setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
          }
        />
      </div>

      <button
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/15 px-4 text-sm font-medium text-emerald-50 transition hover:bg-emerald-300/25 disabled:opacity-60"
        type="button"
        disabled={busy}
        onClick={addAccount}
      >
        <Plus className="size-4" aria-hidden="true" />
        {busy ? "Verifying…" : "Add account"}
      </button>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
    </section>
  );
}
