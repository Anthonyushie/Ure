import { describe, expect, it } from "vitest";
import { bankNameForCode } from "@/lib/banks";
import { createBankAccountSchema } from "@/lib/validation";
import { maskAccountNumber } from "@/server/bank-account-service";

describe("bank account helpers", () => {
  it("masks the account number, keeping first/last 3 digits", () => {
    expect(maskAccountNumber("0123456789")).toBe("012****789");
    expect(maskAccountNumber("123")).toBe("****");
  });

  it("resolves bank names by code", () => {
    expect(bankNameForCode("058")).toBe("Guaranty Trust Bank (GTBank)");
    expect(bankNameForCode("000000")).toBeNull();
  });

  it("accepts a valid 10-digit account and rejects others", () => {
    expect(
      createBankAccountSchema.parse({ bankCode: "058", accountNumber: "0123456789" }),
    ).toMatchObject({ bankCode: "058", accountNumber: "0123456789" });

    expect(() =>
      createBankAccountSchema.parse({ bankCode: "058", accountNumber: "12345" }),
    ).toThrow();
    expect(() =>
      createBankAccountSchema.parse({ bankCode: "058", accountNumber: "abcdefghij" }),
    ).toThrow();
  });
});
