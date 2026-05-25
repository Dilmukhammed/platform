/**
 * GET /api/v1/teacher/materials/library — School-visible materials for the teacher's org.
 *
 * Uses the canonical visibility predicate to include both org-scoped materials
 * and approved personal submissions for the selected org.
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
          console.error("[teacher/materials/library] Membership check error:", membershipError);
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
          console.error("[teacher/materials/library] Fallback membership fetch error:", fetchError);
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
      const { data: materials, error: materialsError } = await supabase
        .from("materials")
        .select("id, title, description, owner_teacher_id")
        .eq("status", "active")
        .is("deleted_at", null);

      if (materialsError) {
        console.error("[teacher/materials/library] Supabase error:", materialsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch material library."),
        );
      }

      // Use canonical helper to determine school visibility for the selected org
      const materialIds = (materials ?? []).map((m: { id: string }) => m.id);
      const visibilityStates = await getMaterialSchoolVisibilityStatesForOrganization(supabase, {
        materialIds,
        organizationId: selectedOrgId,
      });

      // Filter to only school-visible materials
      const schoolVisibleMaterials = (materials ?? []).filter(
        (m: { id: string }) => visibilityStates.get(m.id)?.isSchoolVisible === true,
      );

      // Get teacher names for material owners
      const ownerTeacherIds = [...new Set(
        schoolVisibleMaterials
          .map((m: { owner_teacher_id: string | null }) => m.owner_teacher_id)
          .filter(Boolean),
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

      // Get organization name
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", selectedOrgId)
        .single();

      const organizationName = org?.name ?? "Unknown Organization";

      // Transform response to match expected structure
      const responseMaterials = schoolVisibleMaterials.map(
        (material: { id: string; title: string; description: string | null; owner_teacher_id: string | null }) => {
          const state = visibilityStates.get(material.id);
          return {
            materialId: material.id,
            title: material.title,
            description: material.description,
            organizationName,
            ownerTeacherId: material.owner_teacher_id ?? "",
            ownerTeacherName: material.owner_teacher_id
              ? (teacherNames[material.owner_teacher_id] ?? null)
              : null,
            approvedAt: state?.latestApproval?.reviewedAt ?? state?.latestApproval?.createdAt ?? "",
          };
        },
      );

      return toResponse(
        successResponse(responseMaterials),
      );
    } catch (err) {
      console.error("[teacher/materials/library] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch material library."),
      );
    }
  },
  { requiredRole: "teacher" },
);
