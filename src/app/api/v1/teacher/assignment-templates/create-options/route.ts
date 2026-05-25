/**
 * GET /api/v1/teacher/assignment-templates/create-options — Returns materials and tests
 * available for creating an assignment template.
 *
 * Queries materials that are either the teacher's own personal materials or
 * school-visible for the currently selected organization, plus tests.
 */

import { cookies } from "next/headers";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { getMaterialSchoolVisibilityStatesForOrganization } from "@/modules/materials/school-visibility";

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
          console.error("[teacher/assignment-templates/create-options] Membership check error:", membershipError);
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
          console.error("[teacher/assignment-templates/create-options] Fallback membership fetch error:", fetchError);
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

      // Query ALL active, non-deleted materials (not just org-scoped)
      const { data: allMaterials, error: materialsError } = await supabase
        .from("materials")
        .select("id, title, scope_type, owner_teacher_id")
        .eq("status", "active")
        .is("deleted_at", null);

      if (materialsError) {
        console.error("[teacher/assignment-templates/create-options] Materials error:", materialsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch available materials."),
        );
      }

      // Use canonical helper to determine school visibility for the selected org
      const materialIds = (allMaterials ?? []).map((m: { id: string }) => m.id);
      const visibilityStates = await getMaterialSchoolVisibilityStatesForOrganization(supabase, {
        materialIds,
        organizationId: selectedOrgId,
      });

      // Filter: owner's personal materials OR school-visible for selected org
      const eligibleMaterials = ((allMaterials ?? []) as Array<{ id: string; title: string; scope_type: string; owner_teacher_id: string | null }>).filter(
        (m) => {
          if (m.scope_type === "personal" && m.owner_teacher_id === session.userId) {
            return true;
          }
          return visibilityStates.get(m.id)?.isSchoolVisible === true;
        }
      );

      // Build test query: personal + org-scoped
      const testQuery = supabase
        .from("tests")
        .select("id, title")
        .is("deleted_at", null)
        .eq("status", "active")
        .or(
          `and(scope_type.eq.personal,owner_teacher_id.eq.${session.userId}),` +
          `and(scope_type.eq.organization,owner_organization_id.eq.${selectedOrgId})`,
        )
        .order("title", { ascending: true });

      const { data: tests, error: testsError } = await testQuery;

      if (testsError) {
        console.error("[teacher/assignment-templates/create-options] Tests error:", testsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch available tests."),
        );
      }

      // Get org name
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", selectedOrgId)
        .is("deleted_at", null)
        .maybeSingle();

      const organizationName = org?.name ?? null;

      return toResponse(
        successResponse({
          organizationId: selectedOrgId,
          organizationName,
          availableMaterials: eligibleMaterials
            .map((m: { id: string; title: string }) => ({
              id: m.id,
              title: m.title,
            }))
            .sort((a, b) => a.title.localeCompare(b.title)),
          availableTests: (tests ?? []).map((t: Record<string, unknown>) => ({
            id: t.id,
            title: t.title,
          })),
        }),
      );
    } catch (err) {
      console.error("[teacher/assignment-templates/create-options] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch create options."),
      );
    }
  },
  { requiredRole: "teacher" },
);
