/**
 * Response envelope helpers for consistent API output shape.
 *
 * Canonical envelope: { success, data, error, meta }
 * - Success: { success: true, data, error: null, meta: {} }
 * - Error:   { success: false, data: null, error: { code, message, details? }, meta: {} }
 * - Paginated: success envelope with meta.pagination
 */

import {
  type ApiError,
  type ErrorCode,
  createApiError,
  HttpStatus,
} from "./errors";

export type SuccessEnvelope<T> = {
  success: true;
  data: T;
  error: null;
  meta: Record<string, unknown>;
};

export type ErrorEnvelope = {
  success: false;
  data: null;
  error: ApiError;
  meta: Record<string, unknown>;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
): SuccessEnvelope<T> {
  return {
    success: true,
    data,
    error: null,
    meta: meta ?? {},
  };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status?: number,
  details?: unknown,
): ErrorEnvelope {
  const httpStatus = status ?? HttpStatus[code];
  return {
    success: false,
    data: null,
    error: createApiError(code, message, details),
    meta: { httpStatus },
  };
}

export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  meta?: Record<string, unknown>,
): SuccessEnvelope<T[]> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      ...meta,
      pagination,
    },
  };
}

/**
 * Convert an error envelope to a Next.js Response object.
 */
export function toResponse(envelope: ErrorEnvelope): Response;
export function toResponse<T>(envelope: SuccessEnvelope<T>, status?: number): Response;
export function toResponse(envelope: ApiEnvelope<unknown>, status: number = 200): Response {
  const httpStatus =
    !envelope.success
      ? (envelope.meta.httpStatus as number) ?? 500
      : status;

  const metaCopy = { ...envelope.meta };

  if (!envelope.success) {
    delete metaCopy.httpStatus;
  }

  const body = {
    success: envelope.success,
    data: envelope.data,
    error: envelope.error,
    meta: metaCopy,
  };

  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { "Content-Type": "application/json" },
  });
}
