import type { Prisma } from "@/generated/prisma/client";

export type TradeListItem = Prisma.TradeGetPayload<{
  include: {
    seller: true;
    buyer: true;
    escrowLock: true;
    virtualAccount: true;
  };
}>;

export type TradeDetail = Prisma.TradeGetPayload<{
  include: {
    seller: true;
    buyer: true;
    sellerBankAccount: true;
    virtualAccount: true;
    escrowLock: true;
    fiatTransactions: true;
    payouts: true;
    auditLogs: {
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;
