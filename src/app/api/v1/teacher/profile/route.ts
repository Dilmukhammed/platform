/**
 * PATCH /api/v1/teacher/profile — Update teacher profile.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().optional(),
});

export const PATCH = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = updateProfileSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid profile data.", undefined, validation.error.issues),
        );
      }

      const { displayName, avatarUrl } = validation.data;

      const updates: Record<string, string> = {};
      if (displayName) updates.display_name = displayName;
      if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

      if (Object.keys(updates).length === 0) {
        return toResponse(errorResponse(ErrorCodes.VALIDATION_ERROR, "No fields to update."));
      }

      const supabase = createServerClient();

      const { error } = await supabase
        .from("platform_users")
        .update(updates)
        .eq("id", session.userId);

      if (error) {
        console.error("[teacher/profile] Update error:", error);
        return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update profile."));
      }

      return toResponse(successResponse({ displayName, avatarUrl }));
    } catch (err) {
      console.error("[teacher/profile] Unexpected error:", err);
      return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update profile."));
    }
  },
  { requiredRole: "teacher" },
);
