/**
 * GET /api/v1/student/classes/{classId} — Get single class detail.
 *
 * Returns detailed information about a specific class the student is enrolled in.
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

      // Verify enrollment and get class details
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("class_enrollments")
        .select(
          `
          id,
          status,
          joined_at,
          left_at,
          source,
          classes!inner(
            id,
            title,
            description,
            status,
            organization_id,
            created_at
          )
        `,
        )
        .eq("student_profile_id", session.userId)
        .eq("class_id", classId)
        .is("deleted_at", null)
        .is("classes.deleted_at", null)
        .maybeSingle();

      if (enrollmentError) {
        console.error("[student/classes/classId] Supabase error:", enrollmentError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch class details."),
        );
      }

      if (!enrollment) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Class not found or you are not enrolled."),
        );
      }

      // Supabase JS v2: many-to-one join returns single object, not array
      const classData = enrollment.classes as unknown as Record<string, unknown> | null;

      // Get teachers for this class
      const { data: teachers, error: teachersError } = await supabase
        .from("class_teachers")
        .select(
          `
          id,
          role,
          is_primary,
          platform_users!inner(
            id,
            display_name
          )
        `,
        )
        .eq("class_id", classId)
        .is("deleted_at", null)
        .eq("status", "active");

      if (teachersError) {
        console.error("[student/classes/classId] Teachers query error:", teachersError);
      }

      const teacherList = (teachers ?? []).map((t: Record<string, unknown>) => {
        // Supabase JS v2: many-to-one join returns single object, not array
        const user = t.platform_users as unknown as Record<string, unknown> | null;
        return {
          id: t.id,
          userId: user?.id,
          displayName: user?.display_name,
          role: t.role,
          isPrimary: t.is_primary,
        };
      });

      return toResponse(
        successResponse({
          enrollmentId: enrollment.id,
          classId: classData?.id,
          title: classData?.title,
          description: classData?.description,
          status: enrollment.status,
          classStatus: classData?.status,
          organizationId: classData?.organization_id,
          joinedAt: enrollment.joined_at,
          leftAt: enrollment.left_at,
          source: enrollment.source,
          teachers: teacherList,
        }),
      );
    } catch (err) {
      console.error("[student/classes/classId] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch class details."),
      );
    }
  },
  { requiredRole: "student" },
);
