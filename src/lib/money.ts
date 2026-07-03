import { AppError } from "@/lib/errors";

const decimalPattern = /^(\d+)(?:\.(\d+))?$/;

export function parseMinorUnits(input: string, decimals: number): bigint {
  const trimmed = input.trim();
  const match = decimalPattern.exec(trimmed);

  if (!match) {
    throw new AppError("INVALID_AMOUNT", "Amount must be a positive decimal string.");
  }

  const [, whole, fraction = ""] = match;

  if (fraction.length > decimals) {
    throw new AppError(
      "INVALID_AMOUNT_PRECISION",
      `Amount supports at most ${decimals} decimal places.`,
    );
  }

  const paddedFraction = fraction.padEnd(decimals, "0");
  const minor = BigInt(`${whole}${paddedFraction}`);

  if (minor <= 0n) {
    throw new AppError("INVALID_AMOUNT", "Amount must be greater than zero.");
  }

  return minor;
}

export function assertPositiveBigIntString(value: string, field: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new AppError("INVALID_AMOUNT", `${field} must be an integer string.`);
  }

  const amount = BigInt(value);
  if (amount <= 0n) {
    throw new AppError("INVALID_AMOUNT", `${field} must be greater than zero.`);
  }

  return amount;
}

export function formatMinorUnits(amount: bigint, decimals: number): string {
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = (absolute % base).toString().padStart(decimals, "0");
  const formatted = decimals === 0 ? whole.toString() : `${whole}.${fraction}`;

  return negative ? `-${formatted}` : formatted;
}

export const parseNgnToKobo = (input: string): bigint => parseMinorUnits(input, 2);
export const parseStxToMicroStx = (input: string): bigint =>
  parseMinorUnits(input, 6);
export const formatKoboAsNgn = (amount: bigint): string =>
  formatMinorUnits(amount, 2);
export const formatMicroStxAsStx = (amount: bigint): string =>
  formatMinorUnits(amount, 6);
