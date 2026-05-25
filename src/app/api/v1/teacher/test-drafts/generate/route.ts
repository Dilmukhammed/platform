/**
 * POST /api/v1/teacher/test-drafts/generate — Generate AI test draft using MiniMax API (M2.7).
 *
 * Calls the LLM synchronously and creates the test + questions in Supabase.
 * Falls back to deterministic stub if MINIMAX_API_KEY is not set.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { generateAiTestDraft } from "@/modules/ai/service";

const generateDraftSchema = z.object({
  prompt: z.string().min(8).max(5000),
  questionCount: z.number().int().min(1).max(20).default(5),
  questionType: z.enum(["short_answer", "multiple_choice"]).default("short_answer"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
});

export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = generateDraftSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid generation request.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { prompt, questionCount, questionType, difficulty } = validation.data;
      const supabase = createServerClient();

      // Get organization name for AI context
      const { data: selectedOrg } = await supabase
        .from("teacher_selected_organizations")
        .select("organization_id")
        .eq("platform_user_id", session.userId)
        .single();

      let organizationName = "the selected organization";
      if (selectedOrg?.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", selectedOrg.organization_id)
          .single();
        if (org?.name) {
          organizationName = org.name;
        }
      }

      // Call AI service (synchronous — may take 5-15s)
      const draft = await generateAiTestDraft({
        prompt,
        organizationName,
        questionCount,
        questionType,
        difficulty,
      });

      // Create the test in Supabase
      const testInsertData = {
        title: draft.title,
        description: draft.description,
        scope_type: "personal",
        owner_teacher_id: session.userId,
        origin: "ai_draft",
        status: "draft",
      };

      const { data: test, error: createError } = await supabase
        .from("tests")
        .insert(testInsertData)
        .select("id")
        .single();

      if (createError || !test) {
        console.error("[test-drafts/generate] Test creation error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create test draft."),
        );
      }

      // Create questions
      const questionInsertData = draft.questions.map((q, index) => {
        if (q.questionType === "multiple_choice" && q.options) {
          const variants = q.options.map((o) => o.text);
          const optionImages = q.options.map(() => [] as string[]);
          const correctIndex = q.options.findIndex((o) => o.isCorrect);
          return {
            test_id: test.id,
            order_index: index,
            question_type: "multiple_choice",
            prompt: q.prompt,
            options_json: { variants, optionImages },
            answer_json: { correctIndex: correctIndex >= 0 ? correctIndex : 0 },
            explanation: q.explanation,
            images: [] as string[],
          };
        }

        return {
          test_id: test.id,
          order_index: index,
          question_type: "short_answer",
          prompt: q.prompt,
          options_json: {},
          answer_json: { text: q.answer },
          explanation: q.explanation,
          images: [] as string[],
        };
      });

      const { error: questionsError } = await supabase
        .from("test_questions")
        .insert(questionInsertData);

      if (questionsError) {
        console.error("[test-drafts/generate] Questions creation error:", questionsError);
        await supabase.from("tests").delete().eq("id", test.id);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create test questions."),
        );
      }

      return toResponse(
        successResponse({
          testId: test.id,
          title: draft.title,
          description: draft.description,
          providerLabel: draft.providerLabel,
          questionCount: draft.questions.length,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/test-drafts/generate] Unexpected error:", err);
      const message = err instanceof Error ? err.message : "Failed to generate test draft.";
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, message),
      );
    }
  },
  { requiredRole: "teacher" },
);
