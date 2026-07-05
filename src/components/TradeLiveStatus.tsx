"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import type { TradeStatus } from "@/generated/prisma/enums";

const TERMINAL: TradeStatus[] = ["COMPLETED", "CANCELLED", "FAILED_NEEDS_REVIEW"];

/**
 * Polls the lightweight status endpoint and refreshes the server component tree
 * when the trade status changes, so the page reflects background progression
 * (fiat secured → released → paid out) without a manual reload.
 */
export function TradeLiveStatus({
  tradeId,
  initialStatus,
}: {
  tradeId: string;
  initialStatus: TradeStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TradeStatus>(initialStatus);
  const statusRef = useRef(initialStatus);

  useEffect(() => {
    if (TERMINAL.includes(status)) {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/trades/${tradeId}/status`, {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          data?: { status?: TradeStatus };
        };
        const next = json.data?.status;
        if (next && next !== statusRef.current) {
          statusRef.current = next;
          setStatus(next);
          router.refresh();
        }
      } catch {
        // transient; try again next tick
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [tradeId, status, router]);

  return <StatusBadge status={status} />;
}
