/**
 * GET /api/v1/teacher/tests/library — School-approved tests for the teacher's org.
 *
 * Returns org-scoped tests with an approved status from test_approvals.
 */

import { cookies } from "next/headers";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const SELECTED_ORG_COOKIE = "teacher_selected_org";

export const GET = withAuth(
  async (_request, _context, { session }) => {
    try {
      const cookieStore = await cookies();
      const cookieOrgId = cookieStore.get(SELECTED_ORG_COOKIE)?.value ?? null;

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
          console.error("[teacher/tests/library] Membership check error:", membershipError);
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
          console.error("[teacher/tests/library] Fallback membership fetch error:", fetchError);
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

      // Query org-scoped tests with approved status
      const { data: tests, error: testsError } = await supabase
        .from("tests")
        .select(
          `
          id,
          title,
          description,
          owner_teacher_id,
          test_questions!left(id),
          test_approvals!left(id, decision, created_at)
        `,
        )
        .eq("scope_type", "organization")
        .eq("owner_organization_id", selectedOrgId)
        .eq("status", "active")
        .is("deleted_at", null);

      if (testsError) {
        console.error("[teacher/tests/library] Supabase error:", testsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test library."),
        );
      }

      // Get teacher names for test owners
      const ownerTeacherIds = [...new Set(
        (tests ?? []).map((t: Record<string, unknown>) => t.owner_teacher_id).filter(Boolean)
      )] as string[];

      const teacherNames: Record<string, string> = {};
      if (ownerTeacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from("platform_users")
          .select("id, display_name")
          .in("id", ownerTeacherIds);

        for (const t of teachers ?? []) {
          teacherNames[t.id] = t.display_name;
        }
      }

      // Filter to only approved tests and transform
      const approvedTests = (tests ?? [])
        .filter((test: Record<string, unknown>) => {
          const approvals = (test.test_approvals as Array<Record<string, unknown>>) ?? [];
          return approvals.some((a) => a.decision === "approved");
        })
        .map((test: Record<string, unknown>) => {
          const approvals = (test.test_approvals as Array<Record<string, unknown>>) ?? [];
          const questions = (test.test_questions as Array<Record<string, unknown>>) ?? [];
          const approvedAt = approvals
            .filter((a) => a.decision === "approved")
            .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())[0]?.created_at ?? null;

          return {
            testId: test.id,
            title: test.title,
            description: test.description,
            ownerTeacherName: test.owner_teacher_id ? (teacherNames[test.owner_teacher_id as string] ?? null) : null,
            questionCount: questions.length,
            approvedAt,
          };
        });

      return toResponse(
        successResponse(approvedTests),
      );
    } catch (err) {
      console.error("[teacher/tests/library] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test library."),
      );
    }
  },
  { requiredRole: "teacher" },
);
