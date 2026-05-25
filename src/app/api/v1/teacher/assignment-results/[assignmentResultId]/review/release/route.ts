/**
 * POST /api/v1/teacher/assignment-results/{assignmentResultId}/review/release — Release review to student.
 *
 * Updates the submission review status from draft to released and sets the released_at timestamp.
 * Also updates the assignment result status to released. Verifies teacher has access to the class.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const releaseReviewSchema = z.object({
  notifyStudent: z.boolean().default(true),
  comment: z.string().trim().max(5000).nullable().optional(),
});

// POST — Release review
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const assignmentResultId = params.assignmentResultId as string;

      // Parse and validate request body (optional)
      let notifyStudent = true;
      let comment = "";
      try {
        const body = await request.json();
        const validation = releaseReviewSchema.safeParse(body);
        if (validation.success) {
          notifyStudent = validation.data.notifyStudent;
          comment = validation.data.comment?.trim() ?? "";
        }
      } catch {
        // No body or invalid body, use defaults
      }

      const supabase = createServerClient();

      // Verify teacher has access to this assignment result (three-step query)
      const { data: resultData, error: resultError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          status,
          assignment_publication_class_id,
          class_enrollments!inner(
            student_profile_id,
            student_profiles!left(id, display_name)
          )
        `
        )
        .eq("id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[teacher/review/release] Error fetching result:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify assignment result access."),
        );
      }

      if (!resultData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      // Step 2: Get the class_id from the publication class
      const { data: pubClassData, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .select("class_id")
        .eq("id", resultData.assignment_publication_class_id)
        .maybeSingle();

      if (pubClassError || !pubClassData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      // Step 3: Verify teacher access via class_teachers
      const { data: classTeacher } = await supabase
        .from("class_teachers")
        .select("id")
        .eq("class_id", pubClassData.class_id)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      // Check if a review exists for this result
      const { data: existingReview, error: reviewError } = await supabase
        .from("submission_reviews")
        .select("id, status, reviewed_by_teacher_id")
        .eq("assignment_result_id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      if (reviewError) {
        console.error("[teacher/review/release] Error fetching review:", reviewError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review."),
        );
      }

      let reviewId: string;

      if (!existingReview) {
        // Create a new review in released status
        const { data: newReview, error: createError } = await supabase
          .from("submission_reviews")
          .insert({
            assignment_result_id: assignmentResultId,
            reviewed_by_teacher_id: session.userId,
            status: "released",
            released_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (createError || !newReview) {
          console.error("[teacher/review/release] Error creating review:", createError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create review."),
          );
        }

        reviewId = newReview.id;
      } else {
        reviewId = existingReview.id;

        // Check if already released
        if (existingReview.status === "released") {
          return toResponse(
            errorResponse(ErrorCodes.CONFLICT, "Review has already been released."),
          );
        }

        // Check if teacher owns this review or is releasing their own review
        if (existingReview.reviewed_by_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You can only release reviews you created."),
          );
        }

        // Update the review to released status
        const { error: updateError } = await supabase
          .from("submission_reviews")
          .update({
            status: "released",
            released_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", reviewId);

        if (updateError) {
          console.error("[teacher/review/release] Error updating review:", updateError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to release review."),
          );
        }
      }

      const commentTimestamp = new Date().toISOString();
      const { data: existingPrimaryComment, error: commentLookupError } = await supabase
        .from("review_comments")
        .select("id")
        .eq("submission_review_id", reviewId)
        .eq("author_type", "teacher")
        .is("parent_comment_id", null)
        .eq("is_internal", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (commentLookupError) {
        console.error("[teacher/review/release] Error fetching primary comment:", commentLookupError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to save review comment."),
        );
      }

      if (comment.length > 0) {
        if (existingPrimaryComment) {
          const { error: updateCommentError } = await supabase
            .from("review_comments")
            .update({ body: comment, updated_at: commentTimestamp })
            .eq("id", existingPrimaryComment.id);

          if (updateCommentError) {
            console.error("[teacher/review/release] Error updating primary comment:", updateCommentError);
            return toResponse(
              errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to save review comment."),
            );
          }
        } else {
          const { error: createCommentError } = await supabase
            .from("review_comments")
            .insert({
              submission_review_id: reviewId,
              author_type: "teacher",
              author_platform_user_id: session.userId,
              body: comment,
              is_internal: false,
            });

          if (createCommentError) {
            console.error("[teacher/review/release] Error creating primary comment:", createCommentError);
            return toResponse(
              errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to save review comment."),
            );
          }
        }
      } else if (existingPrimaryComment) {
        const { error: deleteCommentError } = await supabase
          .from("review_comments")
          .update({ deleted_at: commentTimestamp, updated_at: commentTimestamp })
          .eq("id", existingPrimaryComment.id);

        if (deleteCommentError) {
          console.error("[teacher/review/release] Error deleting primary comment:", deleteCommentError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to clear review comment."),
          );
        }
      }

      // Update the assignment result status to released
      const { error: resultUpdateError } = await supabase
        .from("assignment_results")
        .update({
          status: "released",
          released_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", assignmentResultId);

      if (resultUpdateError) {
        console.error("[teacher/review/release] Error updating assignment result:", resultUpdateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update assignment result status."),
        );
      }

      // Optionally create a notification for the student
      if (notifyStudent) {
        const enrollment = resultData.class_enrollments as unknown as Record<string, unknown> | null;
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
                reviewId,
                message: "Your assignment review has been released",
              },
            });

          if (notifyError) {
            console.error("[teacher/review/release] Error creating notification:", notifyError);
            // Don't fail the request if notification fails
          }
        }
      }

      return toResponse(
        successResponse({
          reviewId,
          assignmentResultId,
          status: "released",
          releasedAt: new Date().toISOString(),
          notifiedStudent: notifyStudent,
        }),
        200,
      );
    } catch (err) {
      console.error("[teacher/review/release] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to release review."),
      );
    }
  },
  { requiredRole: "teacher" },
);
