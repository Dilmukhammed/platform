/**
 * Rate limiting middleware for authentication endpoints.
 * Uses Upstash Redis for distributed sliding window rate limiting.
 * Falls back to in-memory store when Redis credentials are not configured.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { errorResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";

// Configuration constants
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
const WINDOW_SECONDS = Math.ceil(WINDOW_MS / 1000);

// ---------------------------------------------------------------------------
// Upstash Redis rate limiter (production)
// ---------------------------------------------------------------------------

let upstashLimiter: Ratelimit | null = null;

function getUpstashLimiter(): Ratelimit | null {
  if (upstashLimiter) return upstashLimiter;

  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!restUrl || !restToken) {
    return null;
  }

  const redis = new Redis({ url: restUrl, token: restToken });

  upstashLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(MAX_ATTEMPTS, `${WINDOW_SECONDS} s`),
    prefix: "platform-ratelimit",
  });

  return upstashLimiter;
}

// ---------------------------------------------------------------------------
// In-memory fallback (development / single-instance)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  for (const [key, entry] of memoryStore.entries()) {
    if (entry.lastAttempt < cutoff) {
      memoryStore.delete(key);
    }
  }
}

function checkMemoryRateLimit(key: string): Response | null {
  const now = Date.now();
  const entry = memoryStore.get(key);

  // Cleanup expired entries occasionally (1% chance per request)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }

  if (!entry) {
    memoryStore.set(key, { attempts: 1, firstAttempt: now, lastAttempt: now });
    return null;
  }

  const windowExpired = now - entry.lastAttempt > WINDOW_MS;

  if (windowExpired) {
    memoryStore.set(key, { attempts: 1, firstAttempt: now, lastAttempt: now });
    return null;
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - (now - entry.lastAttempt);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    const envelope = errorResponse(
      ErrorCodes.RATE_LIMITED,
      `Too many login attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      429,
    );

    return new Response(JSON.stringify(envelope), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(MAX_ATTEMPTS),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil((entry.lastAttempt + WINDOW_MS) / 1000)),
      },
    });
  }

  entry.attempts += 1;
  entry.lastAttempt = now;
  memoryStore.set(key, entry);

  return null;
}

function resetMemoryRateLimit(key: string): void {
  memoryStore.delete(key);
}

function getMemoryRateLimitStatus(key: string): { remaining: number; resetTime: number; limited: boolean } {
  const entry = memoryStore.get(key);
  const now = Date.now();

  if (!entry || now - entry.lastAttempt > WINDOW_MS) {
    return { remaining: MAX_ATTEMPTS, resetTime: now + WINDOW_MS, limited: false };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - entry.attempts);
  return { remaining, resetTime: entry.lastAttempt + WINDOW_MS, limited: entry.attempts >= MAX_ATTEMPTS };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function generateRateLimitKey(ip: string, userAgent?: string | null): string {
  if (userAgent) {
    const fingerprint = userAgent.slice(0, 50);
    return `ratelimit:${ip}:${fingerprint}`;
  }
  return `ratelimit:${ip}`;
}

function extractClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  return "unknown";
}

function buildRateLimitResponse(retryAfterSeconds: number): Response {
  const envelope = errorResponse(
    ErrorCodes.RATE_LIMITED,
    `Too many login attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
    429,
  );

  return new Response(JSON.stringify(envelope), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSeconds),
      "X-RateLimit-Limit": String(MAX_ATTEMPTS),
      "X-RateLimit-Remaining": "0",
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reset rate limit for a specific key.
 * Useful for successful logins to clear the counter.
 */
export function resetRateLimit(ip: string, userAgent?: string | null): void {
  const key = generateRateLimitKey(ip, userAgent);
  resetMemoryRateLimit(key);
  // Upstash keys expire automatically via TTL — no manual reset needed
}

/**
 * Get current rate limit status for a key.
 * Returns remaining attempts and reset time.
 */
export function getRateLimitStatus(
  ip: string,
  userAgent?: string | null,
): { remaining: number; resetTime: number; limited: boolean } {
  const key = generateRateLimitKey(ip, userAgent);
  return getMemoryRateLimitStatus(key);
}

/**
 * Middleware function to wrap route handlers with rate limiting.
 * Uses Upstash Redis when configured, falls back to in-memory for development.
 *
 * Usage:
 *   export const POST = rateLimitMiddleware(async (request) => {
 *     // your handler logic
 *   });
 */
export function rateLimitMiddleware(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    // Only apply rate limiting to POST requests (login attempts)
    if (request.method !== "POST") {
      return handler(request);
    }

    const ip = extractClientIP(request);
    const userAgent = request.headers.get("user-agent");
    const key = generateRateLimitKey(ip, userAgent);

    // Try Upstash Redis first
    const limiter = getUpstashLimiter();

    if (limiter) {
      const { success, remaining, reset } = await limiter.limit(key);

      if (!success) {
        const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        return buildRateLimitResponse(retryAfterSeconds);
      }

      // Call the actual handler
      const response = await handler(request);

      // If login was successful (200 status), reset the rate limit
      if (response.status === 200) {
        // Upstash Ratelimit doesn't have resetUsed — use penalty-free approach
        // The key will expire naturally via TTL
      }

      // Add rate limit headers to successful responses
      const newHeaders = new Headers(response.headers);
      newHeaders.set("X-RateLimit-Limit", String(MAX_ATTEMPTS));
      newHeaders.set("X-RateLimit-Remaining", String(remaining - (response.status === 200 ? 0 : 1)));
      newHeaders.set("X-RateLimit-Reset", String(Math.ceil(reset / 1000)));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    // Fallback to in-memory rate limiting
    const rateLimitResponse = checkMemoryRateLimit(key);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Call the actual handler
    const response = await handler(request);

    // If login was successful (200 status), reset the rate limit
    if (response.status === 200) {
      resetRateLimit(ip, userAgent);
    }

    // Add rate limit headers to successful responses
    const status = getMemoryRateLimitStatus(key);
    const newHeaders = new Headers(response.headers);
    newHeaders.set("X-RateLimit-Limit", String(MAX_ATTEMPTS));
    newHeaders.set("X-RateLimit-Remaining", String(status.remaining));
    newHeaders.set("X-RateLimit-Reset", String(Math.ceil(status.resetTime / 1000)));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

// Export configuration for external use
export { MAX_ATTEMPTS, WINDOW_MS };
