/**
 * GET /api/v1/student/classes/{classId}/materials — Get materials for a class.
 *
 * Returns materials added to a class the student is enrolled in.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  classId: z.string().uuid("Invalid class ID format."),
});

export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const validation = paramsSchema.safeParse(params);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid class ID.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { classId } = validation.data;
      const supabase = createServerClient();

      // Verify student is enrolled in this class
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("class_enrollments")
        .select("id")
        .eq("student_profile_id", session.userId)
        .eq("class_id", classId)
        .is("deleted_at", null)
        .maybeSingle();

      if (enrollmentError) {
        console.error("[student/classes/classId/materials] Enrollment check error:", enrollmentError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify enrollment."),
        );
      }

      if (!enrollment) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Class not found or you are not enrolled."),
        );
      }

      // Query class_materials joined with materials
      const { data: classMaterials, error: materialsError } = await supabase
        .from("class_materials")
        .select(
          `
          id,
          added_at,
          materials(
            id,
            title,
            description,
            deleted_at
          )
        `,
        )
        .eq("class_id", classId)
        .is("deleted_at", null);

      if (materialsError) {
        console.error("[student/classes/classId/materials] Materials query error:", materialsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch materials."),
        );
      }

      // Transform response
      const data = (classMaterials ?? []).map((cm: Record<string, unknown>) => {
        const material = cm.materials as unknown as Record<string, unknown> | null;
        return {
          materialId: material?.id,
          title: material?.title,
          description: material?.description ?? null,
          isAvailable: material?.deleted_at === null,
          addedAt: cm.added_at,
        };
      });

      return toResponse(
        successResponse({ data }),
      );
    } catch (err) {
      console.error("[student/classes/classId/materials] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch materials."),
      );
    }
  },
  { requiredRole: "student" },
);
