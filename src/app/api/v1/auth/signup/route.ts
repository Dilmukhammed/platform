/**
 * POST /api/v1/auth/signup — Teacher registration endpoint.
 *
 * Creates a new teacher account:
 * 1. Validates request body (name, email, password, confirmPassword)
 * 2. Checks for duplicate email in auth.users
 * 3. Creates auth user in Supabase Auth (handles password hashing internally)
 * 4. Creates platform_users record with role="teacher", status="active"
 * 5. Returns 201 Created on success
 */

import { z } from "zod/v4";

import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

function isMissingSupabaseEnvError(error: unknown) {
  return error instanceof Error && error.message.startsWith("Missing required environment variable:");
}

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

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

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    let supabase: ReturnType<typeof createServerClient>;
    try {
      supabase = createServerClient();
    } catch (error) {
      if (isMissingSupabaseEnvError(error)) {
        console.error("[signup] Supabase not configured:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Registration service is not available. Please contact support."),
        );
      }
      throw error;
    }

    // Check if email already exists by listing users from auth admin API
    // Use pagination to handle large user bases
    let existingUser = null;
    let page = 1;
    const perPage = 100;
    
    while (!existingUser) {
      const { data: userList, error: listError } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      
      if (listError) {
        console.error("[signup] Error listing users:", listError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify email availability."),
        );
      }
      
      if (!userList?.users?.length) {
        break;
      }
      
      existingUser = userList.users.find(
        (user) => user.email?.toLowerCase() === normalizedEmail
      );
      
      if (userList.users.length < perPage) {
        break;
      }
      
      page++;
    }

    if (existingUser) {
      return toResponse(
        errorResponse(ErrorCodes.CONFLICT, "An account with this email already exists."),
      );
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true, // Auto-confirm email for now (no email verification flow)
      user_metadata: {
        display_name: name,
      },
    });

    if (authError) {
      // Handle specific Supabase error for duplicate email
      if (authError.message?.includes("already been registered") || authError.code === "email_exists") {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "An account with this email already exists."),
        );
      }
      console.error("[signup] Error creating auth user:", authError);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create user account."),
      );
    }

    if (!authData?.user) {
      console.error("[signup] No user returned from auth creation");
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create user account."),
      );
    }

    // Create platform_users record
    const { error: platformUserError } = await supabase
      .from("platform_users")
      .insert({
        auth_user_id: authData.user.id,
        role: "teacher",
        status: "active",
        display_name: name,
      });

    if (platformUserError) {
      console.error("[signup] Error creating platform_users record:", platformUserError);
      
      // Attempt to clean up the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create teacher profile."),
      );
    }

    return toResponse(
      successResponse({
        message: "Account created successfully.",
        user: {
          id: authData.user.id,
          email: normalizedEmail,
          displayName: name,
          role: "teacher",
        },
      }),
      201,
    );
  } catch (error) {
    console.error("[signup] Unexpected error:", error);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Account creation failed."),
    );
  }
}
