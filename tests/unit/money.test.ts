import { describe, expect, it } from "vitest";
import {
  formatKoboAsNgn,
  formatMicroStxAsStx,
  koboToNairaNumber,
  nairaToKobo,
  parseNgnToKobo,
  parseStxToMicroStx,
} from "@/lib/money";

describe("money helpers", () => {
  it("parses NGN to kobo", () => {
    expect(parseNgnToKobo("150000.25")).toBe(15_000_025n);
  });

  it("formats kobo as NGN", () => {
    expect(formatKoboAsNgn(15_000_025n)).toBe("150000.25");
  });

  it("parses STX to micro-STX", () => {
    expect(parseStxToMicroStx("100.000001")).toBe(100_000_001n);
  });

  it("formats micro-STX as STX", () => {
    expect(formatMicroStxAsStx(100_000_001n)).toBe("100.000001");
  });

  it("rejects floats with too many decimal places", () => {
    expect(() => parseNgnToKobo("1.001")).toThrow(
      "Amount supports at most 2 decimal places.",
    );
    expect(() => parseStxToMicroStx("1.0000001")).toThrow(
      "Amount supports at most 6 decimal places.",
    );
  });

  it("converts Nomba Naira amounts to kobo at the boundary", () => {
    expect(nairaToKobo("3500")).toBe(350_000n);
    expect(nairaToKobo("3500.50")).toBe(350_050n);
    expect(nairaToKobo(150000)).toBe(15_000_000n);
    expect(nairaToKobo("₦150,000.00")).toBe(15_000_000n);
    expect(nairaToKobo("")).toBe(0n);
  });

  it("converts kobo to a Naira number for provider request bodies", () => {
    expect(koboToNairaNumber(15_000_000n)).toBe(150000);
    expect(koboToNairaNumber(350_050n)).toBe(3500.5);
  });
});
