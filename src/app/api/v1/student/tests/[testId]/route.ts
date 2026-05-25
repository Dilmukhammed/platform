import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

// Simple seeded random number generator (for deterministic shuffle)
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

// Fisher-Yates shuffle with seed
function shuffleWithSeed<T>(array: T[], seed: string): T[] {
  const result = [...array];
  const rng = seededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const paramsSchema = z.object({
  testId: z.string().uuid("Invalid test ID format."),
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
            "Invalid test ID.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { testId } = validation.data;
      const supabase = createServerClient();

      // Step 1: Get assignment_results for this student
      const { data: ownedResults, error: ownedResultsError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          assignment_publication_class_id,
          class_enrollments!inner(
            student_profile_id
          )
        `,
        )
        .eq("class_enrollments.student_profile_id", session.userId)
        .is("deleted_at", null);

      if (ownedResultsError) {
        console.error("[student/tests/[testId]] Owned results query error:", ownedResultsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test."),
        );
      }

      const publicationClassIds = Array.from(
        new Set(
          (ownedResults ?? [])
            .map((result) => result.assignment_publication_class_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      );

      if (publicationClassIds.length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Step 2: Get publication classes
      const { data: publicationClasses, error: publicationClassesError } = await supabase
        .from("assignment_publication_classes")
        .select("id, assignment_publication_id")
        .in("id", publicationClassIds)
        .is("deleted_at", null);

      if (publicationClassesError) {
        console.error(
          "[student/tests/[testId]] Publication classes query error:",
          publicationClassesError,
        );
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test."),
        );
      }

      const publicationIds = Array.from(
        new Set(
          (publicationClasses ?? [])
            .map((publicationClass) => publicationClass.assignment_publication_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      );

      if (publicationIds.length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Step 3: Get publications
      const { data: publications, error: publicationsError } = await supabase
        .from("assignment_publications")
        .select("id, assignment_template_id")
        .in("id", publicationIds)
        .is("deleted_at", null);

      if (publicationsError) {
        console.error("[student/tests/[testId]] Publications query error:", publicationsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test."),
        );
      }

      const templateIds = Array.from(
        new Set(
          (publications ?? [])
            .map((publication) => publication.assignment_template_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        ),
      );

      if (templateIds.length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Step 4: Get templates
      const { data: templates, error: templatesError } = await supabase
        .from("assignment_templates")
        .select("id, linked_test_id")
        .in("id", templateIds)
        .is("deleted_at", null);

      if (templatesError) {
        console.error("[student/tests/[testId]] Templates query error:", templatesError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test."),
        );
      }

      const hasAccessToTest = (templates ?? []).some((template) => template.linked_test_id === testId);

      if (!hasAccessToTest) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Step 5: Get test (no time_limit_minutes column — tests table doesn't have it)
      const { data: test, error: testError } = await supabase
        .from("tests")
        .select(
          `
          id,
          title,
          shuffle_questions,
          shuffle_options
        `,
        )
        .eq("id", testId)
        .is("deleted_at", null)
        .maybeSingle();

      if (testError) {
        console.error("[student/tests/[testId]] Test query error:", testError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test."),
        );
      }

      if (!test) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Step 6: Get questions
      const { data: questionRows, error: questionsError } = await supabase
        .from("test_questions")
        .select(
          `
          id,
          prompt,
          order_index,
          question_type,
          options_json
        `,
        )
        .eq("test_id", testId)
        .is("deleted_at", null)
        .order("order_index", { ascending: true });

      if (questionsError) {
        console.error("[student/tests/[testId]] Questions query error:", questionsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test."),
        );
      }

      const questions = ((questionRows as Array<Record<string, unknown>> | null) ?? [])
        .map((question) => {
          // Normalize options_json into a clean array of {id, text} for the student client.
          // options_json may be:
          //   - null/undefined → no options
          //   - an array of strings → ["Option A", "Option B"]
          //   - an object with variants → { variants: ["A", "B"], optionImages: [...] }
          //   - an array of objects → [{ id, text, ... }]
          const rawOptions = question.options_json;
          let normalizedOptions: Array<{ id: string; text: string }> | undefined;

          if (rawOptions == null) {
            normalizedOptions = undefined;
          } else if (Array.isArray(rawOptions)) {
            normalizedOptions = rawOptions.map((option: unknown, index: number) => {
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
          } else if (typeof rawOptions === "object") {
            const obj = rawOptions as Record<string, unknown>;
            const variants = Array.isArray(obj.variants) ? obj.variants : [];
            normalizedOptions = variants.map((variant: unknown, index: number) => ({
              id: `option-${index + 1}`,
              text: String(typeof variant === "string" ? variant : (variant as Record<string, unknown>)?.text ?? `Option ${index + 1}`),
            }));
          }

          return {
            id: String(question.id),
            questionText: question.prompt,
            questionNumber: question.order_index,
            type: question.question_type,
            options: normalizedOptions,
          };
        });

      // Apply shuffling if enabled (deterministic per student)
      const shuffleSeed = `${session.userId}-${testId}`;

      // Shuffle questions if enabled
      let finalQuestions = questions;
      if (test.shuffle_questions === true) {
        finalQuestions = shuffleWithSeed(questions, shuffleSeed);
        // Reassign question numbers to match new order (1, 2, 3...)
        finalQuestions = finalQuestions.map((q, index) => ({
          ...q,
          questionNumber: index + 1,
        }));
      }

      // Shuffle options for each MC question if enabled
      if (test.shuffle_options === true) {
        finalQuestions = finalQuestions.map((q) => {
          if (q.options && q.options.length > 0) {
            const shuffledOptions = shuffleWithSeed(q.options, `${shuffleSeed}-${q.id}`);
            return { ...q, options: shuffledOptions };
          }
          return q;
        });
      }

      return toResponse(
        successResponse({
          testId: test.id,
          title: test.title,
          questions: finalQuestions,
        }),
      );
    } catch (err) {
      console.error("[student/tests/[testId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test."),
      );
    }
  },
  { requiredRole: "student" },
);
