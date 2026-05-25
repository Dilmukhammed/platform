/**
 * POST /api/v1/teacher/test-attempts/{attemptId}/complete-review
 *
 * Validates ALL non-autoScored questions have been scored (no null scores remaining).
 * Persists the recalculated attempt score and finalizes release-side effects.
 * If show_results=after_review: triggers student results visibility.
 * Updates grade_records.test_score_raw if all questions now scored.
 */

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

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const attemptId = params.attemptId as string;

      if (!attemptId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Attempt ID is required."),
        );
      }

      const supabase = createServerClient();

      // Fetch test attempt with authorization chain
      const { data: attempt, error: attemptError } = await supabase
        .from("test_attempts")
        .select(
          `
          id,
          assignment_result_id,
          question_results,
          score_raw,
          submitted_at,
          assignment_results!inner(
            id,
            assignment_publication_class_id,
            class_enrollments!inner(
              student_profile_id,
              student_profiles!left(id, display_name)
            )
          )
        `,
        )
        .eq("id", attemptId)
        .is("deleted_at", null)
        .maybeSingle();

      if (attemptError) {
        console.error("[teacher/test-attempts/complete-review] Error fetching attempt:", attemptError);
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
          errorResponse(ErrorCodes.FORBIDDEN, "Cannot complete review for a test attempt that has not been submitted."),
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
              tests!inner(id, title, show_results, scope_type, owner_teacher_id, owner_organization_id)
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

      // Validate ALL non-autoScored questions have been scored
      const questionResults = (attempt.question_results as QuestionResult[] | null) ?? [];
      const unscoredQuestions = questionResults.filter(
        (qr) => !qr.autoScored && qr.score === null,
      );

      if (unscoredQuestions.length > 0) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            `Cannot complete review: ${unscoredQuestions.length} text question(s) still need scoring.`,
            undefined,
            { unscoredQuestionIds: unscoredQuestions.map((q) => q.questionId) },
          ),
        );
      }

      // Recalculate final score_raw
      const totalScore = questionResults.reduce((sum, qr) => {
        return sum + (qr.score ?? 0);
      }, 0);

      const now = new Date().toISOString();

      // Persist the recalculated score for the attempt.
      const { error: updateError } = await supabase
        .from("test_attempts")
        .update({
          score_raw: totalScore,
          updated_at: now,
        })
        .eq("id", attemptId);

      if (updateError) {
        console.error("[teacher/test-attempts/complete-review] Error updating attempt:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to complete review."),
        );
      }

      // Update grade_records.test_score_raw if grade record exists
      const assignmentResultId = attempt.assignment_result_id as string;
      const { data: gradeRecord } = await supabase
        .from("grade_records")
        .select("id, test_score_raw")
        .eq("assignment_result_id", assignmentResultId)
        .eq("status", "current")
        .is("deleted_at", null)
        .maybeSingle();

      if (gradeRecord) {
        const { error: gradeUpdateError } = await supabase
          .from("grade_records")
          .update({
            test_score_raw: totalScore,
            updated_at: now,
          })
          .eq("id", gradeRecord.id);

        if (gradeUpdateError) {
          console.error("[teacher/test-attempts/complete-review] Error updating grade record:", gradeUpdateError);
          // Non-fatal — the review itself was completed successfully
        }
      } else {
        // Create a new grade_record if none exists (e.g., for mixed tests)
        const { error: gradeCreateError } = await supabase
          .from("grade_records")
          .insert({
            assignment_result_id: assignmentResultId,
            test_score_raw: totalScore,
            practice_score_raw: null,
            final_score_raw: totalScore,
            formula_snapshot_json: { testWeight: 1, practiceWeight: 0 },
            mapped_grade: null,
            status: "current",
          });

        if (gradeCreateError) {
          console.error("[teacher/test-attempts/complete-review] Error creating grade record:", gradeCreateError);
          // Non-fatal — the review itself was completed successfully
        }
      }

      // If show_results=after_review, update assignment_results to make results visible
      const showResults = test.show_results as string;
      if (showResults === "after_review") {
        const { error: resultUpdateError } = await supabase
          .from("assignment_results")
          .update({
            status: "released",
            released_at: now,
          })
          .eq("id", assignmentResultId);

        if (resultUpdateError) {
          console.error("[teacher/test-attempts/complete-review] Error releasing results:", resultUpdateError);
          // Non-fatal — the review itself was completed successfully
        }

        const enrollment = resultData?.class_enrollments as unknown as Record<string, unknown> | null;
        const studentProfile = enrollment?.student_profiles as unknown as Record<string, unknown> | null;

        if (studentProfile?.id) {
          const { error: notifyError } = await supabase
            .from("notifications")
            .insert({
              recipient_type: "student_profile",
              recipient_student_profile_id: studentProfile.id,
              type: "review_released",
              payload_json: {
                assignmentResultId,
                attemptId,
                message: "Your test review has been completed and released",
              },
            });

          if (notifyError) {
            console.error("[teacher/test-attempts/complete-review] Error creating notification:", notifyError);
          }
        }
      }

      return toResponse(
        successResponse({
          attemptId,
          reviewCompletedAt: now,
          scoreRaw: totalScore,
          resultsReleased: showResults === "after_review",
        }),
      );
    } catch (err) {
      console.error("[teacher/test-attempts/complete-review] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to complete review."),
      );
    }
  },
  { requiredRole: "teacher" },
);
