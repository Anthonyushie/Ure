import { confirmCryptoRelease, releaseEscrow } from "@/server/escrow-service";
import { processPaymentWebhookEvent } from "@/server/payment-service";
import {
  confirmPayout,
  initiateSellerPayout,
  processPayoutWebhookEvent,
} from "@/server/payout-service";
import { reconcileStaleTrade } from "@/server/reconcile-service";
import { JOB_TYPES, type JobType } from "@/server/jobs/queue";

type Payload = Record<string, unknown>;

/** Map each job type to its handler. Handlers must be idempotent. */
export const jobHandlers: Record<JobType, (payload: Payload) => Promise<void>> = {
  [JOB_TYPES.PROCESS_PAYMENT_WEBHOOK]: (p) =>
    processPaymentWebhookEvent(String(p.webhookEventId)),
  [JOB_TYPES.RELEASE_CRYPTO]: (p) => releaseEscrow(String(p.tradeId)),
  [JOB_TYPES.CONFIRM_CRYPTO_RELEASE]: (p) =>
    confirmCryptoRelease(String(p.tradeId)),
  [JOB_TYPES.INITIATE_SELLER_PAYOUT]: (p) =>
    initiateSellerPayout(String(p.tradeId)),
  [JOB_TYPES.PROCESS_PAYOUT_WEBHOOK]: (p) =>
    p.payoutId
      ? confirmPayout(String(p.payoutId))
      : processPayoutWebhookEvent(String(p.webhookEventId)),
  [JOB_TYPES.RECONCILE_STALE_TRADE]: (p) =>
    reconcileStaleTrade(String(p.tradeId)),
};
