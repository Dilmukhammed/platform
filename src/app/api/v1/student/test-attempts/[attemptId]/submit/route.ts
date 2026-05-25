/**
 * POST /api/v1/student/test-attempts/{attemptId}/submit
 *
 * Submit a test attempt.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { autoScoreTest } from "@/lib/scoring/auto-score";
import type { TestQuestion } from "@/lib/scoring/auto-score";

const paramsSchema = z.object({
  attemptId: z.string().uuid("Invalid attempt ID format."),
});

const submitSchema = z.object({
  finalResponsesJson: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const paramsValidation = paramsSchema.safeParse(params);

      if (!paramsValidation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid attempt ID.",
            undefined,
            paramsValidation.error.issues,
          ),
        );
      }

      const { attemptId } = paramsValidation.data;

      const body = await request.json();
      const bodyValidation = submitSchema.safeParse(body);

      if (!bodyValidation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid request body.",
            undefined,
            bodyValidation.error.issues,
          ),
        );
      }

      const { finalResponsesJson } = bodyValidation.data;
      const supabase = createServerClient();

      // Get test attempt with ownership check
      const { data: attempt, error: attemptError } = await supabase
        .from("test_attempts")
        .select(
          `
          id,
          test_id,
          assignment_result_id,
          is_current,
          submitted_at,
          responses_json,
          assignment_results!inner(
            id,
            status,
            class_enrollments!inner(
              student_profile_id
            )
          )
        `,
        )
        .eq("id", attemptId)
        .eq("assignment_results.class_enrollments.student_profile_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (attemptError) {
        console.error("[student/test-attempts/submit] Supabase error:", attemptError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test attempt."),
        );
      }

      if (!attempt) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test attempt not found."),
        );
      }

      // Check if attempt can be submitted
      if (!attempt.is_current) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Cannot submit a non-current attempt."),
        );
      }

      if (attempt.submitted_at) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Test attempt has already been submitted."),
        );
      }

      // Supabase JS v2: many-to-one join returns single object, not array
      const result = attempt.assignment_results as unknown as Record<string, unknown> | null;
      if (result?.status === "reviewed" || result?.status === "released") {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Assignment has already been reviewed."),
        );
      }

      if (result?.status === "submitted") {
        // Allow test submission if practice was already submitted but deadline hasn't passed
        const { data: deadlineInfo } = await supabase
          .from("assignment_results")
          .select(
            `
            id,
            assignment_publication_classes!inner(
              deadline_override,
              assignment_publications!inner(
                default_deadline
              )
            )
          `,
          )
          .eq("id", attempt.assignment_result_id as string)
          .is("deleted_at", null)
          .maybeSingle();

        const pubClass = deadlineInfo?.assignment_publication_classes as unknown as Record<string, unknown> | null;
        const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
        const deadline = pubClass?.deadline_override ?? publication?.default_deadline;
        const isBeforeDeadline = !deadline || new Date() <= new Date(deadline as string);

        if (!isBeforeDeadline) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "Cannot submit test after the deadline has passed."),
          );
        }
        // Allow test submission — continue below
      }

      // Build update data
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        submitted_at: now,
      };

      // Determine final responses_json
      const responsesJson = (finalResponsesJson ?? attempt.responses_json ?? {}) as Record<string, string>;
      if (finalResponsesJson !== undefined) {
        updateData.responses_json = finalResponsesJson;
      }

      // Fetch test questions for auto-scoring
      const testId = attempt.test_id as string;

      // Fetch test settings (shuffle_options)
      const { data: test, error: testError } = await supabase
        .from("tests")
        .select("id, shuffle_options")
        .eq("id", testId)
        .is("deleted_at", null)
        .maybeSingle();

      if (testError) {
        console.error("[student/test-attempts/submit] Test fetch error:", testError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test settings for scoring."),
        );
      }

      const { data: questionRows, error: questionsError } = await supabase
        .from("test_questions")
        .select("id, question_type, answer_json, options_json")
        .eq("test_id", testId)
        .is("deleted_at", null);

      if (questionsError) {
        console.error("[student/test-attempts/submit] Questions fetch error:", questionsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test questions for scoring."),
        );
      }

      // Transform to TestQuestion interface
      const testQuestions: TestQuestion[] = (
        (questionRows as Array<Record<string, unknown>> | null) ?? []
      ).map((q) => ({
        id: q.id as string,
        questionType: q.question_type as "multiple_choice" | "short_answer",
        answerJson: (q.answer_json as TestQuestion["answerJson"] | null) ?? null,
        optionsJson: q.options_json ?? null,
      }));

      // Run auto-scoring
      const { questionResults, scoreRaw } = autoScoreTest({
        testQuestions,
        responsesJson,
        testId,
        shuffleOptions: test?.shuffle_options === true,
        studentId: session.userId,
      });

      updateData.score_raw = scoreRaw;
      updateData.question_results = questionResults;

      // Update test attempt
      const { data: updatedAttempt, error: updateError } = await supabase
        .from("test_attempts")
        .update(updateData)
        .eq("id", attemptId)
        .select(
          `
          id,
          test_id,
          attempt_number,
          is_current,
          score_raw,
          submitted_at
        `,
        )
        .single();

      if (updateError || !updatedAttempt) {
        console.error("[student/test-attempts/submit] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to submit test attempt."),
        );
      }

      // Update assignment_results.test_submitted_at
      const assignmentResultId = attempt.assignment_result_id as string;
      const { error: resultUpdateError } = await supabase
        .from("assignment_results")
        .update({ test_submitted_at: now })
        .eq("id", assignmentResultId);

      if (resultUpdateError) {
        console.error("[student/test-attempts/submit] Failed to update assignment_results.test_submitted_at:", resultUpdateError);
        // Non-fatal — the test attempt itself was submitted successfully
      }

      // Notify teacher(s) about the test submission
      try {
        const { data: resultData } = await supabase
          .from("assignment_results")
          .select("assignment_publication_class_id")
          .eq("id", assignmentResultId)
          .single();

        if (resultData) {
          const { data: pubClassData } = await supabase
            .from("assignment_publication_classes")
            .select("class_id, assignment_publications!inner(assignment_template_id, assignment_templates!inner(title))")
            .eq("id", (resultData as Record<string, unknown>).assignment_publication_class_id)
            .single();

          if (pubClassData) {
            const classId = (pubClassData as Record<string, unknown>).class_id as string;
            const template = (pubClassData as Record<string, unknown>).assignment_publications as Record<string, unknown>;
            const assignment = (template?.assignment_templates as Record<string, unknown> | null);

            const { data: classTeachers } = await supabase
              .from("class_teachers")
              .select("platform_user_id")
              .eq("class_id", classId)
              .eq("status", "active")
              .is("deleted_at", null);

            if (classTeachers && classTeachers.length > 0) {
              const notificationInserts = classTeachers.map((ct) => ({
                recipient_type: "platform_user",
                recipient_platform_user_id: ct.platform_user_id,
                type: "student_submitted",
                payload_json: {
                  assignmentResultId,
                  studentId: session.userId,
                  assignmentTitle: assignment?.title ?? "Test",
                  message: "A student has submitted their test.",
                },
              }));

              await supabase.from("notifications").insert(notificationInserts);
            }
          }
        }
      } catch (notifyError) {
        console.error("[student/test-attempts/submit] Notification error (non-fatal):", notifyError);
      }

      // Gradebook integration: if MC-only test, update grade_records immediately
      // Mixed tests wait for complete-review API to handle gradebook update
      const isMcOnly = questionResults.every(qr => qr.questionType === "multiple_choice");

      if (isMcOnly) {
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
              test_score_raw: scoreRaw,
              updated_at: now,
            })
            .eq("id", gradeRecord.id);

          if (gradeUpdateError) {
            console.error("[student/test-attempts/submit] Error updating grade record:", gradeUpdateError);
            // Non-fatal — the test attempt itself was submitted successfully
          }
        } else {
          const { error: gradeCreateError } = await supabase
            .from("grade_records")
            .insert({
              assignment_result_id: assignmentResultId,
              test_score_raw: scoreRaw,
              mapped_grade: "-",
            });

          if (gradeCreateError) {
            console.error("[student/test-attempts/submit] Error creating grade record:", gradeCreateError);
            // Non-fatal — the test attempt itself was submitted successfully
          }
        }
      }

      return toResponse(
        successResponse({
          attemptId: updatedAttempt.id,
          testId: updatedAttempt.test_id,
          attemptNumber: updatedAttempt.attempt_number,
          isCurrent: updatedAttempt.is_current,
          scoreRaw,
          questionResults,
          submittedAt: updatedAttempt.submitted_at,
        }),
      );
    } catch (err) {
      console.error("[student/test-attempts/submit] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to submit test attempt."),
      );
    }
  },
  { requiredRole: "student" },
);
