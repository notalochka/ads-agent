export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { statusCode?: number; code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, { statusCode: 400, code: "VALIDATION_ERROR", details });
    this.name = "ValidationError";
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(`${service}: ${message}`, {
      statusCode: 502,
      code: "EXTERNAL_SERVICE_ERROR",
      details,
    });
    this.name = "ExternalServiceError";
  }
}

export class RefusalError extends AppError {
  constructor(message: string) {
    super(message, { statusCode: 403, code: "REFUSED" });
    this.name = "RefusalError";
  }
}

export class TimeoutError extends AppError {
  constructor(message = "Operation timed out", details?: unknown) {
    super(message, { statusCode: 504, code: "TIMEOUT", details });
    this.name = "TimeoutError";
  }
}
