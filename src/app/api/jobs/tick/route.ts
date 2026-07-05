import { apiError, apiSuccess } from "@/lib/api";
import { requireAdminRequest } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { UnauthorizedError } from "@/lib/errors";
import { drainJobs } from "@/server/jobs/runner";

/**
 * Authorize a queue drain via any of:
 *  - Vercel Cron: `Authorization: Bearer <CRON_SECRET>` (set on cron invocations)
 *  - a machine worker: `x-worker-token: <APP_SECRET>`
 *  - an admin session cookie
 */
function authorizeTick(request: Request): void {
  const env = getEnv();
  const authHeader = request.headers.get("authorization");
  const workerToken = request.headers.get("x-worker-token");

  const cronOk =
    Boolean(env.CRON_SECRET) && authHeader === `Bearer ${env.CRON_SECRET}`;
  const workerOk =
    Boolean(env.APP_SECRET) && workerToken === env.APP_SECRET;

  if (cronOk || workerOk) {
    return;
  }
  // Falls back to admin-session auth (throws 401/403 if not admin).
  requireAdminRequest(request);
  if (!env.APP_SECRET) {
    throw new UnauthorizedError();
  }
}

async function handle(request: Request): Promise<Response> {
  try {
    authorizeTick(request);
    const result = await drainJobs({ maxJobs: 200 });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

// Vercel Cron sends GET; workers/admin may use POST.
export const GET = handle;
export const POST = handle;
