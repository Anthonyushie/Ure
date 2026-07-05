import {
  type ClaimedJob,
  claimNextJob,
  completeJob,
  failJob,
} from "@/server/jobs/queue";
import { jobHandlers } from "@/server/jobs/handlers";

async function runJob(job: ClaimedJob): Promise<"succeeded" | "retry" | "failed"> {
  const handler = jobHandlers[job.type as keyof typeof jobHandlers];
  if (!handler) {
    await failJob(job, new Error(`No handler for job type ${job.type}`));
    return "failed";
  }

  try {
    await handler((job.payload ?? {}) as Record<string, unknown>);
    await completeJob(job.id);
    return "succeeded";
  } catch (error) {
    const { exhausted } = await failJob(job, error);
    return exhausted ? "failed" : "retry";
  }
}

export type DrainResult = {
  processed: number;
  succeeded: number;
  retried: number;
  failed: number;
};

/**
 * Drain due jobs until none remain or `maxJobs` is reached. Jobs that fail and
 * still have attempts left are requeued with backoff (so they will not run
 * again within this drain), which lets a single drain converge the happy path.
 */
export async function drainJobs(
  options: { workerId?: string; maxJobs?: number } = {},
): Promise<DrainResult> {
  const workerId = options.workerId ?? `worker-${process.pid}`;
  const maxJobs = options.maxJobs ?? 100;
  const result: DrainResult = { processed: 0, succeeded: 0, retried: 0, failed: 0 };

  while (result.processed < maxJobs) {
    const job = await claimNextJob(workerId);
    if (!job) {
      break;
    }

    result.processed += 1;
    const outcome = await runJob(job);
    if (outcome === "succeeded") result.succeeded += 1;
    else if (outcome === "retry") result.retried += 1;
    else result.failed += 1;
  }

  return result;
}
