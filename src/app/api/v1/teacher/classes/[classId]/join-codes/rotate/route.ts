/**
 * POST /api/v1/teacher/classes/{classId}/join-codes/rotate — Generate new join code.
 *
 * Creates a new join code and deactivates the old one.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

      const supabase = createServerClient();

      // Verify teacher has access to this class
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id, role, is_primary")
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) {
        console.error("[teacher/join-codes/rotate] Teacher check error:", teacherError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      // Only primary owners can rotate join codes
      if (!classTeacher.is_primary) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Only primary owners can rotate join codes."),
        );
      }

      // Get current active code
      const { data: currentCode, error: currentError } = await supabase
        .from("class_join_codes")
        .select("id, code")
        .eq("class_id", classId)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

      if (currentError) {
        console.error("[teacher/join-codes/rotate] Current code query error:", currentError);
      }

      // Generate new join code
      const newCode = generateJoinCode();

      // Deactivate old code FIRST (before inserting new) to avoid race condition
      // with unique index class_join_codes_active_class_idx
      if (currentCode) {
        const { error: updateError } = await supabase
          .from("class_join_codes")
          .update({
            status: "revoked",
            replaced_by_join_code_id: null, // can't reference new code yet
            rotated_by_platform_user_id: session.userId,
            rotated_at: new Date().toISOString(),
          })
          .eq("id", currentCode.id);

        if (updateError) {
          console.error("[teacher/join-codes/rotate] Deactivation error:", updateError);
        }
      }

      // Create new join code
      const { data: newJoinCode, error: createError } = await supabase
        .from("class_join_codes")
        .insert({
          class_id: classId,
          code: newCode,
          status: "active",
        })
        .select("id, code, status, valid_from, created_at")
        .single();

      if (createError || !newJoinCode) {
        console.error("[teacher/join-codes/rotate] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create new join code."),
        );
      }

      // Update old code with reference to new code (now that new code exists)
      if (currentCode) {
        await supabase
          .from("class_join_codes")
          .update({
            replaced_by_join_code_id: newJoinCode.id,
          })
          .eq("id", currentCode.id);
      }

      return toResponse(
        successResponse({
          classId,
          previousCode: currentCode
            ? {
                joinCodeId: currentCode.id,
                code: currentCode.code,
              }
            : null,
          newCode: {
            joinCodeId: newJoinCode.id,
            code: newJoinCode.code,
            status: newJoinCode.status,
            validFrom: newJoinCode.valid_from,
            createdAt: newJoinCode.created_at,
          },
          rotatedAt: new Date().toISOString(),
          rotatedBy: session.userId,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/join-codes/rotate] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to rotate join code."),
      );
    }
  },
  { requiredRole: "teacher" },
);

import { randomBytes } from "crypto";

/**
 * Generate a cryptographically secure random 6-digit join code.
 */
function generateJoinCode(): string {
  const bytes = randomBytes(3);
  const code = bytes.readUIntBE(0, 3) % 900000 + 100000;
  return code.toString();
}
