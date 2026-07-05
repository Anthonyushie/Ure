import { getEnv } from "@/lib/env";

/**
 * Stacks escrow adapter surface. Real on-chain lock/release lands in Phase D.
 * Until an escrow contract address + oracle key are configured we run in MOCK
 * mode: locks and releases are confirmed synchronously so the trade loop is
 * demoable end-to-end without a deployed contract.
 *
 * TODO(stacks-testnet): implement real contract-call builders and a chain
 * watcher that confirms lock/release transactions before flipping status.
 */

export function isStacksConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.ESCROW_CONTRACT_ADDRESS && env.ESCROW_ORACLE_PRIVATE_KEY);
}

/** Deterministic fake tx id for mock-mode chain operations. */
export function mockTxId(kind: "release" | "refund", tradeId: string): string {
  return `mock-${kind}-${tradeId}`;
}
