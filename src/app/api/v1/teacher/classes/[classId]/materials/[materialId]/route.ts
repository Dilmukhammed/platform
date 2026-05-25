/**
 * DELETE /api/v1/teacher/classes/{classId}/materials/{materialId} — Remove material from class.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

// DELETE — Remove material from class (soft delete)
export const DELETE = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;
      const materialId = params.materialId as string;

      // Validate UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(classId)) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid class ID format."),
        );
      }
      if (!uuidRegex.test(materialId)) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid material ID format."),
        );
      }

      const supabase = createServerClient();

      // Verify teacher is in class_teachers
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id")
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) {
        console.error("[teacher/class/materials] Teacher check error:", teacherError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      // Check if the class_materials record exists
      const { data: classMaterial, error: materialError } = await supabase
        .from("class_materials")
        .select("id, material_id")
        .eq("class_id", classId)
        .eq("material_id", materialId)
        .is("deleted_at", null)
        .maybeSingle();

      if (materialError) {
        console.error("[teacher/class/materials] Material check error:", materialError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to check material link."),
        );
      }

      if (!classMaterial) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not found in this class."),
        );
      }

      // Soft delete the class_materials record
      const { error: deleteError } = await supabase
        .from("class_materials")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", classMaterial.id);

      if (deleteError) {
        console.error("[teacher/class/materials] Delete error:", deleteError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to remove material from class."),
        );
      }

      return toResponse(
        successResponse({
          message: "Material removed from class successfully.",
          materialId: materialId,
        }),
      );
    } catch (err) {
      console.error("[teacher/class/materials] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to remove material from class."),
      );
    }
  },
  { requiredRole: "teacher" },
);
