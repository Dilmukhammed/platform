/**
 * POST /api/v1/student/assignment-results/{assignmentResultId}/test-attempts
 *
 * Create a new test attempt for an assignment.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  assignmentResultId: z.string().uuid("Invalid assignment result ID format."),
});

const createAttemptSchema = z.object({
  testId: z.string().uuid("Test ID is required."),
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
            "Invalid assignment result ID.",
            undefined,
            paramsValidation.error.issues,
          ),
        );
      }

      const { assignmentResultId } = paramsValidation.data;

      const body = await request.json();
      const bodyValidation = createAttemptSchema.safeParse(body);

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

      const { testId } = bodyValidation.data;
      const supabase = createServerClient();

      // Get assignment result with ownership check and template info
      const { data: result, error: resultError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          status,
          test_started_at,
          assignment_publication_classes!inner(
            assignment_publications!inner(
              assignment_templates!inner(
                linked_test_id
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
        console.error("[student/test-attempts/create] Supabase error:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment."),
        );
      }

      if (!result) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment not found."),
        );
      }

      // Check if assignment is already reviewed/released
      if (result.status === "reviewed" || result.status === "released") {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Assignment has already been reviewed."),
        );
      }

      if (result.status === "submitted") {
        // Allow starting a test attempt if practice was submitted but deadline hasn't passed
        const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
        const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
        const deadline = pubClass?.deadline_override ?? publication?.default_deadline;
        const isBeforeDeadline = !deadline || new Date() <= new Date(deadline as string);

        if (!isBeforeDeadline) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "Cannot start a test attempt after the deadline has passed."),
          );
        }
        // Allow starting test attempt — continue below
      }

      // Verify test ID matches the linked test
      // Supabase JS v2: many-to-one joins return single objects, not arrays
      const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;

      if (template?.linked_test_id !== testId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Invalid test ID for this assignment."),
        );
      }

      // Get current attempt count
      const { data: existingAttempts, error: attemptsError } = await supabase
        .from("test_attempts")
        .select("attempt_number")
        .eq("assignment_result_id", assignmentResultId)
        .is("deleted_at", null)
        .order("attempt_number", { ascending: false });

      if (attemptsError) {
        console.error("[student/test-attempts/create] Attempts query error:", attemptsError);
      }

      const attemptCount = existingAttempts?.length ?? 0;

      // Default to 1 attempt max if no max_attempts configured on the template
      // (max_attempts column does not exist yet on assignment_templates)
      const maxAttempts = 1;

      // Check if max attempts reached
      if (attemptCount >= maxAttempts) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Maximum attempts reached."),
        );
      }

      const nextAttemptNumber = (existingAttempts?.[0]?.attempt_number ?? 0) + 1;

      // Mark any existing current attempts as not current
      const { error: updateError } = await supabase
        .from("test_attempts")
        .update({ is_current: false })
        .eq("assignment_result_id", assignmentResultId)
        .eq("is_current", true)
        .is("deleted_at", null);

      if (updateError) {
        console.error("[student/test-attempts/create] Update error:", updateError);
      }

      // Create new test attempt
      const now = new Date().toISOString();
      const { data: attempt, error: createError } = await supabase
        .from("test_attempts")
        .insert({
          assignment_result_id: assignmentResultId,
          test_id: testId,
          attempt_number: nextAttemptNumber,
          is_current: true,
          started_at: now,
        })
        .select(
          `
          id,
          test_id,
          attempt_number,
          is_current,
          started_at,
          created_at
        `,
        )
        .single();

      if (createError || !attempt) {
        console.error("[student/test-attempts/create] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create test attempt."),
        );
      }

      // Update assignment result to mark test as started if not already
      if (!result.test_started_at) {
        await supabase
          .from("assignment_results")
          .update({
            test_started_at: now,
            status: "in_progress",
          })
          .eq("id", assignmentResultId);
      }

      return toResponse(
        successResponse({
          attemptId: attempt.id,
          testId: attempt.test_id,
          attemptNumber: attempt.attempt_number,
          isCurrent: attempt.is_current,
          startedAt: attempt.started_at,
          createdAt: attempt.created_at,
        }),
        201,
      );
    } catch (err) {
      console.error("[student/test-attempts/create] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create test attempt."),
      );
    }
  },
  { requiredRole: "student" },
);
