import { verifyMessageSignatureRsv } from "@stacks/encryption";
import { getAddressFromPublicKey } from "@stacks/transactions";

/**
 * Pure helpers for Stacks wallet sign-in. No Next/Prisma imports so this stays
 * unit-testable and reusable on both request handlers and scripts.
 */

export type StacksAddressNetwork = "mainnet" | "testnet";

/**
 * Stacks only has two address versions on the wire: mainnet (`SP`/`SM`) and
 * testnet (`ST`/`SN`). devnet/mocknet share the testnet version, so collapse
 * anything that is not explicitly mainnet to testnet.
 */
export function toAddressNetwork(
  network: string | undefined,
): StacksAddressNetwork {
  return network === "mainnet" ? "mainnet" : "testnet";
}

/** Loose structural check for a c32-encoded Stacks address. */
export function isStacksAddress(value: string): boolean {
  return /^S[TPMN][0-9A-HJKMNP-Z]{37,40}$/.test(value.trim().toUpperCase());
}

/**
 * Human-readable challenge the wallet signs. The wallet address and nonce are
 * embedded so a signature is only ever valid for one wallet and one challenge.
 */
export function buildChallengeMessage(input: {
  walletAddress: string;
  nonce: string;
  domain: string;
  issuedAt: string;
}): string {
  return [
    `${input.domain} wants you to sign in with your Stacks account:`,
    input.walletAddress,
    "",
    "Sign this message to prove you own this wallet. This will not trigger a transaction or cost any fees.",
    "",
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
  ].join("\n");
}

/**
 * Derive the Stacks address that owns `publicKey` for the given network.
 * Returns null if the public key is malformed.
 */
export function deriveStacksAddress(
  publicKey: string,
  network: StacksAddressNetwork,
): string | null {
  try {
    return getAddressFromPublicKey(publicKey, network);
  } catch {
    return null;
  }
}

export type VerifyWalletSignatureInput = {
  message: string;
  signature: string;
  publicKey: string;
  expectedAddress: string;
  network: StacksAddressNetwork;
};

/**
 * A signature proves ownership only if BOTH hold:
 *  1. the signature is valid for `message` under `publicKey`, and
 *  2. `publicKey` derives to the wallet address the caller claims.
 *
 * Checking (2) is what stops a caller from signing with their own key while
 * claiming someone else's address.
 */
export function verifyWalletSignature(input: VerifyWalletSignatureInput): boolean {
  if (!input.signature || !input.publicKey) {
    return false;
  }

  let signatureValid = false;
  try {
    signatureValid = verifyMessageSignatureRsv({
      message: input.message,
      signature: input.signature,
      publicKey: input.publicKey,
    });
  } catch {
    return false;
  }

  if (!signatureValid) {
    return false;
  }

  const derived = deriveStacksAddress(input.publicKey, input.network);
  if (!derived) {
    return false;
  }

  return derived.toUpperCase() === input.expectedAddress.trim().toUpperCase();
}
