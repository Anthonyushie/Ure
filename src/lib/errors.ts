export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} was not found.`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required.") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource.") {
    super("FORBIDDEN", message, 403);
  }
}

export class IntegrationNotConfiguredError extends AppError {
  constructor(integration: string) {
    super(
      "INTEGRATION_NOT_CONFIGURED",
      `${integration} integration is not configured for this phase.`,
      501,
    );
  }
}
