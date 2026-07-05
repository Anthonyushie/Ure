import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { TradeStatus } from "@/generated/prisma/enums";
import { AppError, NotFoundError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { getPrisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { assertPositiveBigIntString } from "@/lib/money";
import { getNombaClient } from "@/lib/nomba";
import { isStacksConfigured } from "@/lib/stacks";
import { assertCanTransitionTrade } from "@/lib/state-machine";

/** Stable virtual-account reference for a trade (also the payment key). */
export function tradeAccountReference(tradeId: string): string {
  return `ure-trade-${tradeId}`;
}

const ACCEPTABLE_TRADE_STATUSES: TradeStatus[] = [
  "CRYPTO_LOCKED",
  "AWAITING_BUYER",
];

type TxClient = Prisma.TransactionClient | PrismaClient;

export type CreateTradeInput = {
  sellerWalletAddress: string;
  cryptoAsset: "STX";
  cryptoAmountMicro: string;
  fiatExpectedMinor: string;
  sellerBankAccountId?: string;
};

export type ListTradesInput = {
  status?: TradeStatus;
  sellerId?: string;
  buyerId?: string;
  cursor?: string;
  limit: number;
};

export async function createTrade(input: CreateTradeInput) {
  const prisma = getPrisma();
  const cryptoAmountMicro = assertPositiveBigIntString(
    input.cryptoAmountMicro,
    "cryptoAmountMicro",
  );
  const fiatExpectedMinor = assertPositiveBigIntString(
    input.fiatExpectedMinor,
    "fiatExpectedMinor",
  );
  const sellerWalletAddress = input.sellerWalletAddress.trim();

  return prisma.$transaction(async (tx) => {
    const seller = await tx.user.upsert({
      where: { walletAddress: sellerWalletAddress },
      update: {},
      create: { walletAddress: sellerWalletAddress },
    });

    if (input.sellerBankAccountId) {
      const bankAccount = await tx.bankAccount.findFirst({
        where: {
          id: input.sellerBankAccountId,
          userId: seller.id,
        },
      });

      if (!bankAccount) {
        throw new AppError(
          "SELLER_BANK_ACCOUNT_NOT_FOUND",
          "Seller bank account does not belong to this wallet.",
          422,
        );
      }
    }

    const trade = await tx.trade.create({
      data: {
        sellerId: seller.id,
        sellerBankAccountId: input.sellerBankAccountId,
        cryptoAsset: input.cryptoAsset,
        cryptoAmountMicro,
        fiatExpectedMinor,
      },
      include: tradeDetailInclude,
    });

    await createAuditLog(tx, {
      tradeId: trade.id,
      actorType: "USER",
      actorId: seller.id,
      action: "TRADE_CREATED",
      metadata: {
        status: trade.status,
        cryptoAmountMicro: trade.cryptoAmountMicro.toString(),
        fiatExpectedMinor: trade.fiatExpectedMinor.toString(),
      },
    });

    return trade;
  });
}

export async function listTrades(input: ListTradesInput) {
  const prisma = getPrisma();
  const items = await prisma.trade.findMany({
    where: {
      status: input.status,
      sellerId: input.sellerId,
      buyerId: input.buyerId,
    },
    include: {
      seller: true,
      buyer: true,
      escrowLock: true,
      virtualAccount: true,
    },
    orderBy: { createdAt: "desc" },
    take: input.limit + 1,
    skip: input.cursor ? 1 : 0,
    cursor: input.cursor ? { id: input.cursor } : undefined,
  });

  const hasMore = items.length > input.limit;
  const visibleItems = hasMore ? items.slice(0, input.limit) : items;

  return {
    items: visibleItems,
    nextCursor: hasMore ? visibleItems.at(-1)?.id ?? null : null,
  };
}

/** Trades where the wallet is the seller and where it is the buyer. */
export async function getTradesForWallet(walletAddress: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { walletAddress: walletAddress.trim() },
    select: { id: true },
  });

  if (!user) {
    return { selling: [], buying: [] };
  }

  const [selling, buying] = await Promise.all([
    prisma.trade.findMany({
      where: { sellerId: user.id },
      include: { seller: true, buyer: true, escrowLock: true, virtualAccount: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.trade.findMany({
      where: { buyerId: user.id },
      include: { seller: true, buyer: true, escrowLock: true, virtualAccount: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return { selling, buying };
}

export async function getTradeDetail(id: string) {
  const prisma = getPrisma();
  const trade = await prisma.trade.findUnique({
    where: { id },
    include: tradeDetailInclude,
  });

  if (!trade) {
    throw new NotFoundError("Trade");
  }

  return trade;
}

export async function getTradeStatus(id: string) {
  const prisma = getPrisma();
  const trade = await prisma.trade.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      fiatReceivedMinor: true,
      escrowLock: {
        select: { status: true },
      },
      payouts: {
        select: { status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!trade) {
    throw new NotFoundError("Trade");
  }

  return {
    tradeId: trade.id,
    status: trade.status,
    fiatReceivedMinor: trade.fiatReceivedMinor,
    escrowStatus: trade.escrowLock?.status ?? "NOT_STARTED",
    payoutStatus: trade.payouts[0]?.status ?? "NOT_STARTED",
  };
}

export async function transitionTradeStatus(input: {
  tradeId: string;
  to: TradeStatus;
  actorType: string;
  actorId?: string;
  metadata?: Prisma.InputJsonObject;
}) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) =>
    transitionTradeStatusInTx(tx, {
      tradeId: input.tradeId,
      to: input.to,
      actorType: input.actorType,
      actorId: input.actorId,
      metadata: input.metadata,
    }),
  );
}

export async function recordLockTransaction(input: {
  tradeId: string;
  sellerWalletAddress: string;
  lockTxId: string;
}) {
  const prisma = getPrisma();
  const env = getEnv();
  const sellerWalletAddress = input.sellerWalletAddress.trim();

  return prisma.$transaction(async (tx) => {
    const trade = await tx.trade.findUnique({
      where: { id: input.tradeId },
      include: {
        seller: true,
        escrowLock: true,
      },
    });

    if (!trade) {
      throw new NotFoundError("Trade");
    }

    if (trade.seller.walletAddress !== sellerWalletAddress) {
      throw new AppError(
        "SELLER_WALLET_MISMATCH",
        "Only the seller wallet can record the escrow lock transaction.",
        403,
      );
    }

    if (trade.escrowLock?.lockTxId === input.lockTxId) {
      return getTradeDetail(input.tradeId);
    }

    if (trade.escrowLock) {
      throw new AppError(
        "ESCROW_LOCK_ALREADY_RECORDED",
        "This trade already has an escrow lock transaction.",
        409,
      );
    }

    await transitionTradeStatusInTx(tx, {
      tradeId: trade.id,
      to: "AWAITING_CRYPTO_LOCK",
      actorType: "USER",
      actorId: trade.sellerId,
      metadata: { lockTxId: input.lockTxId },
    });

    const stacksLive = isStacksConfigured();

    await tx.escrowLock.create({
      data: {
        tradeId: trade.id,
        contractAddress: env.ESCROW_CONTRACT_ADDRESS || "pending-contract-address",
        contractName: env.ESCROW_CONTRACT_NAME,
        lockTxId: input.lockTxId,
        sellerAddress: sellerWalletAddress,
        amountMicro: trade.cryptoAmountMicro,
        // Mock mode confirms the lock immediately; live mode waits for a chain
        // watcher (Phase D) before confirming.
        status: stacksLive ? "LOCK_PENDING" : "LOCK_CONFIRMED",
        confirmations: stacksLive ? 0 : 1,
        rawLockPayload: {
          integration: "stacks",
          phase: stacksLive ? "live" : "mock",
        },
      },
    });

    // In mock mode, advance straight to CRYPTO_LOCKED so the trade is
    // immediately acceptable by a buyer.
    if (!stacksLive) {
      await transitionTradeStatusInTx(tx, {
        tradeId: trade.id,
        to: "CRYPTO_LOCKED",
        actorType: "SYSTEM",
        metadata: { mockLockConfirmed: true, lockTxId: input.lockTxId },
      });
    }

    return tx.trade.findUniqueOrThrow({
      where: { id: trade.id },
      include: tradeDetailInclude,
    });
  });
}

export type AcceptTradeInput = {
  tradeId: string;
  buyerWalletAddress: string;
};

/**
 * Buyer accepts a locked trade: claim the buyer slot, create a single-use
 * Nomba virtual account for the exact fiat amount, and move the trade to
 * AWAITING_FIAT.
 *
 * Idempotency: the buyer slot is claimed with a conditional updateMany, and the
 * VirtualAccount row is unique per trade — so a duplicate accept returns the
 * existing account instead of creating a second one.
 */
export async function acceptTrade(input: AcceptTradeInput) {
  const prisma = getPrisma();
  const buyerWalletAddress = input.buyerWalletAddress.trim();

  const buyer = await prisma.user.upsert({
    where: { walletAddress: buyerWalletAddress },
    update: {},
    create: { walletAddress: buyerWalletAddress },
  });

  const trade = await prisma.trade.findUnique({
    where: { id: input.tradeId },
    include: { seller: true, virtualAccount: true },
  });

  if (!trade) {
    throw new NotFoundError("Trade");
  }

  // Already fully accepted by this buyer → return existing (idempotent).
  if (trade.buyerId === buyer.id && trade.virtualAccount) {
    return getTradeDetail(trade.id);
  }

  if (trade.seller.walletAddress === buyerWalletAddress) {
    throw new AppError(
      "SELLER_CANNOT_ACCEPT_OWN_TRADE",
      "A seller cannot accept their own trade.",
      422,
    );
  }

  if (trade.buyerId && trade.buyerId !== buyer.id) {
    throw new AppError(
      "TRADE_ALREADY_ACCEPTED",
      "This trade has already been accepted by another buyer.",
      409,
    );
  }

  if (!ACCEPTABLE_TRADE_STATUSES.includes(trade.status)) {
    throw new AppError(
      "TRADE_NOT_ACCEPTABLE",
      `Trade cannot be accepted while in status ${trade.status}.`,
      409,
    );
  }

  // Atomically claim the buyer slot if it is still open.
  if (!trade.buyerId) {
    const claimed = await prisma.trade.updateMany({
      where: { id: trade.id, buyerId: null },
      data: { buyerId: buyer.id, acceptedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        "TRADE_ALREADY_ACCEPTED",
        "This trade has already been accepted by another buyer.",
        409,
      );
    }
  }

  // Create the virtual account with the payment provider (mock or real).
  const accountReference = tradeAccountReference(trade.id);
  const nomba = getNombaClient();
  const va = await nomba.createVirtualAccount({
    tradeId: trade.id,
    amountMinor: trade.fiatExpectedMinor,
    accountReference,
    customerName: `Ure buyer ${buyer.walletAddress.slice(0, 8)}`,
  });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.virtualAccount.findUnique({
      where: { tradeId: trade.id },
    });

    if (!existing) {
      await tx.virtualAccount.create({
        data: {
          tradeId: trade.id,
          provider: nomba.driver === "mock" ? "nomba-mock" : "nomba",
          providerAccountId: va.providerAccountId,
          accountReference: va.accountReference,
          accountNumber: va.accountNumber,
          bankName: va.bankName,
          accountName: va.accountName,
          expectedAmountMinor: trade.fiatExpectedMinor,
          expiresAt: va.expiresAt,
          rawProviderPayload: va.raw as Prisma.InputJsonValue,
        },
      });
    }

    const fresh = await tx.trade.findUniqueOrThrow({
      where: { id: trade.id },
      select: { status: true },
    });

    if (fresh.status !== "AWAITING_FIAT") {
      await transitionTradeStatusInTx(tx, {
        tradeId: trade.id,
        to: "AWAITING_FIAT",
        actorType: "USER",
        actorId: buyer.id,
        metadata: { accountReference, driver: nomba.driver },
      });
    }

    return tx.trade.findUniqueOrThrow({
      where: { id: trade.id },
      include: tradeDetailInclude,
    });
  });
}

export async function transitionTradeStatusInTx(
  tx: TxClient,
  input: {
    tradeId: string;
    to: TradeStatus;
    actorType: string;
    actorId?: string;
    metadata?: Prisma.InputJsonObject;
  },
) {
  const trade = await tx.trade.findUnique({
    where: { id: input.tradeId },
    select: { id: true, status: true },
  });

  if (!trade) {
    throw new NotFoundError("Trade");
  }

  assertCanTransitionTrade(trade.status, input.to);

  const updated = await tx.trade.update({
    where: { id: trade.id },
    data: {
      status: input.to,
      completedAt: input.to === "COMPLETED" ? new Date() : undefined,
      cancelledAt: input.to === "CANCELLED" ? new Date() : undefined,
    },
  });

  await createAuditLog(tx, {
    tradeId: trade.id,
    actorType: input.actorType,
    actorId: input.actorId,
    action: "TRADE_STATUS_CHANGED",
    metadata: {
      from: trade.status,
      to: input.to,
      ...(input.metadata ?? {}),
    },
  });

  return updated;
}

const tradeDetailInclude = {
  seller: true,
  buyer: true,
  sellerBankAccount: true,
  virtualAccount: true,
  escrowLock: true,
  fiatTransactions: {
    orderBy: { createdAt: "desc" },
  },
  payouts: {
    orderBy: { createdAt: "desc" },
  },
  auditLogs: {
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.TradeInclude;
