/**
 * GET /api/v1/student/results — List student's graded results.
 *
 * Returns paginated list of released assignment results with grades.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const querySchema = z.object({
  classId: z.string().uuid().optional(),
});

export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);

      const queryValidation = querySchema.safeParse({
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

      const { classId } = queryValidation.data;
      const supabase = createServerClient();

       // Build query for released assignment results; grade row is optional
       let dbQuery = supabase
         .from("assignment_results")
         .select(
          `
          id,
          status,
          released_at,
          assignment_publication_classes!inner(
            class_id,
            classes!inner(
              id,
              title
            ),
            assignment_publications!inner(
              id,
              published_at,
              assignment_templates!inner(
                id,
                title,
                description
              )
            )
          ),
          class_enrollments!inner(
            student_profile_id
          ),
          grade_records!left(
            id,
            status,
            deleted_at,
            mapped_grade,
            practice_score_raw,
            test_score_raw,
            final_score_raw,
            is_overridden
          )
        `,
          { count: "exact" },
         )
         .eq("class_enrollments.student_profile_id", session.userId)
         .eq("status", "released")
         .is("deleted_at", null)
         .is("assignment_publication_classes.deleted_at", null)
         .is("assignment_publication_classes.classes.deleted_at", null)
         .is("assignment_publication_classes.assignment_publications.deleted_at", null)
        .is("assignment_publication_classes.assignment_publications.assignment_templates.deleted_at", null);

      if (classId) {
        dbQuery = dbQuery.eq("assignment_publication_classes.class_id", classId);
      }

      // Apply pagination
      const { data: results, error, count } = await dbQuery
        .order("released_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[student/results] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch results."),
        );
      }

      // Transform results
      // Supabase JS v2: many-to-one joins return single objects, not arrays
      // grade_records is one-to-many → stays as array
      const resultsList = (results ?? []).map((result: Record<string, unknown>) => {
        const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
        const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
        const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
        const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
        const grades = ((result.grade_records as Array<Record<string, unknown>> | undefined) ?? []).find(
          (grade) => grade.status === "current" && grade.deleted_at == null,
        );

        return {
          assignmentResultId: result.id,
          status: result.status,
          releasedAt: result.released_at,
          classId: classData?.id,
          classTitle: classData?.title,
          assignmentTemplateId: template?.id,
          assignmentTitle: template?.title,
          assignmentDescription: template?.description,
          grade: grades
            ? {
                mappedGrade: grades.mapped_grade,
                practiceScore: grades.practice_score_raw,
                testScore: grades.test_score_raw,
                finalScore: grades.final_score_raw,
                isOverridden: grades.is_overridden,
              }
            : null,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(resultsList, paginationMeta));
    } catch (err) {
      console.error("[student/results] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch results."),
      );
    }
  },
  { requiredRole: "student" },
);
