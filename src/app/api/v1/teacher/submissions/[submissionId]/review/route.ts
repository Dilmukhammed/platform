/**
 * GET /api/v1/teacher/submissions/[submissionId]/review — Get or create review for a submission.
 * POST /api/v1/teacher/submissions/[submissionId]/review — Create or update review.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

// GET — Get review for submission
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const submissionId = params?.submissionId as string;

      if (!submissionId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Submission ID is required."),
        );
      }

      const supabase = createServerClient();

      // Verify submission belongs to this teacher (two-step query)
      const { data: submission, error: subError } = await supabase
        .from("assignment_results")
        .select("id, assignment_publication_class_id")
        .eq("id", submissionId)
        .is("deleted_at", null)
        .single();

      if (subError || !submission) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Submission not found."),
        );
      }

      const { data: pubClass, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .select("assignment_publications!inner(published_by_teacher_id)")
        .eq("id", submission.assignment_publication_class_id)
        .single();

      if (pubClassError || !pubClass) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Submission not found."),
        );
      }

      const pub = pubClass.assignment_publications as unknown as Record<string, unknown> | null;

      if (pub?.published_by_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this submission."),
        );
      }

      // Get existing review
      const { data: review, error } = await supabase
        .from("submission_reviews")
        .select("id, status, reviewed_by_teacher_id, created_at, updated_at")
        .eq("assignment_result_id", submissionId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        console.error("[teacher/review] Error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review."),
        );
      }

      // If no review exists, return null - client will handle creation
      if (!review) {
        return toResponse(successResponse(null));
      }

      const data = {
        id: review.id,
        reviewId: review.id,
        submissionId: submissionId,
        status: review.status,
        reviewedByTeacherId: review.reviewed_by_teacher_id,
        createdAt: review.created_at,
        updatedAt: review.updated_at,
      };

      return toResponse(successResponse(data));
    } catch (err) {
      console.error("[teacher/review] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Create or update review
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const submissionId = params?.submissionId as string;
      const body = await request.json();

      if (!submissionId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Submission ID is required."),
        );
      }

      const supabase = createServerClient();

      // Verify submission belongs to this teacher (two-step query)
      const { data: submission, error: subError } = await supabase
        .from("assignment_results")
        .select("id, assignment_publication_class_id")
        .eq("id", submissionId)
        .is("deleted_at", null)
        .single();

      if (subError || !submission) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Submission not found."),
        );
      }

      const { data: pubClass, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .select("assignment_publications!inner(published_by_teacher_id)")
        .eq("id", submission.assignment_publication_class_id)
        .single();

      if (pubClassError || !pubClass) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Submission not found."),
        );
      }

      const pub = pubClass.assignment_publications as unknown as Record<string, unknown> | null;

      if (pub?.published_by_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this submission."),
        );
      }

      const now = new Date().toISOString();

      // Check if review exists
      const { data: existingReview } = await supabase
        .from("submission_reviews")
        .select("id")
        .eq("assignment_result_id", submissionId)
        .is("deleted_at", null)
        .maybeSingle();

      let review;
      
      if (existingReview) {
        // Update existing review
        const { data: updated, error } = await supabase
          .from("submission_reviews")
          .update({
            status: body.status,
            updated_at: now,
          })
          .eq("id", existingReview.id)
          .select()
          .single();
        
        if (error) throw error;
        review = updated;
      } else {
        // Create new review
        const { data: created, error } = await supabase
          .from("submission_reviews")
          .insert({
            assignment_result_id: submissionId,
            reviewed_by_teacher_id: session.userId,
            status: body.status || "draft",
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();
        
        if (error) throw error;
        review = created;
      }

      const data = {
        id: review.id,
        reviewId: review.id,
        submissionId: submissionId,
        status: review.status,
        reviewedByTeacherId: review.reviewed_by_teacher_id,
        createdAt: review.created_at,
        updatedAt: review.updated_at,
      };

      return toResponse(successResponse(data));
    } catch (err) {
      console.error("[teacher/review] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to save review."),
      );
    }
  },
  { requiredRole: "teacher" },
);
