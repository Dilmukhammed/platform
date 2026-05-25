/**
 * GET /api/v1/student/assignments — List student's assignments.
 *
 * Returns paginated list of assignments across all enrolled classes.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const querySchema = z.object({
  status: z.enum(["not_started", "in_progress", "submitted", "reviewed", "released"]).optional(),
  classId: z.string().uuid().optional(),
});

export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);

      const queryValidation = querySchema.safeParse({
        status: searchParams.get("status") ?? undefined,
        classId: searchParams.get("classId") ?? undefined,
      });

      if (!queryValidation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid query parameters.",
            undefined,
            queryValidation.error.issues,
          ),
        );
      }

      const { status, classId } = queryValidation.data;
      const supabase = createServerClient();

      // Build query for assignment results with all related data
      let dbQuery = supabase
        .from("assignment_results")
        .select(
          `
          id,
          status,
          practice_started_at,
          practice_submitted_at,
          test_started_at,
          test_submitted_at,
          released_at,
          created_at,
          assignment_publication_classes!inner(
            id,
            deadline_override,
            class_id,
            classes!inner(
              id,
              title
            ),
            assignment_publications!inner(
              id,
              default_deadline,
              published_at,
              assignment_templates!inner(
                id,
                title,
                description,
                has_practice,
                has_test
              )
            )
          ),
          class_enrollments!inner(
            id,
            student_profile_id
          )
        `,
          { count: "exact" },
        )
        .eq("class_enrollments.student_profile_id", session.userId)
        .is("deleted_at", null)
        .is("assignment_publication_classes.deleted_at", null)
        .is("assignment_publication_classes.classes.deleted_at", null)
        .is("assignment_publication_classes.assignment_publications.deleted_at", null)
        .is("assignment_publication_classes.assignment_publications.assignment_templates.deleted_at", null);

      if (status) {
        dbQuery = dbQuery.eq("status", status);
      }

      if (classId) {
        dbQuery = dbQuery.eq("assignment_publication_classes.class_id", classId);
      }

      // Apply pagination
      const { data: results, error, count } = await dbQuery
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[student/assignments] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignments."),
        );
      }

      // Transform results to assignment list format
      // Supabase JS v2: many-to-one joins return single objects, not arrays
      const assignments = (results ?? []).map((result: Record<string, unknown>) => {
        const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
        const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
        const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
        const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;

        const deadline = pubClass?.deadline_override ?? publication?.default_deadline;

        return {
          assignmentResultId: result.id,
          status: result.status,
          classId: classData?.id,
          classTitle: classData?.title,
          assignmentTemplateId: template?.id,
          assignmentTitle: template?.title,
          assignmentDescription: template?.description,
          hasPractice: template?.has_practice,
          hasTest: template?.has_test,
          deadline: deadline,
          publishedAt: publication?.published_at,
          practiceStartedAt: result.practice_started_at,
          practiceSubmittedAt: result.practice_submitted_at,
          testStartedAt: result.test_started_at,
          testSubmittedAt: result.test_submitted_at,
          releasedAt: result.released_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(assignments, paginationMeta));
    } catch (err) {
      console.error("[student/assignments] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignments."),
      );
    }
  },
  { requiredRole: "student" },
);
