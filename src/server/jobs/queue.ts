import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

type TxClient = Prisma.TransactionClient | PrismaClient;

export const JOB_TYPES = {
  PROCESS_PAYMENT_WEBHOOK: "PROCESS_PAYMENT_WEBHOOK",
  RELEASE_CRYPTO: "RELEASE_CRYPTO",
  CONFIRM_CRYPTO_RELEASE: "CONFIRM_CRYPTO_RELEASE",
  INITIATE_SELLER_PAYOUT: "INITIATE_SELLER_PAYOUT",
  PROCESS_PAYOUT_WEBHOOK: "PROCESS_PAYOUT_WEBHOOK",
  RECONCILE_STALE_TRADE: "RECONCILE_STALE_TRADE",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

/** Exponential backoff (seconds) capped, indexed by attempt number. */
function backoffMs(attempts: number): number {
  const seconds = Math.min(300, 5 * 2 ** Math.max(0, attempts - 1));
  return seconds * 1000;
}

export async function enqueueJob(
  client: TxClient,
  input: {
    type: JobType;
    payload: Prisma.InputJsonValue;
    runAfter?: Date;
    maxAttempts?: number;
  },
) {
  return client.job.create({
    data: {
      type: input.type,
      payload: input.payload,
      runAfter: input.runAfter ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5,
    },
  });
}

export type ClaimedJob = {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

/**
 * Claim the next runnable job using optimistic locking: read the oldest due
 * PENDING job, then conditionally flip it to RUNNING only if it is still
 * PENDING. If a concurrent worker won the race, claimed.count is 0 and we
 * return null so the caller retries.
 */
export async function claimNextJob(
  workerId: string,
  now = new Date(),
): Promise<ClaimedJob | null> {
  const prisma = getPrisma();

  const candidate = await prisma.job.findFirst({
    where: { status: "PENDING", runAfter: { lte: now } },
    orderBy: { runAfter: "asc" },
    select: { id: true },
  });

  if (!candidate) {
    return null;
  }

  const claimed = await prisma.job.updateMany({
    where: { id: candidate.id, status: "PENDING" },
    data: {
      status: "RUNNING",
      lockedAt: now,
      lockedBy: workerId,
      attempts: { increment: 1 },
    },
  });

  if (claimed.count !== 1) {
    return null;
  }

  const job = await prisma.job.findUniqueOrThrow({
    where: { id: candidate.id },
    select: {
      id: true,
      type: true,
      payload: true,
      attempts: true,
      maxAttempts: true,
    },
  });

  return job;
}

export async function completeJob(jobId: string): Promise<void> {
  await getPrisma().job.update({
    where: { id: jobId },
    data: { status: "SUCCEEDED", lockedAt: null, lockedBy: null, errorMessage: null },
  });
}

/**
 * Mark a job failed. If it still has attempts left, requeue it PENDING with a
 * backoff delay; otherwise leave it FAILED for admin review.
 */
export async function failJob(
  job: ClaimedJob,
  error: unknown,
  now = new Date(),
): Promise<{ exhausted: boolean }> {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = job.attempts >= job.maxAttempts;

  await getPrisma().job.update({
    where: { id: job.id },
    data: exhausted
      ? { status: "FAILED", errorMessage: message, lockedAt: null, lockedBy: null }
      : {
          status: "PENDING",
          errorMessage: message,
          lockedAt: null,
          lockedBy: null,
          runAfter: new Date(now.getTime() + backoffMs(job.attempts)),
        },
  });

  return { exhausted };
}
