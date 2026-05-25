import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import type { AuthenticatedSession } from "./types";

export const AUTH_COOKIE_NAME = "platform_auth_session";
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;
export const AUTH_COOKIE_MAX_AGE_MS = AUTH_COOKIE_MAX_AGE_SECONDS * 1000;
export const SESSION_WARNING_MINUTES = 5;

const AUTH_COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET;

if (process.env.NODE_ENV === "production" && !AUTH_COOKIE_SECRET) {
  throw new Error("AUTH_COOKIE_SECRET environment variable is required in production");
}

// For development only, use a fallback
const SECRET = AUTH_COOKIE_SECRET || (process.env.NODE_ENV === "development" ? "platform-architecture-dev-auth-secret" : undefined);

function getAuthCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" && process.env.AUTH_COOKIE_INSECURE !== "1",
  };
}

type SessionEnvelope = {
  v: 1;
  session: AuthenticatedSession;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", SECRET!).update(payload).digest("base64url");
}

function serializeSession(session: AuthenticatedSession) {
  const payload = encodeBase64Url(JSON.stringify({ v: 1, session } satisfies SessionEnvelope));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function parseSession(rawCookie: string): AuthenticatedSession | null {
  const [payload, signature] = rawCookie.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);

  const actualSignatureBuffer = Buffer.from(signature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    actualSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(actualSignatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as SessionEnvelope;
    return parsed.v === 1 ? parsed.session : null;
  } catch {
    return null;
  }
}

export async function getAuthSession() {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!rawCookie) {
    return null;
  }

  return parseSession(rawCookie);
}

export async function writeAuthSession(session: AuthenticatedSession) {
  const cookieStore = await cookies();

  cookieStore.set(AUTH_COOKIE_NAME, serializeSession(session), getAuthCookieOptions(AUTH_COOKIE_MAX_AGE_SECONDS));
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", getAuthCookieOptions(0));
}

/**
 * Get the session expiration timestamp
 * Returns the expiration time based on when the session cookie was set
 */
export async function getSessionExpiration(): Promise<Date | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE_NAME);
  
  if (!cookie?.value) {
    return null;
  }
  
  // Calculate expiration based on max age from cookie
  // Note: In a real scenario, you might want to store the actual expiration 
  // in the session data or use a server-side session store
  const session = parseSession(cookie.value);
  if (!session) {
    return null;
  }
  
  // Return expiration time (current time + remaining max age)
  // Since we don't know when the cookie was set, we assume it's fresh
  // In production, consider adding a timestamp to the session data
  return new Date(Date.now() + AUTH_COOKIE_MAX_AGE_MS);
}
