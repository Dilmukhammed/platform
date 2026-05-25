/**
 * POST /api/v1/auth/change-password — Change user password.
 *
 * Requires authentication. Validates current password, then updates
 * to the new password using Supabase Auth.
 *
 * Request body:
 * - currentPassword: string (required)
 * - newPassword: string (required, min 8 characters)
 * - confirmPassword: string (required, must match newPassword)
 */

import { z } from "zod/v4";

import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { getAuthSession } from "@/lib/auth/session";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await getAuthSession();
    if (!session) {
      return toResponse(
        errorResponse(ErrorCodes.UNAUTHORIZED, "Authentication required.", 401),
      );
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

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

    const { currentPassword, newPassword } = parsed.data;

    const supabase = createServerClient();

    // Get auth_user_id from platform_users (session.userId is platform_users.id)
    const { data: platformUser, error: platformError } = await supabase
      .from("platform_users")
      .select("auth_user_id")
      .eq("id", session.userId)
      .single();

    if (platformError || !platformUser?.auth_user_id) {
      console.error("[change-password] Error fetching platform user:", platformError);
      return toResponse(
        errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "User profile not found.", 404),
      );
    }

    // Get the user directly by ID using the admin API
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(platformUser.auth_user_id);

    if (authError || !authData?.user) {
      console.error("[change-password] Error fetching user:", authError);
      return toResponse(
        errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "User not found.", 404),
      );
    }

    const authUser = authData.user;
    if (!authUser.email) {
      return toResponse(
        errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "User email not found.", 404),
      );
    }

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: currentPassword,
    });

    if (signInError) {
      return toResponse(
        errorResponse(ErrorCodes.FORBIDDEN, "Current password is incorrect.", 403),
      );
    }

    // Update password using Supabase Auth admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      platformUser.auth_user_id,
      { password: newPassword },
    );

    if (updateError) {
      console.error("[change-password] Error updating password:", updateError);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update password."),
      );
    }

    return toResponse(
      successResponse({
        message: "Password updated successfully.",
      }),
    );
  } catch (error) {
    console.error("[change-password] Unexpected error:", error);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to change password."),
    );
  }
}
