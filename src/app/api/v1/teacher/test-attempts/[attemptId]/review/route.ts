/**
 * GET /api/v1/teacher/test-attempts/{attemptId}/review
 *
 * Returns test attempt with question_results, test questions (with answer_json for teacher),
 * student info. Each question includes prompt, questionType, student answer, correct answer,
 * explanation, current score, autoScored flag.
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

export const GET = withAuth(
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

      // Fetch test attempt with authorization chain:
      // test_attempts → assignment_results → assignment_publication_classes →
      // assignment_publications → assignment_templates → tests → owner_teacher_id / owner_organization_id
      const { data: attempt, error: attemptError } = await supabase
        .from("test_attempts")
        .select(
          `
          id,
          test_id,
          responses_json,
          question_results,
          score_raw,
          submitted_at,
          updated_at,
          assignment_results!inner(
            id,
            assignment_publication_class_id,
            class_enrollments!inner(
              student_profile_id,
              student_profiles!left(id, display_name, student_login)
            )
          )
        `,
        )
        .eq("id", attemptId)
        .is("deleted_at", null)
        .maybeSingle();

      if (attemptError) {
        console.error("[teacher/test-attempts/review] Error fetching attempt:", attemptError);
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
          errorResponse(ErrorCodes.FORBIDDEN, "Test attempt has not been submitted yet."),
        );
      }

      // Walk the authorization chain to get the test ownership info
      const resultData = attempt.assignment_results as unknown as Record<string, unknown> | null;
      const pubClassId = resultData?.assignment_publication_class_id as string;

      const { data: pubClassData, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .select(
          `
          class_id,
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

      // Authorization: check teacher owns the test
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

      // Fetch test questions with answer_json (teacher can see correct answers)
      const testId = test.id as string;
      const { data: questions, error: questionsError } = await supabase
        .from("test_questions")
        .select("id, question_type, prompt, options_json, answer_json, explanation, order_index")
        .eq("test_id", testId)
        .is("deleted_at", null)
        .order("order_index");

      if (questionsError) {
        console.error("[teacher/test-attempts/review] Error fetching questions:", questionsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test questions."),
        );
      }

      // Build question_results map for quick lookup
      const questionResults = (attempt.question_results as QuestionResult[] | null) ?? [];
      const qrMap = new Map<string, QuestionResult>();
      for (const qr of questionResults) {
        qrMap.set(qr.questionId, qr);
      }

      // Build responses_json map for student answers
      const responsesJson = (attempt.responses_json as Record<string, unknown> | null) ?? {};

      // Build the questions array for the response
      const questionRows = (questions ?? []) as Array<Record<string, unknown>>;
      const responseQuestions = questionRows.map((q) => {
        const qId = q.id as string;
        const qr = qrMap.get(qId);
        const studentAnswer = responsesJson[qId] as string | null ?? null;
        const answerJson = q.answer_json as Record<string, unknown> | null;

        return {
          questionId: qId,
          orderIndex: q.order_index as number,
          questionType: q.question_type as string,
          prompt: q.prompt as string,
          optionsJson: q.options_json as Record<string, unknown> | null,
          studentAnswer,
          correctAnswer: answerJson ?? {},
          explanation: q.explanation as string | null,
          currentScore: qr?.score ?? null,
          isCorrect: qr?.isCorrect ?? null,
          autoScored: qr?.autoScored ?? false,
        };
      });

      // Extract student info
      const enrollment = resultData?.class_enrollments as unknown as Record<string, unknown> | null;
      const studentProfile = enrollment?.student_profiles as unknown as Record<string, unknown> | null;

      // Determine if review is completed: all non-autoScored questions have been scored
      const scorableQuestions = responseQuestions.filter(q => !q.autoScored);
      const allScored = scorableQuestions.length > 0 && scorableQuestions.every(q => q.currentScore !== null);
      const reviewCompletedAt = allScored ? (attempt.updated_at as string ?? null) : null;

      const response = {
        attemptId: attempt.id,
        testId: test.id as string,
        testTitle: test.title as string,
        showResults: test.show_results as string,
        studentInfo: {
          studentProfileId: studentProfile?.id as string ?? enrollment?.student_profile_id as string ?? "",
          studentName: studentProfile?.display_name as string ?? "",
        },
        questions: responseQuestions,
        scoreRaw: attempt.score_raw as number | null,
        submittedAt: attempt.submitted_at as string,
        reviewCompletedAt,
      };

      return toResponse(successResponse(response));
    } catch (err) {
      console.error("[teacher/test-attempts/review] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review details."),
      );
    }
  },
  { requiredRole: "teacher" },
);
