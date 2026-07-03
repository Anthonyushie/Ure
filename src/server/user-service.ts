import { getPrisma } from "@/lib/prisma";

export type CreateUserInput = {
  walletAddress: string;
  displayName?: string;
};

export async function upsertUser(input: CreateUserInput) {
  const prisma = getPrisma();
  const walletAddress = input.walletAddress.trim();

  return prisma.user.upsert({
    where: { walletAddress },
    update: {
      displayName: input.displayName,
    },
    create: {
      walletAddress,
      displayName: input.displayName,
    },
  });
}

export async function listUsers(input: {
  walletAddress?: string;
  cursor?: string;
  limit: number;
}) {
  const prisma = getPrisma();
  const items = await prisma.user.findMany({
    where: input.walletAddress
      ? { walletAddress: input.walletAddress.trim() }
      : undefined,
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
