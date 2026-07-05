import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildNombaSignatureMessage,
  computeNombaSignature,
  computeWebhookSignature,
  mapNombaEventType,
  payoutIdempotencyKey,
} from "@/lib/nomba";

describe("nomba adapter helpers", () => {
  it("maps provider event types to internal events", () => {
    expect(mapNombaEventType("payment_success")).toBe("PAYMENT_SUCCESS");
    expect(mapNombaEventType("payment.success")).toBe("PAYMENT_SUCCESS");
    expect(mapNombaEventType("payout_failed")).toBe("PAYOUT_FAILED");
    expect(mapNombaEventType("something_else")).toBe("UNKNOWN");
  });

  it("produces a stable idempotency key for a trade/payout", () => {
    expect(payoutIdempotencyKey("trade-1", "payout-1")).toBe(
      "ure:payout:trade-1:payout-1",
    );
    // Deterministic — same inputs, same key.
    expect(payoutIdempotencyKey("trade-1", "payout-1")).toBe(
      payoutIdempotencyKey("trade-1", "payout-1"),
    );
  });

  it("computes a deterministic HMAC-SHA256 hex signature (mock convention)", () => {
    const body = '{"event_type":"payment_success"}';
    const secret = "test-secret";
    const sig = computeWebhookSignature(body, secret);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    // Same body+secret → same signature; different body → different.
    expect(computeWebhookSignature(body, secret)).toBe(sig);
    expect(computeWebhookSignature(body + " ", secret)).not.toBe(sig);
  });

  it("builds the real Nomba signature message: colon-joined fields + timestamp", () => {
    const payload = {
      event_type: "payment_success",
      requestId: "req-1",
      data: {
        merchant: { userId: "u1", walletId: "w1" },
        transaction: { transactionId: "t1", type: "vact", time: "T", responseCode: "00" },
      },
    };
    const msg = buildNombaSignatureMessage(payload, "1720000000");
    expect(msg).toBe("payment_success:req-1:u1:w1:t1:vact:T:00:1720000000");
  });

  it("computes the real Nomba signature as base64 HMAC-SHA256", () => {
    const message = "payment_success:req-1:1720000000";
    const key = "sig-key";
    const expected = createHmac("sha256", key).update(message).digest("base64");
    expect(computeNombaSignature(message, key)).toBe(expected);
    expect(computeNombaSignature(message, key)).toMatch(/=$|[A-Za-z0-9+/]/);
  });
});
