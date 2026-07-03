import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { serializeJson } from "@/lib/serialize";
import type { ApiError, ApiSuccess } from "@/types/api";

export function apiSuccess<T>(data: T, init?: ResponseInit): Response {
  const body: ApiSuccess<unknown> = {
    ok: true,
    data: serializeJson(data),
  };

  return Response.json(body, init);
}

export function apiError(error: unknown): Response {
  if (error instanceof AppError) {
    const body: ApiError = {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };

    return Response.json(body, { status: error.status });
  }

  if (error instanceof ZodError) {
    const body: ApiError = {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: error.flatten(),
      },
    };

    return Response.json(body, { status: 422 });
  }

  const body: ApiError = {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    },
  };

  return Response.json(body, { status: 500 });
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }
}
