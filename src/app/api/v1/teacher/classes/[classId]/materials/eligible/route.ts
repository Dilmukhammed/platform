/**
 * GET /api/v1/teacher/classes/{classId}/materials/eligible
 * Returns materials that can be added to a class:
 * - Teacher's own personal materials
 * - School-visible materials for any organization the teacher belongs to
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { getMaterialSchoolVisibilityStatesForOrganization } from "@/modules/materials/school-visibility";

// GET — List eligible materials for adding to a class
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

      const supabase = createServerClient();

      // Verify teacher is in class_teachers for this class
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id")
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) {
        console.error("[eligible-materials] Teacher check error:", teacherError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      // Get teacher's organization memberships
      const { data: memberships } = await supabase
        .from("organization_memberships")
        .select("organization_id")
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active");

      const orgIds = (memberships ?? []).map((m) => m.organization_id);

      // Query ALL active, non-deleted materials (not just org-scoped)
      type CandidateMaterial = {
        id: string;
        title: string;
        description: string | null;
        scope_type: string;
        owner_teacher_id: string | null;
        owner_organization_id: string | null;
        created_at: string;
        organizations: Array<{ name: string }> | null;
      };

      const { data: allMaterials, error: materialsError } = await supabase
        .from("materials")
        .select(
          `
          id,
          title,
          description,
          scope_type,
          owner_teacher_id,
          owner_organization_id,
          created_at,
          organizations ( name )
        `
        )
        .eq("status", "active")
        .is("deleted_at", null);

      if (materialsError) {
        console.error("[eligible-materials] Materials fetch error:", materialsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch materials."),
        );
      }

      const candidateMaterials = (allMaterials ?? []) as CandidateMaterial[];
      const candidateIds = candidateMaterials.map((m) => m.id);

      // Use canonical helper to determine school visibility for each org the teacher belongs to
      const visibilityMaps =
        orgIds.length > 0 && candidateIds.length > 0
          ? await Promise.all(
              orgIds.map((orgId) =>
                getMaterialSchoolVisibilityStatesForOrganization(supabase, {
                  materialIds: candidateIds,
                  organizationId: orgId,
                })
              )
            )
          : [];

      // A material is eligible if: (1) owner's personal material, OR (2) school-visible for any org
      const filteredMaterials = candidateMaterials.filter((m) => {
        if (m.scope_type === "personal" && m.owner_teacher_id === session.userId) {
          return true;
        }
        return visibilityMaps.some(
          (map) => map.get(m.id)?.isSchoolVisible === true
        );
      });

      // Get materials already linked to this class
      const { data: existingLinks } = await supabase
        .from("class_materials")
        .select("material_id")
        .eq("class_id", classId)
        .is("deleted_at", null);

      const linkedMaterialIds = new Set(
        (existingLinks ?? []).map((l) => l.material_id)
      );

      // Transform eligible materials
      const eligibleMaterials = filteredMaterials
        .map((m) => ({
          materialId: m.id,
          title: m.title,
          description: m.description,
          scopeType: m.scope_type,
          ownerName: m.organizations?.[0]?.name ?? null,
          isLinked: linkedMaterialIds.has(m.id),
          createdAt: m.created_at,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return toResponse(
        successResponse({
          data: eligibleMaterials,
        }),
      );
    } catch (err) {
      console.error("[eligible-materials] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch eligible materials."),
      );
    }
  },
  { requiredRole: "teacher" },
);
