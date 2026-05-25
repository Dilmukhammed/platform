/**
 * POST /api/v1/student/assignment-results/{assignmentResultId}/start-practice
 *
 * Start practice for an assignment.
 * Idempotent - safe to call multiple times.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  assignmentResultId: z.string().uuid("Invalid assignment result ID format."),
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
      const supabase = createServerClient();

      // Get assignment result with ownership check and practice info
      // has_practice is in assignment_templates, need to join through the chain
      const { data: result, error: resultError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          status,
          practice_started_at,
          practice_submitted_at,
          class_enrollments!inner(
            student_profile_id
          ),
          assignment_publication_classes!inner(
            assignment_publications!inner(
              assignment_templates!inner(
                has_practice
              )
            )
          )
        `,
        )
        .eq("id", assignmentResultId)
        .eq("class_enrollments.student_profile_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[student/start-practice] Supabase error:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment."),
        );
      }

      if (!result) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment not found."),
        );
      }

      // Extract has_practice from nested join structure
      // Supabase JS v2: many-to-one joins return single objects, not arrays
      const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
      const hasPractice = template?.has_practice as boolean | undefined;

      // Check if assignment has practice component
      if (!hasPractice) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "This assignment does not have a practice component."),
        );
      }

      // Check if already submitted or beyond
      if (result.status === "submitted" || result.status === "reviewed" || result.status === "released") {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Assignment has already been submitted."),
        );
      }

      // Idempotent - if already started, return success
      if (result.practice_started_at) {
        return toResponse(
          successResponse({
            practiceStartedAt: result.practice_started_at,
            alreadyStarted: true,
          }),
        );
      }

      // Start practice
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("assignment_results")
        .update({
          practice_started_at: now,
          status: "in_progress",
        })
        .eq("id", assignmentResultId);

      if (updateError) {
        console.error("[student/start-practice] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to start practice."),
        );
      }

      return toResponse(
        successResponse({
          practiceStartedAt: now,
          alreadyStarted: false,
        }),
      );
    } catch (err) {
      console.error("[student/start-practice] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to start practice."),
      );
    }
  },
  { requiredRole: "student" },
);
