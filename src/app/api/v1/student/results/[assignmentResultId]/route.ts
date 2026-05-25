/**
 * GET /api/v1/student/results/{assignmentResultId} — Get detailed result.
 *
 * Returns detailed grade information for a specific released assignment result.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  assignmentResultId: z.string().uuid("Invalid assignment result ID format."),
});

export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const validation = paramsSchema.safeParse(params);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid assignment result ID.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { assignmentResultId } = validation.data;
      const supabase = createServerClient();

      // Get assignment result with ownership check
      const { data: result, error: resultError } = await supabase
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
            class_id,
            classes!inner(
              id,
              title,
              description
            ),
            assignment_publications!inner(
              id,
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
            student_profile_id
          )
        `,
        )
        .eq("id", assignmentResultId)
        .eq("class_enrollments.student_profile_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[student/results/detail] Supabase error:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch result details."),
        );
      }

      if (!result) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Result not found."),
        );
      }

      // Only show detailed results if released
      if (result.status !== "released") {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Results have not been released yet."),
        );
      }

      // Supabase JS v2: many-to-one joins return single objects, not arrays
      const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;

      // Get grade record
      const { data: grade, error: gradeError } = await supabase
        .from("grade_records")
        .select(
          `
          id,
          mapped_grade,
          practice_score_raw,
          test_score_raw,
          final_score_raw,
          is_overridden,
          override_reason,
          formula_snapshot_json
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .eq("status", "current")
        .is("deleted_at", null)
        .maybeSingle();

      if (gradeError) {
        console.error("[student/results/detail] Grade query error:", gradeError);
      }

      // Get test attempts
      const { data: testAttempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select(
          `
          id,
          attempt_number,
          score_raw,
          submitted_at
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .is("deleted_at", null)
        .order("attempt_number", { ascending: true });

      if (attemptsError) {
        console.error("[student/results/detail] Test attempts query error:", attemptsError);
      }

      return toResponse(
        successResponse({
          assignmentResultId: result.id,
          status: result.status,
          classId: classData?.id,
          classTitle: classData?.title,
          classDescription: classData?.description,
          assignmentTemplateId: template?.id,
          assignmentTitle: template?.title,
          assignmentDescription: template?.description,
          hasPractice: template?.has_practice,
          hasTest: template?.has_test,
          releasedAt: result.released_at,
          practiceStartedAt: result.practice_started_at,
          practiceSubmittedAt: result.practice_submitted_at,
          testStartedAt: result.test_started_at,
          testSubmittedAt: result.test_submitted_at,
          grade: grade
            ? {
                mappedGrade: grade.mapped_grade,
                practiceScore: grade.practice_score_raw,
                testScore: grade.test_score_raw,
                finalScore: grade.final_score_raw,
                isOverridden: grade.is_overridden,
                overrideReason: grade.override_reason,
                formulaSnapshot: grade.formula_snapshot_json,
              }
            : null,
          testAttempts: (testAttempts ?? []).map((a: Record<string, unknown>) => ({
            id: a.id,
            attemptNumber: a.attempt_number,
            scoreRaw: a.score_raw,
            submittedAt: a.submitted_at,
          })),
        }),
      );
    } catch (err) {
      console.error("[student/results/detail] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch result details."),
      );
    }
  },
  { requiredRole: "student" },
);
