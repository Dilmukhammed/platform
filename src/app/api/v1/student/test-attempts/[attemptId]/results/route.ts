/**
 * GET /api/v1/student/test-attempts/{attemptId}/results
 *
 * Returns test results for a student based on the test's show_results visibility setting.
 *
 * Visibility matrix:
 *   immediate   → MC results visible, text shows pending_review if not reviewed, full if reviewed
 *   after_review → No results until ALL text questions reviewed; otherwise pending_review
 *   never       → No per-question details ever, only status: "submitted"
 *
 * SECURITY: answer_json (correct answers) and explanation are NEVER exposed to students.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  attemptId: z.string().uuid("Invalid attempt ID format."),
});

type QuestionResultEntry = {
  questionId: string;
  questionText: string;
  questionType: "multiple_choice" | "short_answer";
  studentAnswer: string;
  isCorrect: boolean | null;
  score: number | null;
  status: "correct" | "incorrect" | "pending_review";
};

export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const validation = paramsSchema.safeParse(params);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid attempt ID.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { attemptId } = validation.data;
      const supabase = createServerClient();

      // Fetch test attempt with ownership check and test's show_results
      const { data: attempt, error: attemptError } = await supabase
        .from("test_attempts")
        .select(
          `
          id,
          test_id,
          score_raw,
          question_results,
          responses_json,
          submitted_at,
          assignment_results!inner(
            id,
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
        console.error("[student/test-attempts/results] Supabase error:", attemptError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test attempt."),
        );
      }

      if (!attempt) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test attempt not found."),
        );
      }

      // Must be submitted to have results
      if (!attempt.submitted_at) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Test attempt has not been submitted yet."),
        );
      }

      const testId = attempt.test_id as string;

      // Fetch test with show_results setting
      const { data: test, error: testError } = await supabase
        .from("tests")
        .select("id, title, show_results")
        .eq("id", testId)
        .is("deleted_at", null)
        .maybeSingle();

      if (testError || !test) {
        console.error("[student/test-attempts/results] Test query error:", testError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test."),
        );
      }

      const showResults = test.show_results as string;

      // NEVER mode: no per-question details
      if (showResults === "never") {
        return toResponse(
          successResponse({
            status: "submitted",
            noDetails: true,
          }),
        );
      }

      // Fetch test questions for prompt text and options
      const { data: questionRows, error: questionsError } = await supabase
        .from("test_questions")
        .select("id, prompt, question_type, options_json, order_index")
        .eq("test_id", testId)
        .is("deleted_at", null)
        .order("order_index", { ascending: true });

      if (questionsError) {
        console.error("[student/test-attempts/results] Questions query error:", questionsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test questions."),
        );
      }

      const questions = (questionRows as Array<Record<string, unknown>>) ?? [];
      const questionMap = new Map<string, Record<string, unknown>>();
      for (const q of questions) {
        questionMap.set(String(q.id), q);
      }

      // Parse question_results and responses_json from the attempt
      const questionResults = (attempt.question_results ?? []) as Array<{
        questionId: string;
        questionType: string;
        score: number | null;
        isCorrect: boolean | null;
        autoScored: boolean;
      }>;
      const responsesJson = (attempt.responses_json ?? {}) as Record<string, unknown>;

      // Check if any text questions are pending review (null score)
      const hasPendingTextReview = questionResults.some(
        (qr) => qr.questionType === "short_answer" && qr.score === null,
      );

      // AFTER_REVIEW mode: hide everything until all text questions reviewed
      if (showResults === "after_review" && hasPendingTextReview) {
        return toResponse(
          successResponse({
            status: "pending_review",
            noResults: true,
          }),
        );
      }

      // Build per-question results (for immediate or after_review with all reviewed)
      const totalQuestions = questions.length;
      const resultEntries: QuestionResultEntry[] = [];

      for (const q of questions) {
        const questionId = String(q.id);
        const questionType = q.question_type as "multiple_choice" | "short_answer";
        const questionText = String(q.prompt ?? "");
        const qr = questionResults.find((r) => r.questionId === questionId);

        // Build studentAnswer from responses_json
        const rawResponse = responsesJson[questionId];
        let studentAnswer: string;

        if (questionType === "multiple_choice") {
          // Response is "option-N" (1-based) — resolve to option text
          studentAnswer = resolveMcOptionText(rawResponse, q.options_json);
        } else {
          // short_answer: response is the text they typed
          studentAnswer = rawResponse != null ? String(rawResponse) : "";
        }

        // Determine status per question
        let status: "correct" | "incorrect" | "pending_review";
        let isCorrect: boolean | null = null;
        let score: number | null = null;

        if (qr) {
          if (qr.questionType === "short_answer" && qr.score === null) {
            // Text question not yet reviewed
            status = "pending_review";
            isCorrect = null;
            score = null;
          } else {
            isCorrect = qr.isCorrect;
            score = qr.score;
            status = qr.isCorrect === true ? "correct" : "incorrect";
          }
        } else {
          // No result entry — treat as unanswered
          status = "incorrect";
          isCorrect = false;
          score = 0;
        }

        resultEntries.push({
          questionId,
          questionText,
          questionType,
          studentAnswer,
          isCorrect,
          score,
          status,
        });
      }

      // Determine scoreRaw: null if any question has null score (pending review)
      const hasAnyNullScore = resultEntries.some((r) => r.score === null);
      const scoreRaw = hasAnyNullScore ? null : (attempt.score_raw as number | null);

      return toResponse(
        successResponse({
          testId: test.id,
          title: test.title,
          scoreRaw,
          totalQuestions,
          questionResults: resultEntries,
        }),
      );
    } catch (err) {
      console.error("[student/test-attempts/results] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test results."),
      );
    }
  },
  { requiredRole: "student" },
);

/**
 * Resolves an MC response value ("option-N") to the display text of that option.
 * Falls back to the raw response string if resolution fails.
 */
