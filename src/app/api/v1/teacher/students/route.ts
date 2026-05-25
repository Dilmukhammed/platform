/**
 * GET /api/v1/teacher/students — Org-level student list (paginated).
 *
 * Returns students enrolled in classes belonging to the teacher's
 * currently selected organization.
 */

import { cookies } from "next/headers";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const SELECTED_ORG_COOKIE = "teacher_selected_org";

export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const cookieStore = await cookies();
      const cookieOrgId = cookieStore.get(SELECTED_ORG_COOKIE)?.value ?? null;

      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const supabase = createServerClient();

      let selectedOrgId: string | null = null;

      // If a cookie exists, verify the teacher still has an active membership
      if (cookieOrgId) {
        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("platform_user_id", session.userId)
          .eq("organization_id", cookieOrgId)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle();

        if (membershipError) {
          console.error("[teacher/students] Membership check error:", membershipError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
          );
        }

        if (membership) {
          selectedOrgId = cookieOrgId;
        }
      }

      // No cookie or stale cookie: fall back to first active membership
      if (!selectedOrgId) {
        const { data: firstMembership, error: fetchError } = await supabase
          .from("organization_memberships")
          .select("id, organization_id, role, status, organizations!inner(id, name, slug)")
          .eq("platform_user_id", session.userId)
          .eq("status", "active")
          .is("deleted_at", null)
          .is("organizations.deleted_at", null)
          .order("joined_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          console.error("[teacher/students] Fallback membership fetch error:", fetchError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organization membership."),
          );
        }

        if (!firstMembership) {
          return toResponse(
            errorResponse(ErrorCodes.VALIDATION_ERROR, "No organization selected. Please select an organization first."),
          );
        }

        selectedOrgId = firstMembership.organization_id;
      }

      // Query students through class enrollments in this org's classes
      const { data: enrollments, error, count } = await supabase
        .from("class_enrollments")
        .select(
          `
          id,
          status,
          joined_at,
          left_at,
          source,
          class_id,
          student_profiles!inner(
            id,
            student_login,
            first_name,
            last_name,
            middle_name,
            display_name,
            status
          ),
          classes!inner(
            id,
            title,
            organization_id
          )
        `,
          { count: "exact" },
        )
        .eq("organization_id", selectedOrgId)
        .is("deleted_at", null)
        .eq("status", "active")
        .order("joined_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/students] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch students."),
        );
      }

      // Transform to response format
      const students = (enrollments ?? []).map((enrollment: Record<string, unknown>) => {
        const profile = enrollment.student_profiles as unknown as Record<string, unknown> | null;
        const classInfo = enrollment.classes as unknown as Record<string, unknown> | null;
        return {
          enrollmentId: enrollment.id,
          studentProfileId: profile?.id,
          studentLogin: profile?.student_login,
          firstName: profile?.first_name,
          lastName: profile?.last_name,
          middleName: profile?.middle_name,
          displayName: profile?.display_name,
          studentStatus: profile?.status,
          enrollmentStatus: enrollment.status,
          classId: enrollment.class_id,
          className: classInfo?.title,
          joinedAt: enrollment.joined_at,
          leftAt: enrollment.left_at,
          source: enrollment.source,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(students, paginationMeta));
    } catch (err) {
      console.error("[teacher/students] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch students."),
      );
    }
  },
  { requiredRole: "teacher" },
);
