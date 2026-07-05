import { apiError, apiSuccess, parseJsonBody } from "@/lib/api";
import { getSessionFromRequest } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";
import { createBankAccountSchema } from "@/lib/validation";
import {
  createBankAccount,
  listBankAccounts,
} from "@/server/bank-account-service";

/** Bank accounts are always scoped to the signed-in wallet (session), never a body value. */
export async function GET(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      throw new UnauthorizedError();
    }
    const accounts = await listBankAccounts(session.walletAddress);
    return apiSuccess({ accounts });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      throw new UnauthorizedError();
    }
    const body = createBankAccountSchema.parse(await parseJsonBody(request));
    const account = await createBankAccount({
      walletAddress: session.walletAddress,
      bankCode: body.bankCode,
      accountNumber: body.accountNumber,
      makePrimary: body.makePrimary,
    });
    return apiSuccess({ account }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
