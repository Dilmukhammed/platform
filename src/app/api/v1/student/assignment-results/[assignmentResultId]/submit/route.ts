/**
 * POST /api/v1/student/assignment-results/{assignmentResultId}/submit
 *
 * Submit the assignment. Transitions status from draft/in_progress to submitted.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  assignmentResultId: z.string().uuid("Invalid assignment result ID format."),
});

const submitSchema = z.object({
  submissionType: z.enum(["practice", "test", "both"]),
  notes: z.string().max(1000).optional(),
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

      const { submissionType } = bodyValidation.data;
      const supabase = createServerClient();

      // Get assignment result with ownership check
      const { data: result, error: resultError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          status,
          practice_started_at,
          practice_submitted_at,
          test_started_at,
          test_submitted_at,
          assignment_publication_classes!inner(
            deadline_override,
            assignment_publications!inner(
              default_deadline
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
        console.error("[student/submit] Supabase error:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment."),
        );
      }

      if (!result) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment not found."),
        );
      }

      // Check if already submitted or beyond
      // Allow re-submit if deadline hasn't passed
      if (result.status === "reviewed" || result.status === "released") {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Assignment has already been reviewed."),
        );
      }

      if (result.status === "submitted") {
        // Re-submission allowed only before deadline
        const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
        const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
        const deadline = pubClass?.deadline_override ?? publication?.default_deadline;
        const isBeforeDeadline = !deadline || new Date() <= new Date(deadline as string);

        if (!isBeforeDeadline) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "Cannot re-submit after the deadline has passed."),
          );
        }
        // Allow re-submit — continue below
      }

      // Check deadline
      // Supabase JS v2: many-to-one joins return single objects, not arrays
      const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const deadline = pubClass?.deadline_override ?? publication?.default_deadline;

      if (deadline && new Date() > new Date(deadline as string)) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Assignment deadline has passed."),
        );
      }

      // Build update data based on submission type
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        status: "submitted",
      };

      if (submissionType === "practice" || submissionType === "both") {
        if (!result.practice_started_at) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "Practice has not been started."),
          );
        }
        // For initial submit: practice must not already be submitted
        // For re-submit (status was "submitted"): allow updating
        if (result.practice_submitted_at && result.status !== "submitted") {
          return toResponse(
            errorResponse(ErrorCodes.CONFLICT, "Practice has already been submitted."),
          );
        }

        const { data: currentSubmissionFile, error: submissionFileError } = await supabase
          .from("submission_files")
          .select("id")
          .eq("assignment_result_id", assignmentResultId)
          .eq("is_current", true)
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle();

        if (submissionFileError) {
          console.error("[student/submit] Submission file lookup error:", submissionFileError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify submission files."),
          );
        }

        if (!currentSubmissionFile) {
          return toResponse(
            errorResponse(
              ErrorCodes.FORBIDDEN,
              "Upload and finalize a submission file before submitting practice work.",
            ),
          );
        }

        updateData.practice_submitted_at = now;
      }

      if (submissionType === "test" || submissionType === "both") {
        if (!result.test_started_at) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "Test has not been started."),
          );
        }
        // For initial submit: test must not already be submitted
        // For re-submit (status was "submitted"): allow updating
        if (result.test_submitted_at && result.status !== "submitted") {
          return toResponse(
            errorResponse(ErrorCodes.CONFLICT, "Test has already been submitted."),
          );
        }
        updateData.test_submitted_at = now;
      }

      // Update assignment result
      const { data: updatedResult, error: updateError } = await supabase
        .from("assignment_results")
        .update(updateData)
        .eq("id", assignmentResultId)
        .select(
          `
          id,
          status,
          practice_submitted_at,
          test_submitted_at
        `,
        )
        .single();

      if (updateError || !updatedResult) {
        console.error("[student/submit] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to submit assignment."),
        );
      }

      // Notify the assigned teacher(s) about the submission
      try {
        const { data: pubClassData } = await supabase
          .from("assignment_publication_classes")
          .select("class_id, assignment_publications!inner(assignment_template_id, assignment_templates!inner(title))")
          .eq("id", (result as Record<string, unknown>).assignment_publication_class_id)
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
                assignmentResultId: updatedResult.id,
                studentId: session.userId,
                assignmentTitle: assignment?.title ?? "Assignment",
                message: "A student has submitted their work.",
              },
            }));

            await supabase.from("notifications").insert(notificationInserts);
          }
        }
      } catch (notifyError) {
        console.error("[student/submit] Notification error (non-fatal):", notifyError);
      }

      return toResponse(
        successResponse({
          assignmentResultId: updatedResult.id,
          status: updatedResult.status,
          practiceSubmittedAt: updatedResult.practice_submitted_at,
          testSubmittedAt: updatedResult.test_submitted_at,
          submittedAt: now,
        }),
      );
    } catch (err) {
      console.error("[student/submit] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to submit assignment."),
      );
    }
  },
  { requiredRole: "student" },
);
