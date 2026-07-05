import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { apiError, apiSuccess } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getNombaClient, mapNombaEventType } from "@/lib/nomba";
import { getPrisma } from "@/lib/prisma";
import { JOB_TYPES, enqueueJob } from "@/server/jobs/queue";
import { drainJobs } from "@/server/jobs/runner";

// Confirmed against Nomba docs: signature header + RFC-3339 timestamp header.
const SIGNATURE_HEADER = "nomba-signature";
const TIMESTAMP_HEADER = "nomba-timestamp";

/**
 * Nomba webhook receiver. Per spec §1.3 this route ONLY: reads the raw body,
 * verifies the signature, persists the raw event, idempotently enqueues a
 * processing job, and returns 2XX quickly. It never releases crypto or requeries
 * inline — that happens in the background worker.
 */
export async function POST(request: Request) {
  try {
    // 1. Read the RAW body first — signature is computed over these exact bytes.
    const rawBody = await request.text();
    const signature = request.headers.get(SIGNATURE_HEADER);
    const timestamp = request.headers.get(TIMESTAMP_HEADER);

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { unparseable: true, rawBody };
    }

    // 2. Verify authenticity before trusting anything in the payload.
    const nomba = getNombaClient();
    const signatureValid = nomba.verifyWebhookSignature({
      rawBody,
      payload,
      signatureHeader: signature,
      timestampHeader: timestamp,
    });

    const root = (payload ?? {}) as Record<string, unknown>;
    const data = (root.data ?? {}) as Record<string, unknown>;
    const txn = ((data.transaction ?? data) ?? {}) as Record<string, unknown>;
    const eventType = String(root.event_type ?? root.eventType ?? root.type ?? "");
    const requestId =
      (root.requestId as string) ??
      request.headers.get("nomba-request-id") ??
      null;
    const providerEventId = (root.eventId as string) ?? (root.id as string) ?? null;

    const prisma = getPrisma();

    // 3. Reject invalid signatures — store for audit, do not process.
    if (!signatureValid) {
      await prisma.webhookEvent.create({
        data: {
          eventType,
          requestId,
          providerEventId,
          signatureValid: false,
          status: "FAILED",
          errorMessage: "Invalid signature.",
          rawHeaders: headersToJson(request.headers),
          rawPayload: payload as Prisma.InputJsonValue,
        },
      });
      return apiError(
        new AppError("INVALID_SIGNATURE", "Invalid webhook signature.", 401),
      );
    }

    // 4. Idempotency: a repeated requestId is acknowledged without re-enqueueing.
    if (requestId) {
      const seen = await prisma.webhookEvent.findUnique({
        where: { requestId },
      });
      if (seen) {
        return apiSuccess({ received: true, duplicate: true });
      }
    }

    // 5. Persist the raw event, then enqueue the right processor.
    const event = await prisma.webhookEvent.create({
      data: {
        eventType,
        requestId,
        providerEventId,
        providerTransactionId:
          (txn.transactionId as string) ?? (data.id as string) ?? null,
        sessionId:
          (txn.sessionId as string) ?? (data.sessionId as string) ?? null,
        signatureValid: true,
        status: "RECEIVED",
        rawHeaders: headersToJson(request.headers),
        rawPayload: payload as Prisma.InputJsonValue,
      },
    });

    const internal = mapNombaEventType(eventType);
    if (internal === "PAYMENT_SUCCESS" || internal === "PAYMENT_REVERSED") {
      await enqueueJob(prisma, {
        type: JOB_TYPES.PROCESS_PAYMENT_WEBHOOK,
        payload: { webhookEventId: event.id },
      });
    } else if (internal === "PAYOUT_SUCCESS" || internal === "PAYOUT_FAILED") {
      await enqueueJob(prisma, {
        type: JOB_TYPES.PROCESS_PAYOUT_WEBHOOK,
        payload: { webhookEventId: event.id },
      });
    } else {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: "IGNORED", errorMessage: "Unmapped event type." },
      });
    }

    // Process the enqueued job(s) after responding — on serverless this runs in
    // the function's post-response window, so the whole cascade (payment →
    // release → payout) progresses without a persistent worker. The cron tick
    // is a safety net for delayed retries.
    after(async () => {
      try {
        await drainJobs({ maxJobs: 50 });
      } catch {
        // Cron/tick will retry; never fail the webhook response.
      }
    });

    return apiSuccess({ received: true });
  } catch (error) {
    return apiError(error);
  }
}

function headersToJson(headers: Headers): Prisma.InputJsonValue {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    // Avoid persisting bearer tokens or cookies.
    if (key === "authorization" || key === "cookie") {
      return;
    }
    obj[key] = value;
  });
  return obj;
}
