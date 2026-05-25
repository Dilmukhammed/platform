"use server";

/**
 * Server-side fetch utility for RSC (React Server Components).
 *
 * - Reads session cookie via `cookies()` from `next/headers`
 * - Forwards session cookie in `Cookie` header for `/api/v1/*` endpoints
 * - Unwraps response envelope: `{ success, data, error, meta }`
 * - Throws typed errors matching API error codes
 * - Supports generic type parameters and pagination
 */

import { cookies, headers } from "next/headers";
import type { ApiError, ErrorCode } from "./errors";
import type { PaginationMeta } from "./envelope";

const AUTH_COOKIE_NAME = "platform_auth_session";
const API_V1_PREFIX = "/api/v1/";
const DEFAULT_DEV_ORIGIN = "http://localhost:3030";

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

type PaginatedResult<T> = {
  data: T;
  meta: {
    pagination: PaginationMeta;
  };
};

type RequestOptions = {
  params?: Record<string, string>;
  paginated?: boolean;
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

async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE_NAME);
  return cookie?.value;
}

function isAbsoluteUrl(url: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url);
}

function getFirstHeaderValue(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

function normalizeOrigin(origin: string): string {
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

async function resolveRequestOrigin(): Promise<string> {
  try {
    const headerStore = await headers();
    const host =
      getFirstHeaderValue(headerStore.get("x-forwarded-host")) ??
      getFirstHeaderValue(headerStore.get("host"));

    if (host) {
      const protocol =
        getFirstHeaderValue(headerStore.get("x-forwarded-proto")) ??
        (process.env.NODE_ENV === "production" ? "https" : "http");

      return `${protocol}://${host}`;
    }
  } catch {
    // Fall back to environment-based origin resolution below.
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (appUrl) {
    return normalizeOrigin(appUrl);
  }

  if (process.env.VERCEL_URL) {
    return `https://${normalizeOrigin(process.env.VERCEL_URL)}`;
  }

  return DEFAULT_DEV_ORIGIN;
}

async function normalizeRequestUrl(url: string): Promise<string> {
  if (isAbsoluteUrl(url)) {
    return url;
  }

  return new URL(url, await resolveRequestOrigin()).toString();
}

function buildUrl(baseUrl: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }

  const url = new URL(baseUrl, "http://localhost");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.pathname + url.search;
}

async function makeRequest<T>(
  url: string,
  options: RequestInit,
  isPaginated: boolean = false,
): Promise<T | PaginatedResult<T>> {
  const sessionCookie = await getSessionCookie();
  const requestUrl = await normalizeRequestUrl(url);
  const parsedUrl = new URL(requestUrl);
  const isApiV1Endpoint = parsedUrl.pathname.startsWith(API_V1_PREFIX);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Forward session cookie for API v1 endpoints
  if (isApiV1Endpoint && sessionCookie) {
    headers.Cookie = `${AUTH_COOKIE_NAME}=${sessionCookie}`;
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(requestUrl, fetchOptions);
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

  if (isPaginated && envelope.meta.pagination) {
    return {
      data: envelope.data,
      meta: { pagination: envelope.meta.pagination as PaginationMeta },
    } as PaginatedResult<T>;
  }

  return envelope.data;
}

/**
 * Generic GET request
 */
export async function apiGet<T>(
  url: string,
  options?: RequestOptions,
): Promise<T>;
export async function apiGet<T>(
  url: string,
  options: RequestOptions & { paginated: true },
): Promise<PaginatedResult<T>>;
export async function apiGet<T>(
  url: string,
  options?: RequestOptions,
): Promise<T | PaginatedResult<T>> {
  const fullUrl = buildUrl(url, options?.params);
  return makeRequest<T>(
    fullUrl,
    { method: "GET" },
    options?.paginated ?? false,
  );
}

/**
 * Generic POST request
 */
export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  return makeRequest<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Promise<T>;
}

/**
 * Generic PUT request
 */
export async function apiPut<T>(url: string, body: unknown): Promise<T> {
  return makeRequest<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Promise<T>;
}

/**
 * Generic PATCH request
 */
export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return makeRequest<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Promise<T>;
}

/**
 * Generic DELETE request
 */
export async function apiDelete<T>(url: string): Promise<T> {
  return makeRequest<T>(url, { method: "DELETE" }) as Promise<T>;
}

// Re-export error class for consumers
export { ApiClientError };
