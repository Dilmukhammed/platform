/**
 * GET /api/v1/teacher/publications — List teacher's publications.
 * POST /api/v1/teacher/publications — Create a new publication.
 */

import { cookies } from "next/headers";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const SELECTED_ORG_COOKIE = "teacher_selected_org";

// GET — List publications
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);

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
          console.error("[teacher/publications] Membership check error:", membershipError);
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
          console.error("[teacher/publications] Fallback membership fetch error:", fetchError);
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

      // Query publications for this teacher, filtered by selected organization
      // Get publications whose classes belong to the selected organization
      const { data: orgPubIds } = await supabase
        .from("assignment_publication_classes")
        .select("assignment_publication_id, classes!inner(organization_id)")
        .eq("classes.organization_id", selectedOrgId)
        .is("deleted_at", null);

      const orgPublicationIds = [...new Set((orgPubIds ?? []).map(p => p.assignment_publication_id))];

      if (orgPublicationIds.length === 0) {
        return toResponse(successResponse({
          publications: [],
          pagination: { offset: 0, pageSize: pagination.pageSize, total: 0 },
        }));
      }

      const { data: publications, error: pubError, count } = await supabase
        .from("assignment_publications")
        .select(
          `
          id,
          assignment_template_id,
          default_deadline,
          status,
          created_at,
          updated_at,
          assignment_templates!inner(id, title, description)
        `,
          { count: "exact" },
        )
        .eq("published_by_teacher_id", session.userId)
        .in("id", orgPublicationIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (pubError) {
        console.error("[teacher/publications] Supabase error:", pubError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch publications."),
        );
      }

      // Get publication classes count for each publication
      const publicationIds = (publications ?? []).map((p) => p.id);
      let classCounts: Record<string, number> = {};
      let materialCounts: Record<string, number> = {};
      let testCounts: Record<string, number> = {};

      if (publicationIds.length > 0) {
        // Get class counts
        const { data: pubClasses } = await supabase
          .from("assignment_publication_classes")
          .select("assignment_publication_id, class_id")
          .in("assignment_publication_id", publicationIds)
          .is("deleted_at", null);

        classCounts = (pubClasses ?? []).reduce((acc, pc) => {
          acc[pc.assignment_publication_id] = (acc[pc.assignment_publication_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Get linked materials count
        const { data: linkedMaterials } = await supabase
          .from("assignment_template_materials")
          .select("assignment_template_id, material_id")
          .in(
            "assignment_template_id",
            (publications ?? []).map((p) => p.assignment_template_id),
          )
          .is("deleted_at", null);

        materialCounts = (linkedMaterials ?? []).reduce((acc, lm) => {
          acc[lm.assignment_template_id] = (acc[lm.assignment_template_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Get linked tests count from assignment_templates.linked_test_id
        const templateIds = (publications ?? []).map((p) => p.assignment_template_id);
        const { data: templates } = await supabase
          .from("assignment_templates")
          .select("id, linked_test_id")
          .in("id", templateIds)
          .is("deleted_at", null);

        testCounts = (templates ?? []).reduce((acc, t) => {
          if (t.linked_test_id) {
            acc[t.id] = 1;
          }
          return acc;
        }, {} as Record<string, number>);
      }

      // Transform to response format
      const data = (publications ?? []).map((pub) => {
        const template = pub.assignment_templates as unknown as Record<string, unknown> | null;

        return {
          id: pub.id,
          templateId: pub.assignment_template_id,
          title: template?.title,
          description: template?.description,
          defaultDeadline: pub.default_deadline,
          classCount: classCounts[pub.id] || 0,
          linkedMaterialCount: materialCounts[pub.assignment_template_id] || 0,
          linkedTestCount: testCounts[pub.assignment_template_id] || 0,
          status: pub.status,
          createdAt: pub.created_at,
          updatedAt: pub.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(data, paginationMeta));
    } catch (err) {
      console.error("[teacher/publications] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch publications."),
      );
    }
  },
  { requiredRole: "teacher" },
);
