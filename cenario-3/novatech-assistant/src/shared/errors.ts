export abstract class AppError extends Error {
  public readonly code: string;

  public readonly statusCode: number;

  protected constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public constructor(message = "Invalid request body") {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class BadRequestError extends AppError {
  public constructor(message = "Bad request") {
    super(message, "BAD_REQUEST", 400);
  }
}

export class NotFoundError extends AppError {
  public constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ExternalServiceError extends AppError {
  public constructor(message = "External service unavailable") {
    super(message, "EXTERNAL_SERVICE_ERROR", 502);
  }
}

export class InternalServerError extends AppError {
  public constructor(message = "Internal server error") {
    super(message, "INTERNAL_SERVER_ERROR", 500);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}