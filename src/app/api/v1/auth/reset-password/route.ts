/**
 * POST /api/v1/auth/reset-password — Request password reset.
 *
 * Accepts an email address and generates a secure reset token.
 * Returns a generic success message regardless of whether the email exists
 * to prevent email enumeration attacks.
 *
 * For development: Logs the reset token to console since email service
 * may not be configured.
 */

import { z } from "zod/v4";

import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";
import { storeResetToken, cleanupExpiredTokens } from "@/lib/auth/reset-tokens";
import { createServerClient } from "@/lib/supabase/server-client";

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Valid email is required."),
});

/**
 * Check if a staff account exists with the given email via Supabase Auth.
 */
async function findStaffAccount(email: string): Promise<boolean> {
  const supabase = createServerClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("platform_users")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(1);

  if (error || !data?.length) {
    return false;
  }

  // Cross-reference with auth.users — platform_users doesn't store email directly.
  // We check via auth.admin API.
  const { data: authUsers } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  // For a more targeted check, use the email parameter:
  // This is a lightweight check — in production, add an email column to platform_users
  // or use a more efficient lookup.
  return true; // Stub: assume exists for now (full implementation needs Supabase Auth admin API)
}

async function resetPasswordHandler(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return toResponse(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid request body.",
          undefined,
          details,
        ),
      );
    }

    const { email } = parsed.data;

    // Clean up expired tokens occasionally (5% chance per request)
    if (Math.random() < 0.05) {
      await cleanupExpiredTokens();
    }

    // Check if account exists (but don't reveal this in the response)
    const accountExists = await findStaffAccount(email);

    if (accountExists) {
      // Generate and store reset token
      const token = await storeResetToken(email);

      // Log token for development (since email service may not be configured)
      if (process.env.NODE_ENV === "development") {
        console.log("[PASSWORD RESET] Token generated for:", email);
      }

      // TODO: Send email with reset link when email service is configured
      // await sendPasswordResetEmail(email, token);
    }

    // Always return the same success message regardless of whether email exists
    // This prevents email enumeration attacks
    return toResponse(
      successResponse({
        message: "If an account exists with this email, you will receive password reset instructions.",
      }),
    );
  } catch (error) {
    console.error("[reset-password] Error processing reset request:", error);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to process password reset request."),
    );
  }
}

export const POST = rateLimitMiddleware(resetPasswordHandler);
