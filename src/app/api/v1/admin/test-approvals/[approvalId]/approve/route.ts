/**
 * POST /api/v1/admin/test-approvals/{approvalId}/approve — Approve a test.
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
      const approvalId = params.approvalId as string;

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
          decision: "approved",
          reviewed_by_platform_user_id: session.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", approvalId)
        .eq("decision", "pending")
        .select("id, test_id, decision, reviewed_by_platform_user_id, reviewed_at, updated_at")
        .single();

      if (updateError) {
        console.error("[admin/test-approvals/approve] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to approve test."),
        );
      }

      if (!updatedApproval) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Test approval has already been processed."),
        );
      }

      // Update test status to active
      const { error: testUpdateError } = await supabase
        .from("tests")
        .update({ status: "active" })
        .eq("id", approval.test_id)
        .is("deleted_at", null);

      if (testUpdateError) {
        console.error("[admin/test-approvals/approve] Test update error:", testUpdateError);
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
            type: "test_approved",
            payload_json: {
              testId: approval.test_id,
              testTitle: test?.title ?? null,
              approvalId,
              message: "Your test has been approved and is now visible in the school library",
            },
          });

        if (notifyError) {
          console.error("[admin/test-approvals/approve] Error creating notification:", notifyError);
          // Don't fail the request if notification fails
        }
      }

      return toResponse(
        successResponse({
          approvalId: updatedApproval.id,
          testId: updatedApproval.test_id,
          title: test?.title,
          decision: updatedApproval.decision,
          reviewedBy: updatedApproval.reviewed_by_platform_user_id,
          reviewedAt: updatedApproval.reviewed_at,
          updatedAt: updatedApproval.updated_at,
        }),
        200,
      );
    } catch (err) {
      console.error("[admin/test-approvals/approve] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to approve test."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
