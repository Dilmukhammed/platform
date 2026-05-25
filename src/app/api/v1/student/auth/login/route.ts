/**
 * POST /api/v1/student/auth/login — Student login via student_login + PIN.
 *
 * Validates credentials against student_profiles + student_credentials
 * tables in Supabase, then writes an HMAC-signed auth cookie.
 */

import { z } from "zod/v4";

import { writeAuthSession } from "@/lib/auth/session";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { authenticateStudent } from "@/modules/auth";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { comparePin, hashPin } from "@/lib/crypto/pin-hash";

const loginSchema = z.object({
  studentLogin: z.string().min(1, "Student login is required."),
  pin: z.string().min(1, "PIN is required."),
});

function normalizeStudentLogin(studentLogin: string) {
  return studentLogin.trim().toUpperCase();
}

function isMissingSupabaseEnvError(error: unknown) {
  return error instanceof Error && error.message.startsWith("Missing required environment variable:");
}

async function loginWithLocalBootstrap(input: { studentLogin: string; pin: string }) {
  const result = await authenticateStudent(input);

  if (!result.ok) {
    return toResponse(
      errorResponse(ErrorCodes.UNAUTHORIZED, result.error),
    );
  }

  await writeAuthSession(result.session);

  return toResponse(
    successResponse({
      authenticated: true,
      principal: {
        id: result.session.userId,
        type: "student",
        displayName: result.session.displayName,
      },
      role: "student",
    }),
  );
}

async function loginHandler(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      // Use the first validation error as the main message for better UX
      const firstError = details[0];
      const mainMessage = firstError 
        ? `${firstError.field === "studentLogin" ? "Student login" : firstError.field === "pin" ? "PIN" : firstError.field} ${firstError.message.toLowerCase()}`
        : "Invalid request body.";

      return toResponse(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          mainMessage,
          undefined,
          details,
        ),
      );
    }

    const { studentLogin, pin } = parsed.data;
    const normalizedLogin = normalizeStudentLogin(studentLogin);
    const normalizedPin = pin.trim();

    let supabase: ReturnType<typeof createServerClient>;

    try {
      supabase = createServerClient();
    } catch (error) {
      if (isMissingSupabaseEnvError(error)) {
        return loginWithLocalBootstrap({
          studentLogin: normalizedLogin,
          pin: normalizedPin,
        });
      }

      throw error;
    }

    // Query student_profiles joined with student_credentials
    const { data: profiles, error: profileError } = await supabase
      .from("student_profiles")
      .select("id, student_login, display_name, status, student_credentials(id, pin_hash, status)")
      .eq("student_login", normalizedLogin)
      .is("deleted_at", null)
      .limit(1);

    if (profileError) {
      console.error("[student-login] Supabase query error:", profileError);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Authentication service unavailable."),
      );
    }

    const profile = profiles?.[0];

    if (!profile || profile.status !== "active") {
      return toResponse(
        errorResponse(ErrorCodes.UNAUTHORIZED, "Student login or PIN is incorrect."),
      );
    }

    const credentials = (Array.isArray(profile.student_credentials) ? profile.student_credentials[0] : profile.student_credentials) as { id: string; pin_hash: string; status: string } | null | undefined;

    if (!credentials || credentials.status !== "active") {
      return toResponse(
        errorResponse(ErrorCodes.UNAUTHORIZED, "Student login or PIN is incorrect."),
      );
    }

    // Verify PIN using bcrypt (preferred) or legacy MD5
    const { matches, needsRehash } = await comparePin(normalizedPin, credentials.pin_hash);

    if (!matches) {
      return toResponse(
        errorResponse(ErrorCodes.UNAUTHORIZED, "Student login or PIN is incorrect."),
      );
    }

    // Rehash-on-login: if PIN matched using legacy MD5, upgrade to bcrypt
    if (needsRehash) {
      try {
        const newPinHash = await hashPin(normalizedPin);
        await supabase
          .from("student_credentials")
          .update({ pin_hash: newPinHash })
          .eq("id", credentials.id);
      } catch (rehashError) {
        // Log but don't fail login - user already authenticated
        console.error("[student-login] Failed to rehash PIN:", rehashError);
      }
    }

    // Write auth session cookie
    const authSession = {
      userId: profile.id,
      role: "student" as const,
      displayName: profile.display_name ?? normalizedLogin,
      loginIdentifier: normalizedLogin,
    };

    await writeAuthSession(authSession);

    return toResponse(
      successResponse({
        authenticated: true,
        principal: {
          id: profile.id,
          type: "student",
          displayName: authSession.displayName,
        },
        role: "student",
      }),
    );
  } catch (error) {
    console.error("[student-login] Unexpected error:", error);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Authentication failed."),
    );
  }
}

export const POST = rateLimitMiddleware(loginHandler);
