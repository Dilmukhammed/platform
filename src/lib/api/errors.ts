/**
 * API error codes and typed error factory.
 *
 * Error object shape: { code, message, details? }
 * These codes map to standard HTTP status codes used across all API routes.
 */

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export type ApiError = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

export const HttpStatus: Record<ErrorCode, number> = {
  [ErrorCodes.VALIDATION_ERROR]: 422,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.INTERNAL_ERROR]: 500,
};

export function createApiError(
  code: ErrorCode,
  message: string,
  details?: unknown,
): ApiError {
  return { code, message, ...(details !== undefined && { details }) };
}
