import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type AuditClient = Prisma.TransactionClient | PrismaClient;

type AuditInput = {
  tradeId?: string;
  actorType: string;
  actorId?: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditLog(client: AuditClient, input: AuditInput) {
  return client.auditLog.create({
    data: {
      tradeId: input.tradeId,
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      metadata: input.metadata,
    },
  });
}