function resolveMcOptionText(
  rawResponse: unknown,
  optionsJson: unknown,
): string {
  if (rawResponse == null) return "";

  const responseStr = String(rawResponse);

  // If not in "option-N" format, return as-is
  const match = responseStr.match(/^option-(\d+)$/);
  if (!match) return responseStr;

  const optionIndex = parseInt(match[1], 10) - 1; // Convert 1-based to 0-based

  // Normalize options_json the same way as the test fetch endpoint
  const normalizedOptions = normalizeOptionsJson(optionsJson);

  if (normalizedOptions && optionIndex >= 0 && optionIndex < normalizedOptions.length) {
    return normalizedOptions[optionIndex].text;
  }

  // Fallback: return the raw option identifier
  return responseStr;
}

/**
 * Normalizes options_json into a clean array of {id, text}.
 * Mirrors the logic in the student test fetch endpoint.
 */
function normalizeOptionsJson(
  raw: unknown,
): Array<{ id: string; text: string }> | undefined {
  if (raw == null) return undefined;

  if (Array.isArray(raw)) {
    return raw.map((option: unknown, index: number) => {
      if (typeof option === "string") {
        return { id: `option-${index + 1}`, text: option };
      }
      if (option && typeof option === "object") {
        const record = option as Record<string, unknown>;
        return {
          id: String(record.id ?? record.value ?? `option-${index + 1}`),
          text: String(record.text ?? record.label ?? record.value ?? `Option ${index + 1}`),
        };
      }
      return { id: `option-${index + 1}`, text: `Option ${index + 1}` };
    });
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const variants = Array.isArray(obj.variants) ? obj.variants : [];
    return variants.map((variant: unknown, index: number) => ({
      id: `option-${index + 1}`,
      text: String(
        typeof variant === "string"
          ? variant
          : (variant as Record<string, unknown>)?.text ?? `Option ${index + 1}`,
      ),
    }));
  }

  return undefined;
}
