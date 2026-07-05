/**
 * Common Nigerian banks with NIP codes for the payout bank-account form.
 * Codes should be validated against Nomba's bank-list before production; a
 * wrong code simply fails the account-name lookup, so the user gets feedback.
 */
export type Bank = { name: string; code: string };

export const BANKS: Bank[] = [
  { name: "Access Bank", code: "044" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Zenith Bank", code: "057" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Union Bank", code: "032" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Sterling Bank", code: "232" },
  { name: "Wema Bank", code: "035" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Ecobank", code: "050" },
  { name: "Polaris Bank", code: "076" },
  { name: "Keystone Bank", code: "082" },
  { name: "Opay", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Kuda Microfinance Bank", code: "090267" },
  { name: "Moniepoint MFB", code: "090405" },
];

export function bankNameForCode(code: string): string | null {
  return BANKS.find((b) => b.code === code)?.name ?? null;
}
