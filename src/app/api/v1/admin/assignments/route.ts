/**
 * GET /api/v1/admin/assignments — List all assignment templates.
 */

import { withAuth } from "@/lib/api/with-auth";
import { paginatedResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (request) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const status = searchParams.get("status");

      const supabase = createServerClient();

      let query = supabase
        .from("assignment_templates")
        .select(
          `
          id,
          teacher_id,
          title,
          description,
          has_practice,
          has_test,
          linked_test_id,
          status,
          created_at,
          updated_at,
          platform_users!assignment_templates_teacher_id_fkey (
            id,
            email,
            display_name
          ),
          assignment_template_materials (
            id,
            material_id
          )
        `,
          { count: "exact" },
        )
        .is("deleted_at", null);

      // Filter by status if provided
      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data: templates, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[admin/assignments] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment templates."),
        );
      }

      // Transform to response format
      const formattedTemplates = (templates ?? []).map((template: Record<string, unknown>) => {
        const teacher = template.platform_users as Record<string, unknown> | null;
        const materials = template.assignment_template_materials as Array<Record<string, unknown>> | null;

        return {
          templateId: template.id,
          teacherId: template.teacher_id,
          teacherName: teacher?.display_name ?? "Unknown",
          teacherEmail: teacher?.email ?? "Unknown",
          title: template.title,
          description: template.description,
          hasPractice: template.has_practice,
          hasTest: template.has_test,
          linkedTestId: template.linked_test_id,
          status: template.status,
          linkedMaterialCount: materials?.length ?? 0,
          createdAt: template.created_at,
          updatedAt: template.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(formattedTemplates, paginationMeta));
    } catch (err) {
      console.error("[admin/assignments] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment templates."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
