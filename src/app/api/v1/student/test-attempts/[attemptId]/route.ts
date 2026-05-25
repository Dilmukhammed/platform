/**
 * PATCH /api/v1/student/test-attempts/{attemptId}
 *
 * Update test attempt responses (save progress).
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  attemptId: z.string().uuid("Invalid attempt ID format."),
});

const updateSchema = z.object({
  responsesJson: z.record(z.string(), z.unknown()).optional(),
  scoreRaw: z.number().min(0).optional(),
});

export const PATCH = withAuth(
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
      const bodyValidation = updateSchema.safeParse(body);

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

      const { responsesJson, scoreRaw } = bodyValidation.data;
      const supabase = createServerClient();

      // Get test attempt with ownership check
      const { data: attempt, error: attemptError } = await supabase
        .from("test_attempts")
        .select(
          `
          id,
          assignment_result_id,
          is_current,
          submitted_at,
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
        console.error("[student/test-attempts/update] Supabase error:", attemptError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test attempt."),
        );
      }

      if (!attempt) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test attempt not found."),
        );
      }

      // Check if attempt can be updated
      if (!attempt.is_current) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Cannot update a non-current attempt."),
        );
      }

      if (attempt.submitted_at) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Cannot update a submitted attempt."),
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
        // Allow auto-saving test answers if practice was submitted but deadline hasn't passed
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
            errorResponse(ErrorCodes.FORBIDDEN, "Cannot update test attempt after the deadline has passed."),
          );
        }
        // Allow auto-save — continue below
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (responsesJson !== undefined) {
        updateData.responses_json = responsesJson;
      }
      if (scoreRaw !== undefined) {
        updateData.score_raw = scoreRaw;
      }

      if (Object.keys(updateData).length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "No fields to update."),
        );
      }

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
          responses_json,
          started_at,
          updated_at
        `,
        )
        .single();

      if (updateError || !updatedAttempt) {
        console.error("[student/test-attempts/update] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update test attempt."),
        );
      }

      return toResponse(
        successResponse({
          attemptId: updatedAttempt.id,
          testId: updatedAttempt.test_id,
          attemptNumber: updatedAttempt.attempt_number,
          isCurrent: updatedAttempt.is_current,
          scoreRaw: updatedAttempt.score_raw,
          responsesJson: updatedAttempt.responses_json,
          startedAt: updatedAttempt.started_at,
          updatedAt: updatedAttempt.updated_at,
        }),
      );
    } catch (err) {
      console.error("[student/test-attempts/update] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update test attempt."),
      );
    }
  },
  { requiredRole: "student" },
);
