/**
 * POST /api/v1/admin/test-deletion-requests/{requestId}/approve — Approve a test deletion request.
 *
 * Soft-deletes the test and its questions by setting deleted_at = now().
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const approveSchema = z.object({
  notes: z.string().optional(),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const requestId = params.requestId as string;

      const body = await request.json();
      const validation = approveSchema.safeParse(body);

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

      const supabase = createServerClient();

      // Check if deletion request exists and is pending
      const { data: deletionRequest, error: fetchError } = await supabase
        .from("test_deletion_requests")
        .select("id, test_id, decision, requested_by_platform_user_id, tests(id, title)")
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
          decision: "approved",
          reviewed_by_platform_user_id: session.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("decision", "pending")
        .select("id, test_id, decision, reviewed_by_platform_user_id, reviewed_at, updated_at")
        .single();

      if (updateError) {
        console.error("[admin/test-deletion-requests/approve] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to approve test deletion."),
        );
      }

      if (!updatedRequest) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Test deletion request has already been processed."),
        );
      }

      // Soft-delete the test: set deleted_at = now()
      const now = new Date().toISOString();
      const { error: testUpdateError } = await supabase
        .from("tests")
        .update({ deleted_at: now })
        .eq("id", deletionRequest.test_id)
        .is("deleted_at", null);

      if (testUpdateError) {
        console.error("[admin/test-deletion-requests/approve] Test soft-delete error:", testUpdateError);
        // Continue - approval was successful even if test update failed
      }

      // Soft-delete all test questions for this test
      const { error: questionsUpdateError } = await supabase
        .from("test_questions")
        .update({ deleted_at: now })
        .eq("test_id", deletionRequest.test_id)
        .is("deleted_at", null);

      if (questionsUpdateError) {
        console.error("[admin/test-deletion-requests/approve] Test questions soft-delete error:", questionsUpdateError);
        // Continue - approval was successful even if questions update failed
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
            type: "test_deletion_approved",
            payload_json: {
              testId: deletionRequest.test_id,
              testTitle: test?.title ?? null,
              requestId,
              message: "Your test deletion request has been approved and the test has been removed",
            },
          });

        if (notifyError) {
          console.error("[admin/test-deletion-requests/approve] Error creating notification:", notifyError);
          // Don't fail the request if notification fails
        }
      }

      return toResponse(
        successResponse({
          requestId: updatedRequest.id,
          testId: updatedRequest.test_id,
          title: test?.title,
          decision: updatedRequest.decision,
          reviewedBy: updatedRequest.reviewed_by_platform_user_id,
          reviewedAt: updatedRequest.reviewed_at,
          updatedAt: updatedRequest.updated_at,
        }),
        200,
      );
    } catch (err) {
      console.error("[admin/test-deletion-requests/approve] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to approve test deletion."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
