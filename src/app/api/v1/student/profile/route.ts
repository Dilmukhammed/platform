/**
 * GET /api/v1/student/profile — Get student profile.
 *
 * Returns the current student's profile information.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (_request, _context, { session }) => {
    try {
      const supabase = createServerClient();

      // Get student profile
      const { data: profile, error } = await supabase
        .from("student_profiles")
        .select(
          `
          id,
          student_login,
          first_name,
          last_name,
          middle_name,
          display_name,
          status,
          created_at,
          updated_at
        `,
        )
        .eq("id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        console.error("[student/profile] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch profile."),
        );
      }

      if (!profile) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Profile not found."),
        );
      }

      return toResponse(
        successResponse({
          id: profile.id,
          studentLogin: profile.student_login,
          firstName: profile.first_name,
          lastName: profile.last_name,
          middleName: profile.middle_name,
          displayName: profile.display_name,
          status: profile.status,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        }),
      );
    } catch (err) {
      console.error("[student/profile] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch profile."),
      );
    }
  },
  { requiredRole: "student" },
);

const updateSchema = z.object({
  displayName: z.string().min(1, "Display name is required.").max(100, "Display name too long."),
});

export const PATCH = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = updateSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid request body.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { displayName } = validation.data;
      const supabase = createServerClient();

      // Update profile
      const { data: updated, error } = await supabase
        .from("student_profiles")
        .update({
          display_name: displayName,
        })
        .eq("id", session.userId)
        .is("deleted_at", null)
        .select(
          `
          id,
          student_login,
          first_name,
          last_name,
          middle_name,
          display_name,
          status,
          updated_at
        `,
        )
        .single();

      if (error || !updated) {
        console.error("[student/profile/update] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update profile."),
        );
      }

      return toResponse(
        successResponse({
          id: updated.id,
          studentLogin: updated.student_login,
          firstName: updated.first_name,
          lastName: updated.last_name,
          middleName: updated.middle_name,
          displayName: updated.display_name,
          status: updated.status,
          updatedAt: updated.updated_at,
        }),
      );
    } catch (err) {
      console.error("[student/profile/update] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update profile."),
      );
    }
  },
  { requiredRole: "student" },
);
