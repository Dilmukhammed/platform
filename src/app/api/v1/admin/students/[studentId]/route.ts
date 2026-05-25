/**
 * GET /api/v1/admin/students/{studentId} — Get student details.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (request, context) => {
    try {
      const params = await context.params;
      const studentId = params.studentId as string;

      const supabase = createServerClient();

      // Fetch student details
      const { data: student, error: studentError } = await supabase
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
        .eq("id", studentId)
        .is("deleted_at", null)
        .single();

      if (studentError || !student) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Student not found."),
        );
      }

      // Fetch organization memberships
      const { data: orgStudents, error: orgError } = await supabase
        .from("organization_students")
        .select(
          `
          id,
          status,
          joined_at,
          organizations!inner(
            id,
            name,
            slug,
            status
          )
        `,
        )
        .eq("student_profile_id", studentId)
        .is("deleted_at", null);

      if (orgError) {
        console.error("[admin/students/detail] Organization error:", orgError);
      }

      // Fetch class enrollments
      const { data: enrollments, error: enrollmentError } = await supabase
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
            status,
            organization_id
          )
        `,
        )
        .eq("student_profile_id", studentId)
        .is("deleted_at", null);

      if (enrollmentError) {
        console.error("[admin/students/detail] Enrollment error:", enrollmentError);
      }

      // Format organization memberships
      const formattedOrganizations = (orgStudents ?? []).map((orgStudent: Record<string, unknown>) => {
        const org = (Array.isArray(orgStudent.organizations) ? orgStudent.organizations[0] : orgStudent.organizations) as Record<string, unknown> | null | undefined;
        return {
          organizationStudentId: orgStudent.id,
          organizationId: org?.id,
          organizationName: org?.name,
          organizationSlug: org?.slug,
          organizationStatus: org?.status,
          status: orgStudent.status,
          joinedAt: orgStudent.joined_at,
        };
      });

      // Format class enrollments
      const formattedEnrollments = (enrollments ?? []).map((enrollment: Record<string, unknown>) => {
        const cls = (Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes) as Record<string, unknown> | null | undefined;
        return {
          enrollmentId: enrollment.id,
          classId: cls?.id,
          classTitle: cls?.title,
          classStatus: cls?.status,
          organizationId: cls?.organization_id,
          status: enrollment.status,
          joinedAt: enrollment.joined_at,
          leftAt: enrollment.left_at,
          source: enrollment.source,
        };
      });

      return toResponse(
        successResponse({
          studentId: student.id,
          studentLogin: student.student_login,
          firstName: student.first_name,
          lastName: student.last_name,
          middleName: student.middle_name,
          displayName: student.display_name,
          status: student.status,
          organizations: formattedOrganizations,
          enrollments: formattedEnrollments,
          createdAt: student.created_at,
          updatedAt: student.updated_at,
        }),
      );
    } catch (err) {
      console.error("[admin/students/detail] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch student details."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
