import { normalizeWalletAddress } from "@/lib/auth-core";
import { bankNameForCode } from "@/lib/banks";
import { AppError } from "@/lib/errors";
import { getNombaClient } from "@/lib/nomba";
import { getPrisma } from "@/lib/prisma";

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length < 6) return "****";
  return `${accountNumber.slice(0, 3)}****${accountNumber.slice(-3)}`;
}

/** Shape returned to clients — never includes the full account number. */
function toPublic(account: {
  id: string;
  bankCode: string;
  bankName: string | null;
  accountNumberMasked: string;
  accountName: string;
  isPrimary: boolean;
  verifiedAt: Date | null;
}) {
  return {
    id: account.id,
    bankCode: account.bankCode,
    bankName: account.bankName,
    accountNumberMasked: account.accountNumberMasked,
    accountName: account.accountName,
    isPrimary: account.isPrimary,
    verified: Boolean(account.verifiedAt),
  };
}

/**
 * Add a payout bank account for the signed-in wallet. The account is verified
 * via Nomba's name lookup before saving, so payouts go to a confirmed account.
 */
export async function createBankAccount(input: {
  walletAddress: string;
  bankCode: string;
  accountNumber: string;
  makePrimary?: boolean;
}) {
  const prisma = getPrisma();
  const walletAddress = normalizeWalletAddress(input.walletAddress);

  const user = await prisma.user.upsert({
    where: { walletAddress },
    update: {},
    create: { walletAddress },
  });

  // Verify the account with the provider (mock returns a placeholder name).
  const lookup = await getNombaClient().lookupBankAccount({
    accountNumber: input.accountNumber,
    bankCode: input.bankCode,
  });
  if (!lookup) {
    throw new AppError(
      "BANK_ACCOUNT_UNVERIFIED",
      "Could not verify that bank account. Check the number and bank.",
      422,
    );
  }

  const existingCount = await prisma.bankAccount.count({
    where: { userId: user.id },
  });
  const isPrimary = Boolean(input.makePrimary) || existingCount === 0;

  const account = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.bankAccount.updateMany({
        where: { userId: user.id },
        data: { isPrimary: false },
      });
    }
    return tx.bankAccount.create({
      data: {
        userId: user.id,
        bankCode: input.bankCode,
        bankName: bankNameForCode(input.bankCode),
        accountNumber: input.accountNumber,
        accountNumberMasked: maskAccountNumber(input.accountNumber),
        accountName: lookup.accountName,
        isPrimary,
        verifiedAt: new Date(),
      },
    });
  });

  return toPublic(account);
}

export async function listBankAccounts(walletAddress: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { walletAddress: normalizeWalletAddress(walletAddress) },
    select: { id: true },
  });
  if (!user) {
    return [];
  }
  const accounts = await prisma.bankAccount.findMany({
    where: { userId: user.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });
  return accounts.map(toPublic);
}
