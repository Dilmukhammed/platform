/**
 * POST /api/v1/teacher/test-attempts/{attemptId}/questions/{questionId}/score
 *
 * Score a text (non-autoScored) question in a test attempt.
 * Body: { score: 0 | 1 }
 * Validates: question exists in attempt, question is NOT autoScored.
 * Updates question_results entry and recalculates test_attempts.score_raw.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

interface QuestionResult {
  questionId: string;
  questionType: string;
  score: number | null;
  isCorrect: boolean | null;
  autoScored: boolean;
}

const scoreSchema = z.object({
  score: z.union([z.literal(0), z.literal(1)]),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const attemptId = params.attemptId as string;
      const questionId = params.questionId as string;

      if (!attemptId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Attempt ID is required."),
        );
      }

      if (!questionId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Question ID is required."),
        );
      }

      const body = await request.json();
      const validation = scoreSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid request body. Score must be 0 or 1.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { score } = validation.data;
      const supabase = createServerClient();

      // Fetch test attempt with authorization chain
      const { data: attempt, error: attemptError } = await supabase
        .from("test_attempts")
        .select(
          `
          id,
          question_results,
          score_raw,
          submitted_at,
          assignment_results!inner(
            id,
            assignment_publication_class_id
          )
        `,
        )
        .eq("id", attemptId)
        .is("deleted_at", null)
        .maybeSingle();

      if (attemptError) {
        console.error("[teacher/test-attempts/score] Error fetching attempt:", attemptError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test attempt."),
        );
      }

      if (!attempt) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test attempt not found."),
        );
      }

      if (!attempt.submitted_at) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Cannot score a test attempt that has not been submitted."),
        );
      }

      // Authorization chain
      const resultData = attempt.assignment_results as unknown as Record<string, unknown> | null;
      const pubClassId = resultData?.assignment_publication_class_id as string;

      const { data: pubClassData, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .select(
          `
          assignment_publications!inner(
            assignment_templates!inner(
              linked_test_id,
              tests!inner(id, scope_type, owner_teacher_id, owner_organization_id)
            )
          )
        `,
        )
        .eq("id", pubClassId)
        .maybeSingle();

      if (pubClassError || !pubClassData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test attempt not found or you do not have access."),
        );
      }

      const pubClass = pubClassData as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
      const test = template?.tests as unknown as Record<string, unknown> | null;

      if (!test) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test attempt not found or you do not have access."),
        );
      }

      // Authorization check
      const scopeType = test.scope_type as string;
      if (scopeType === "personal") {
        if (test.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this test attempt."),
          );
        }
      } else if (scopeType === "organization") {
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("organization_id", test.owner_organization_id as string)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this test attempt."),
          );
        }
      }

      // Validate question exists in question_results
      const questionResults = (attempt.question_results as QuestionResult[] | null) ?? [];
      const qrIndex = questionResults.findIndex((qr) => qr.questionId === questionId);

      if (qrIndex === -1) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Question not found in this test attempt."),
        );
      }

      const qr = questionResults[qrIndex];

      // Validate question is NOT autoScored
      if (qr.autoScored) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Cannot score an auto-scored question (e.g., multiple choice)."),
        );
      }

      // Update the question_results entry
      questionResults[qrIndex] = {
        ...qr,
        score,
        isCorrect: score === 1,
      };

      // Recalculate total score_raw
      const totalScore = questionResults.reduce((sum, entry) => {
        return sum + (entry.score ?? 0);
      }, 0);

      // Update test_attempts with new question_results and score_raw
      const { error: updateError } = await supabase
        .from("test_attempts")
        .update({
          question_results: questionResults,
          score_raw: totalScore,
        })
        .eq("id", attemptId);

      if (updateError) {
        console.error("[teacher/test-attempts/score] Error updating score:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update question score."),
        );
      }

      // Update grade_records.test_score_raw if a grade record exists
      try {
        const resultData = attempt.assignment_results as unknown as Record<string, unknown> | null;
        const assignmentResultId = resultData?.id as string | undefined;
        if (assignmentResultId) {
          const { data: gradeRecord } = await supabase
            .from("grade_records")
            .select("id")
            .eq("assignment_result_id", assignmentResultId)
            .eq("status", "current")
            .is("deleted_at", null)
            .maybeSingle();

          if (gradeRecord) {
            await supabase
              .from("grade_records")
              .update({
                test_score_raw: totalScore,
                final_score_raw: totalScore,
                updated_at: new Date().toISOString(),
              })
              .eq("id", gradeRecord.id);
          }
        }
      } catch (gradeErr) {
        console.error("[teacher/test-attempts/score] Non-fatal: failed to update grade record:", gradeErr);
      }

      return toResponse(
        successResponse({
          attemptId,
          questionId,
          score,
          isCorrect: score === 1,
          totalScoreRaw: totalScore,
        }),
      );
    } catch (err) {
      console.error("[teacher/test-attempts/score] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to score question."),
      );
    }
  },
  { requiredRole: "teacher" },
);
