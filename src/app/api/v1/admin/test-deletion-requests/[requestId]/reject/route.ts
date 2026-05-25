/**
 * POST /api/v1/admin/test-deletion-requests/{requestId}/reject — Reject a test deletion request.
 *
 * Restores the test to active status.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const rejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const requestId = params.requestId as string;

      const body = await request.json();
      const validation = rejectSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid request data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { reason } = validation.data;
      const supabase = createServerClient();

      // Check if deletion request exists and is pending
      const { data: deletionRequest, error: fetchError } = await supabase
        .from("test_deletion_requests")
        .select("id, test_id, decision, requested_by_platform_user_id, tests(id, title, status)")
        .eq("id", requestId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !deletionRequest) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test deletion request not found."),
        );
      }

      if (deletionRequest.decision !== "pending") {
        return toResponse(
          errorResponse(
            ErrorCodes.CONFLICT,
            `Test deletion request is already ${deletionRequest.decision}.`,
          ),
        );
      }

      // Update deletion request decision — atomic guard: only update if still pending
      const { data: updatedRequest, error: updateError } = await supabase
        .from("test_deletion_requests")
        .update({
          decision: "rejected",
          review_reason: reason,
          reviewed_by_platform_user_id: session.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("decision", "pending")
        .select("id, test_id, decision, review_reason, reviewed_by_platform_user_id, reviewed_at, updated_at")
        .single();

      if (updateError) {
        console.error("[admin/test-deletion-requests/reject] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reject test deletion."),
        );
      }

      if (!updatedRequest) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Test deletion request has already been processed."),
        );
      }

      // Rejection restores the test to active status
      const { error: testUpdateError } = await supabase
        .from("tests")
        .update({ status: "active" })
        .eq("id", deletionRequest.test_id)
        .is("deleted_at", null);

      if (testUpdateError) {
        console.error("[admin/test-deletion-requests/reject] Test update error:", testUpdateError);
        // Continue - rejection was successful even if test update failed
      }

      // Normalize joined test data (Supabase may return as array or object)
      const test = (Array.isArray(deletionRequest.tests) ? deletionRequest.tests[0] : deletionRequest.tests) as Record<string, unknown> | null | undefined;

      // Notify the teacher who requested the deletion
      if (deletionRequest.requested_by_platform_user_id) {
        const { error: notifyError } = await supabase
          .from("notifications")
          .insert({
            recipient_type: "platform_user",
            recipient_platform_user_id: deletionRequest.requested_by_platform_user_id,
            type: "test_deletion_rejected",
            payload_json: {
              testId: deletionRequest.test_id,
              testTitle: test?.title ?? "Untitled Test",
              requestId: deletionRequest.id,
              rejectionReason: reason,
              message: "Your test deletion request has been rejected and the test has been restored to active",
            },
          });

        if (notifyError) {
          console.error("[admin/test-deletion-requests/reject] Error creating notification:", notifyError);
          // Don't fail the request if notification fails
        }
      }

      return toResponse(
        successResponse({
          requestId: updatedRequest.id,
          testId: updatedRequest.test_id,
          title: test?.title,
          decision: updatedRequest.decision,
          reviewReason: updatedRequest.review_reason,
          reviewedBy: updatedRequest.reviewed_by_platform_user_id,
          reviewedAt: updatedRequest.reviewed_at,
          updatedAt: updatedRequest.updated_at,
        }),
        200,
      );
    } catch (err) {
      console.error("[admin/test-deletion-requests/reject] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reject test deletion."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
