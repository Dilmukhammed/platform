/**
 * POST /api/v1/teacher/assignment-results/{assignmentResultId}/review-comments — Add a review comment.
 *
 * Creates a new comment on the submission review. If no review exists yet,
 * creates one in draft status first. Verifies teacher has access to the class.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional(),
  isInternal: z.boolean().default(false),
});

// POST — Add review comment
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const assignmentResultId = params.assignmentResultId as string;

      // Parse and validate request body
      const body = await request.json();
      const validation = createCommentSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid comment data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { body: commentBody, parentCommentId, isInternal } = validation.data;
      const supabase = createServerClient();

      // Verify teacher has access to this assignment result (two-step query)
      // Step 1: Get the assignment result with its publication class info
      const { data: resultData, error: resultError } = await supabase
        .from("assignment_results")
        .select("id, assignment_publication_class_id")
        .eq("id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[teacher/review-comments] Error fetching result:", resultError);
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
      const { data: classTeacher, error: teacherError } = await supabase
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

      // Check if a review already exists for this result
      let { data: existingReview } = await supabase
        .from("submission_reviews")
        .select("id, status")
        .eq("assignment_result_id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      let reviewId: string;

      if (existingReview) {
        reviewId = existingReview.id;
      } else {
        // Create a new review in draft status
        const { data: newReview, error: createError } = await supabase
          .from("submission_reviews")
          .insert({
            assignment_result_id: assignmentResultId,
            reviewed_by_teacher_id: session.userId,
            status: "draft",
          })
          .select("id")
          .single();

        if (createError || !newReview) {
          console.error("[teacher/review-comments] Error creating review:", createError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create review."),
          );
        }

        reviewId = newReview.id;
      }

      // If parentCommentId is provided, verify it belongs to this review
      if (parentCommentId) {
        const { data: parentComment } = await supabase
          .from("review_comments")
          .select("id")
          .eq("id", parentCommentId)
          .eq("submission_review_id", reviewId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!parentComment) {
          return toResponse(
            errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Parent comment not found or does not belong to this review."),
          );
        }
      }

      // Create the comment
      const { data: comment, error: commentError } = await supabase
        .from("review_comments")
        .insert({
          submission_review_id: reviewId,
          author_type: "teacher",
          author_platform_user_id: session.userId,
          parent_comment_id: parentCommentId || null,
          body: commentBody,
          is_internal: isInternal,
        })
        .select("*")
        .single();

      if (commentError || !comment) {
        console.error("[teacher/review-comments] Error creating comment:", commentError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create comment."),
        );
      }

      return toResponse(
        successResponse({
          commentId: comment.id,
          reviewId: comment.submission_review_id,
          authorType: comment.author_type,
          authorPlatformUserId: comment.author_platform_user_id,
          parentCommentId: comment.parent_comment_id,
          body: comment.body,
          isInternal: comment.is_internal,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/review-comments] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create comment."),
      );
    }
  },
  { requiredRole: "teacher" },
);
