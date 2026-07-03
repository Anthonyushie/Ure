import { apiError, apiSuccess, parseJsonBody } from "@/lib/api";
import { createUserSchema, listUsersQuerySchema } from "@/lib/validation";
import { listUsers, upsertUser } from "@/server/user-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = listUsersQuerySchema.parse(
      Object.fromEntries(searchParams.entries()),
    );
    const users = await listUsers(query);

    return apiSuccess(users);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createUserSchema.parse(await parseJsonBody(request));
    const user = await upsertUser(body);

    return apiSuccess(user, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
