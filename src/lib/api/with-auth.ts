/**
 * Auth middleware for API routes.
 *
 * withAuth(handler, options?) wraps a Next.js route handler,
 * extracts the session from the HMAC-signed cookie, and optionally
 * enforces a specific role.
 *
 * Reuses getAuthSession() from src/lib/auth/session.ts.
 */

import { getAuthSession } from "@/lib/auth/session";
import type { AuthenticatedSession, AuthRole } from "@/modules/auth/types";

import { errorResponse, toResponse } from "./envelope";
import { ErrorCodes } from "./errors";
import { t } from "@/lib/translations";

export type AuthenticatedRequest = {
  session: AuthenticatedSession;
};

type NextRouteHandler = (
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
) => Promise<Response> | Response;

type AuthenticatedHandler = (
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
  auth: AuthenticatedRequest,
) => Promise<Response> | Response;

type WithAuthOptions = {
  requiredRole?: AuthRole;
};

export function withAuth(
  handler: AuthenticatedHandler,
  options?: WithAuthOptions,
): NextRouteHandler {
  return async (request, context) => {
    const session = await getAuthSession();

    if (!session) {
      return toResponse(
        errorResponse(
          ErrorCodes.UNAUTHORIZED,
          t.api.auth.authenticationRequired,
        ),
      );
    }

    if (options?.requiredRole && session.role !== options.requiredRole) {
      return toResponse(
        errorResponse(
          ErrorCodes.FORBIDDEN,
          t.api.auth.accessDeniedRequiredRole.replace("{role}", options.requiredRole),
        ),
      );
    }

    return handler(request, context, { session });
  };
}
