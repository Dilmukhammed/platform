/**
 * POST /api/v1/admin/test-approvals/{approvalId}/reject — Reject a test.
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
      const approvalId = params.approvalId as string;

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

      // Check if approval exists and is pending
      const { data: approval, error: fetchError } = await supabase
        .from("test_approvals")
        .select("id, test_id, decision, requested_by_platform_user_id, tests(id, title, status)")
        .eq("id", approvalId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !approval) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test approval request not found."),
        );
      }

      if (approval.decision !== "pending") {
        return toResponse(
          errorResponse(
            ErrorCodes.CONFLICT,
            `Test approval is already ${approval.decision}.`,
          ),
        );
      }

      // Update approval decision — atomic guard: only update if still pending
      const { data: updatedApproval, error: updateError } = await supabase
        .from("test_approvals")
        .update({
          decision: "rejected",
          decision_reason: reason,
          reviewed_by_platform_user_id: session.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", approvalId)
        .eq("decision", "pending")
        .select("id, test_id, decision, decision_reason, reviewed_by_platform_user_id, reviewed_at, updated_at")
        .single();

      if (updateError) {
        console.error("[admin/test-approvals/reject] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reject test."),
        );
      }

      if (!updatedApproval) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Test approval has already been processed."),
        );
      }

      // Rejection returns the test to draft state so teacher can edit and resubmit
      const { error: testUpdateError } = await supabase
        .from("tests")
        .update({ status: "draft" })
        .eq("id", approval.test_id)
        .is("deleted_at", null);

      if (testUpdateError) {
        console.error("[admin/test-approvals/reject] Test update error:", testUpdateError);
        // Continue - approval was successful even if test update failed
      }

      // Normalize joined test data (Supabase may return as array or object)
      const test = (Array.isArray(approval.tests) ? approval.tests[0] : approval.tests) as Record<string, unknown> | null | undefined;

      // Notify the teacher who submitted the test
      if (approval.requested_by_platform_user_id) {
        const { error: notifyError } = await supabase
          .from("notifications")
          .insert({
            recipient_type: "platform_user",
            recipient_platform_user_id: approval.requested_by_platform_user_id,
            type: "test_rejected",
            payload_json: {
              testId: approval.test_id,
              testTitle: test?.title ?? "Untitled Test",
              approvalId: approval.id,
              rejectionReason: reason,
              message: "Your test submission has been rejected",
            },
          });

        if (notifyError) {
          console.error("[admin/test-approvals/reject] Error creating notification:", notifyError);
          // Don't fail the request if notification fails
        }
      }

      return toResponse(
        successResponse({
          approvalId: updatedApproval.id,
          testId: updatedApproval.test_id,
          title: test?.title,
          decision: updatedApproval.decision,
          rejectionReason: updatedApproval.decision_reason,
          reviewedBy: updatedApproval.reviewed_by_platform_user_id,
          reviewedAt: updatedApproval.reviewed_at,
          updatedAt: updatedApproval.updated_at,
        }),
        200,
      );
    } catch (err) {
      console.error("[admin/test-approvals/reject] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to reject test."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
