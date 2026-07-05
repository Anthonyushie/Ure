import { describe, expect, it } from "vitest";
import { bytesToHex } from "@stacks/common";
import { hashMessage } from "@stacks/encryption";
import {
  getAddressFromPublicKey,
  privateKeyToPublic,
  publicKeyToHex,
  randomPrivateKey,
  signMessageHashRsv,
} from "@stacks/transactions";
import {
  buildChallengeMessage,
  deriveStacksAddress,
  isStacksAddress,
  verifyWalletSignature,
} from "@/lib/stacks-auth";

/** Simulate what a Leather/Xverse wallet does when signing a message. */
function walletSign(message: string, privateKey: string) {
  const messageHash = bytesToHex(hashMessage(message));
  return signMessageHashRsv({ messageHash, privateKey });
}

function newWallet(network: "testnet" | "mainnet") {
  const privateKey = randomPrivateKey();
  const publicKey = publicKeyToHex(privateKeyToPublic(privateKey));
  const address = getAddressFromPublicKey(publicKey, network);
  return { privateKey, publicKey, address };
}

const message = buildChallengeMessage({
  walletAddress: "PLACEHOLDER",
  nonce: "test-nonce-123456",
  domain: "localhost:3000",
  issuedAt: "2026-07-05T00:00:00.000Z",
});

describe("stacks-auth", () => {
  it("recognises well-formed Stacks addresses", () => {
    const { address } = newWallet("testnet");
    expect(isStacksAddress(address)).toBe(true);
    expect(isStacksAddress("not-an-address")).toBe(false);
  });

  it("derives the signer address from its public key", () => {
    const wallet = newWallet("testnet");
    expect(deriveStacksAddress(wallet.publicKey, "testnet")).toBe(
      wallet.address,
    );
  });

  it("accepts a valid signature from the claimed wallet", () => {
    const wallet = newWallet("testnet");
    const signature = walletSign(message, wallet.privateKey);

    expect(
      verifyWalletSignature({
        message,
        signature,
        publicKey: wallet.publicKey,
        expectedAddress: wallet.address,
        network: "testnet",
      }),
    ).toBe(true);
  });

  it("accepts regardless of address letter-casing", () => {
    const wallet = newWallet("testnet");
    const signature = walletSign(message, wallet.privateKey);

    expect(
      verifyWalletSignature({
        message,
        signature,
        publicKey: wallet.publicKey,
        expectedAddress: wallet.address.toLowerCase(),
        network: "testnet",
      }),
    ).toBe(true);
  });

  it("rejects a signature over a different message", () => {
    const wallet = newWallet("testnet");
    const signature = walletSign(message, wallet.privateKey);

    expect(
      verifyWalletSignature({
        message: `${message}tampered`,
        signature,
        publicKey: wallet.publicKey,
        expectedAddress: wallet.address,
        network: "testnet",
      }),
    ).toBe(false);
  });

  it("rejects when the claimed address is not the signer (impersonation)", () => {
    const signer = newWallet("testnet");
    const victim = newWallet("testnet");
    const signature = walletSign(message, signer.privateKey);

    // Valid signature by `signer`, but claiming to be `victim`.
    expect(
      verifyWalletSignature({
        message,
        signature,
        publicKey: signer.publicKey,
        expectedAddress: victim.address,
        network: "testnet",
      }),
    ).toBe(false);
  });

  it("rejects garbage signatures without throwing", () => {
    const wallet = newWallet("testnet");
    expect(
      verifyWalletSignature({
        message,
        signature: "deadbeef",
        publicKey: wallet.publicKey,
        expectedAddress: wallet.address,
        network: "testnet",
      }),
    ).toBe(false);
  });
});
