/**
 * GET /api/v1/teacher/assignment-publications — List teacher's assignment publications.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

// GET — List assignment publications
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const statusFilter = searchParams.get("status"); // optional filter: draft | published | archived
      const templateIdFilter = searchParams.get("templateId"); // optional filter by template
      const classIdFilter = searchParams.get("classId"); // optional filter by class

      const supabase = createServerClient();

      // When filtering by classId, use inner join on publication_classes to only return
      // publications that target this specific class; otherwise left join to include all.
      const classJoinHint = classIdFilter ? "inner" : "left";

      // Build base query - publications by this teacher
      let query = supabase
        .from("assignment_publications")
        .select(
          `*,
          assignment_templates!inner(id, title, teacher_id, has_practice, has_test),
          assignment_publication_classes!${classJoinHint}(id, class_id, deadline_override, status)`,
          { count: "exact" }
        )
        .eq("published_by_teacher_id", session.userId)
        .is("deleted_at", null);

      // Apply status filter if provided
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      // Apply template filter if provided
      if (templateIdFilter) {
        query = query.eq("assignment_template_id", templateIdFilter);
      }

      // Apply classId filter if provided
      if (classIdFilter) {
        query = query.eq("assignment_publication_classes.class_id", classIdFilter);
      }

      const { data: publications, error, count } = await query
        .order("published_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/assignment-publications] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment publications."),
        );
      }

      // Transform to response format
      const transformed = (publications ?? []).map((pub: Record<string, unknown>) => {
        const template = pub.assignment_templates as Record<string, unknown>;
        const classes = (pub.assignment_publication_classes as Array<Record<string, unknown>>) ?? [];

        return {
          publicationId: pub.id,
          templateId: pub.assignment_template_id,
          templateTitle: template?.title,
          hasPractice: template?.has_practice ?? false,
          hasTest: template?.has_test ?? false,
          publishedByTeacherId: pub.published_by_teacher_id,
          defaultDeadline: pub.default_deadline,
          status: pub.status,
          publishedAt: pub.published_at,
          createdAt: pub.created_at,
          updatedAt: pub.updated_at,
          classCount: classes.length,
          classTargets: classes.map((c) => ({
            publicationClassId: c.id,
            classId: c.class_id,
            deadlineOverride: c.deadline_override,
            effectiveDeadline: c.deadline_override ?? pub.default_deadline,
            status: c.status,
          })),
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(transformed, paginationMeta));
    } catch (err) {
      console.error("[teacher/assignment-publications] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment publications."),
      );
    }
  },
  { requiredRole: "teacher" },
);
