"use client";

/**
 * Client-side fetch utility for browser environments.
 *
 * - Uses fetch API
 * - Unwraps response envelope: { success, data, error, meta }
 * - Throws typed errors matching API error codes
 */

import type { ApiError, ErrorCode } from "./errors";

const API_V1_PREFIX = "/api/v1/";

type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
      error: null;
      meta: Record<string, unknown>;
    }
  | {
      success: false;
      data: null;
      error: ApiError;
      meta: Record<string, unknown>;
    };

class ApiClientError extends Error {
  code: ErrorCode;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.details = details;
  }
}

async function makeRequest<T>(url: string, options: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    // Network or other fetch errors - rethrow as-is
    throw error instanceof Error ? error : new Error(String(error));
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = await response.json();
  } catch {
    // If JSON parsing fails, throw generic error
    throw new ApiClientError(
      "INTERNAL_ERROR",
      `Invalid JSON response: ${response.statusText}`,
    );
  }

  if (!envelope.success) {
    throw new ApiClientError(
      envelope.error.code,
      envelope.error.message,
      envelope.error.details,
    );
  }

  return envelope.data;
}

/**
 * Generic POST request for client-side
 */
export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return makeRequest<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Generic PATCH request for client-side
 */
export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return makeRequest<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Generic GET request for client-side
 */
export async function apiGet<T>(url: string): Promise<T> {
  return makeRequest<T>(url, { method: "GET" });
}

// Re-export error class for consumers
export { ApiClientError };
