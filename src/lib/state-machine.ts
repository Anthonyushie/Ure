import type { TradeStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors";

export const allowedTradeTransitions: Record<TradeStatus, TradeStatus[]> = {
  DRAFT: ["AWAITING_CRYPTO_LOCK", "CANCELLED"],
  AWAITING_CRYPTO_LOCK: ["CRYPTO_LOCKED", "FAILED_NEEDS_REVIEW", "CANCELLED"],
  CRYPTO_LOCKED: ["AWAITING_BUYER", "AWAITING_FIAT", "REFUND_PENDING", "CANCELLED"],
  AWAITING_BUYER: ["AWAITING_FIAT", "REFUND_PENDING", "CANCELLED"],
  AWAITING_FIAT: ["FIAT_SECURED", "REFUND_PENDING", "FAILED_NEEDS_REVIEW", "CANCELLED"],
  FIAT_SECURED: ["RELEASING_CRYPTO", "FAILED_NEEDS_REVIEW"],
  RELEASING_CRYPTO: ["CRYPTO_RELEASED", "FAILED_NEEDS_REVIEW"],
  CRYPTO_RELEASED: ["PAYOUT_PENDING", "FAILED_NEEDS_REVIEW"],
  PAYOUT_PENDING: ["COMPLETED", "FAILED_NEEDS_REVIEW"],
  COMPLETED: [],
  CANCELLED: [],
  REFUND_PENDING: ["CANCELLED", "FAILED_NEEDS_REVIEW"],
  FAILED_NEEDS_REVIEW: [
    "RELEASING_CRYPTO",
    "PAYOUT_PENDING",
    "COMPLETED",
    "CANCELLED",
    "REFUND_PENDING",
  ],
};

export function canTransitionTrade(from: TradeStatus, to: TradeStatus): boolean {
  return allowedTradeTransitions[from].includes(to);
}

export function assertCanTransitionTrade(from: TradeStatus, to: TradeStatus): void {
  if (!canTransitionTrade(from, to)) {
    throw new AppError(
      "INVALID_TRADE_TRANSITION",
      `Trade cannot transition from ${from} to ${to}.`,
      409,
      { from, to },
    );
  }
}
