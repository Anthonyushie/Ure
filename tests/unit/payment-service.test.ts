import { describe, expect, it } from "vitest";
import {
  evaluateFiatPayment,
  parsePaymentWebhook,
} from "@/server/payment-service";

describe("evaluateFiatPayment (exact-payment MVP)", () => {
  const base = {
    expectedAmountMinor: 15_000_000n,
    currency: "NGN",
    providerStatus: "SUCCESS" as const,
  };

  it("secures an exact NGN success", () => {
    expect(
      evaluateFiatPayment({ ...base, authoritativeAmountMinor: 15_000_000n }),
    ).toEqual({ secured: true, outcome: "EXACT" });
  });

  it("rejects underpayment", () => {
    expect(
      evaluateFiatPayment({ ...base, authoritativeAmountMinor: 14_999_999n }),
    ).toEqual({ secured: false, outcome: "UNDERPAID" });
  });

  it("rejects overpayment", () => {
    expect(
      evaluateFiatPayment({ ...base, authoritativeAmountMinor: 15_000_001n }),
    ).toEqual({ secured: false, outcome: "OVERPAID" });
  });

  it("rejects wrong currency", () => {
    expect(
      evaluateFiatPayment({
        ...base,
        authoritativeAmountMinor: 15_000_000n,
        currency: "USD",
      }),
    ).toEqual({ secured: false, outcome: "WRONG_CURRENCY" });
  });

  it("rejects non-successful provider status", () => {
    expect(
      evaluateFiatPayment({
        ...base,
        authoritativeAmountMinor: 15_000_000n,
        providerStatus: "PENDING",
      }),
    ).toEqual({ secured: false, outcome: "NOT_SUCCESSFUL" });
  });
});

describe("parsePaymentWebhook", () => {
  it("parses the flat (mock) shape and converts Naira → kobo", () => {
    const parsed = parsePaymentWebhook({
      event_type: "payment_success",
      data: {
        id: "txn-1",
        reference: "ure-trade-abc",
        amount: "150000", // Naira
        currency: "NGN",
        payerName: "Jane",
      },
    });
    expect(parsed).toEqual({
      eventType: "payment_success",
      providerTransactionId: "txn-1",
      accountReference: "ure-trade-abc",
      aliasAccountNumber: null,
      reportedAmountMinor: 15_000_000n, // kobo
      currency: "NGN",
      payerName: "Jane",
    });
  });

  it("parses the real Nomba nested data.transaction shape", () => {
    const parsed = parsePaymentWebhook({
      event_type: "payment_success",
      requestId: "req-1",
      data: {
        transaction: {
          transactionId: "txn-9",
          aliasAccountNumber: "1234567890",
          amount: "3500.50", // Naira with kobo
          type: "vact_transfer",
          payerName: "Kola",
        },
      },
    });
    expect(parsed.providerTransactionId).toBe("txn-9");
    expect(parsed.aliasAccountNumber).toBe("1234567890");
    expect(parsed.reportedAmountMinor).toBe(350_050n); // 3,500.50 NGN → kobo
    expect(parsed.payerName).toBe("Kola");
  });

  it("coerces formatted amounts and defaults safely", () => {
    const parsed = parsePaymentWebhook({ data: { amount: "₦150,000.00" } });
    expect(parsed.reportedAmountMinor).toBe(15_000_000n);
    expect(parsed.currency).toBe("NGN");
  });
});
