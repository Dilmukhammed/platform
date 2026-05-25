/**
 * Next.js Middleware — Route-level auth safety net.
 *
 * Verifies the HMAC-signed session cookie ("platform_auth_session")
 * for all protected API and page routes, rejecting unauthenticated
 * or role-mismatched requests before they reach route handlers.
 *
 * Uses Web Crypto Subtle API (Edge-compatible) instead of Node crypto.
 * The session cookie format is: base64url({ v:1, session }).base64url(HMAC-SHA256(payload))
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Constants ────────────────────────────────────────────────────────
const AUTH_COOKIE_NAME = "platform_auth_session";
const SESSION_VERSION = 1;

// ─── Role / Area mapping ──────────────────────────────────────────────
// Matches resolveAreaAccess in src/modules/auth/service.ts
type AuthRole = "teacher" | "super_admin" | "student";
type ProtectedArea = "teacher" | "student" | "admin";

function expectedRoleForArea(area: ProtectedArea): AuthRole {
  return area === "admin" ? "super_admin" : area;
}

// ─── Edge-compatible HMAC verification ────────────────────────────────

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

function base64urlToBytes(base64url: string): Uint8Array {
  // Convert base64url → base64, pad, then decode via atob
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad === 2) base64 += "==";
  else if (pad === 3) base64 += "=";

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyHmac(
  secret: string,
  payload: string,
  signatureBase64Url: string,
): Promise<boolean> {
  const key = await importHmacKey(secret);
  const signatureBytes = base64urlToBytes(signatureBase64Url);
  const payloadBytes = new TextEncoder().encode(payload);
  return crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes);
}

function decodeBase64UrlText(base64url: string): string {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad === 2) base64 += "==";
  else if (pad === 3) base64 += "=";
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return atob(base64);
  }
}

// ─── Session parsing ──────────────────────────────────────────────────

type SessionEnvelope = {
  v: number;
  session: {
    userId: string;
    role: AuthRole;
    displayName: string;
    loginIdentifier: string;
  };
};

function parseSessionPayload(payload: string): SessionEnvelope["session"] | null {
  try {
    const decoded = decodeBase64UrlText(payload);
    const parsed = JSON.parse(decoded) as SessionEnvelope;
    if (parsed.v !== SESSION_VERSION || !parsed.session?.role) {
      return null;
    }
    return parsed.session;
  } catch {
    return null;
  }
}

// ─── Route matching ────────────────────────────────────────────────────

type AreaResult = { area: ProtectedArea; prefix: string } | null;

function matchProtectedArea(pathname: string): AreaResult {
  // API routes
  if (pathname.startsWith("/api/v1/teacher")) return { area: "teacher", prefix: "/api/v1/teacher" };
  if (pathname.startsWith("/api/v1/student")) return { area: "student", prefix: "/api/v1/student" };
  if (pathname.startsWith("/api/v1/admin")) return { area: "admin", prefix: "/api/v1/admin" };

  // Page routes — redirect to login instead of returning JSON
  if (pathname.startsWith("/teacher")) return { area: "teacher", prefix: "/teacher" };
  if (pathname.startsWith("/student")) return { area: "student", prefix: "/student" };
  if (pathname.startsWith("/admin")) return { area: "admin", prefix: "/admin" };

  return null;
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

// ─── Error responses ───────────────────────────────────────────────────

function unauthorizedJson(): NextResponse {
  return new NextResponse(
    JSON.stringify({
      success: false,
      data: null,
      error: { code: "UNAUTHORIZED", message: "Authentication required. Please log in." },
      meta: {},
    }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

function forbiddenJson(area: ProtectedArea): NextResponse {
  const expected = expectedRoleForArea(area);
  return new NextResponse(
    JSON.stringify({
      success: false,
      data: null,
      error: { code: "FORBIDDEN", message: `Access denied. Required role: ${expected}.` },
      meta: {},
    }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

function getAuthCookieSecret(): string | null {
  const secret = process.env.AUTH_COOKIE_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "development") {
    return "platform-architecture-dev-auth-secret";
  }

  return null;
}

function signInRedirect(request: NextRequest, area: ProtectedArea): NextResponse {
  const signInPath = area === "student"
    ? "/auth/student/login"
    : "/auth/teacher/sign-in";
  return NextResponse.redirect(new URL(signInPath, request.url));
}

// ─── Middleware entry ──────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const match = matchProtectedArea(pathname);
  if (!match) {
    return NextResponse.next();
  }

  const { area } = match;
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // No cookie → reject
  if (!cookie) {
    return isApiRoute(pathname) ? unauthorizedJson() : signInRedirect(request, area);
  }

  // Split "payload.signature"
  const dotIndex = cookie.indexOf(".");
  if (dotIndex === -1) {
    return isApiRoute(pathname) ? unauthorizedJson() : signInRedirect(request, area);
  }

  const payload = cookie.substring(0, dotIndex);
  const signature = cookie.substring(dotIndex + 1);

  // Verify HMAC
  const secret = getAuthCookieSecret();
  if (!secret) {
    return isApiRoute(pathname) ? unauthorizedJson() : signInRedirect(request, area);
  }

  let session: SessionEnvelope["session"] | null = null;
  try {
    const valid = await verifyHmac(secret, payload, signature);
    if (!valid) {
      return isApiRoute(pathname) ? unauthorizedJson() : signInRedirect(request, area);
    }
    session = parseSessionPayload(payload);
  } catch {
    return isApiRoute(pathname) ? unauthorizedJson() : signInRedirect(request, area);
  }

  if (!session) {
    return isApiRoute(pathname) ? unauthorizedJson() : signInRedirect(request, area);
  }

  // Role check
  const expected = expectedRoleForArea(area);
  if (session.role !== expected) {
    // For page routes, redirect to their own home instead of showing forbidden
    if (!isApiRoute(pathname)) {
      const homePath = session.role === "super_admin" ? "/admin"
        : session.role === "teacher" ? "/teacher"
        : "/student";
      return NextResponse.redirect(new URL(homePath, request.url));
    }
    return forbiddenJson(area);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/v1/teacher/:path*",
    "/api/v1/student/:path((?!auth/).*)*",
    "/api/v1/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    "/admin/:path*",
  ],
};
