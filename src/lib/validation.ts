import { z } from "zod";
import { TradeStatus } from "@/generated/prisma/enums";

export const walletAddressSchema = z.string().trim().min(10).max(128);
export const bigintStringSchema = z.string().regex(/^\d+$/);

export const createUserSchema = z.object({
  walletAddress: walletAddressSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const authNonceSchema = z.object({
  walletAddress: walletAddressSchema,
});

export const createSessionSchema = z.object({
  walletAddress: walletAddressSchema,
  publicKey: z.string().trim().min(32).max(132),
  signature: z.string().trim().min(64).max(200),
  nonce: z.string().trim().min(16).max(128),
});

export const createTradeSchema = z.object({
  sellerWalletAddress: walletAddressSchema,
  cryptoAsset: z.literal("STX"),
  cryptoAmountMicro: bigintStringSchema,
  fiatExpectedMinor: bigintStringSchema,
  sellerBankAccountId: z.uuid().optional(),
});

export const recordLockTransactionSchema = z.object({
  sellerWalletAddress: walletAddressSchema,
  lockTxId: z.string().trim().min(8).max(128),
});

export const acceptTradeSchema = z.object({
  buyerWalletAddress: walletAddressSchema,
});

export const listTradesQuerySchema = z.object({
  status: z.enum(TradeStatus).optional(),
  sellerId: z.uuid().optional(),
  buyerId: z.uuid().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const listUsersQuerySchema = z.object({
  walletAddress: walletAddressSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
});
