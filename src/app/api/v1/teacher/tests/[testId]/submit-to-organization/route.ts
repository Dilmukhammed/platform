/**
 * POST /api/v1/teacher/tests/{testId}/submit-to-organization — Submit test for organization approval.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const submitSchema = z.object({
  organizationId: z.string().uuid(),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const testId = params.testId as string;

      const body = await request.json();
      const validation = submitSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid submission data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { organizationId } = validation.data;
      const supabase = createServerClient();

      // Fetch test to verify ownership
      const { data: test, error: fetchError } = await supabase
        .from("tests")
        .select("id, scope_type, owner_teacher_id, status")
        .eq("id", testId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !test) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Verify the teacher owns this personal test
      if (test.scope_type !== "personal" || test.owner_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You can only submit your own personal tests for organization approval."),
        );
      }

      // Verify teacher is a member of the target organization
      const { data: membership, error: membershipError } = await supabase
        .from("organization_memberships")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (membershipError) {
        console.error("[teacher/tests/submit] Membership check error:", membershipError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
        );
      }

      if (!membership || membership.status !== "active") {
        return toResponse(
          errorResponse(
            ErrorCodes.FORBIDDEN,
            "You must be an active member of the organization to submit tests for approval.",
          ),
        );
      }

      // Check if there's already a pending approval for this test
      const { data: existingApproval } = await supabase
        .from("test_approvals")
        .select("id")
        .eq("test_id", testId)
        .eq("decision", "pending")
        .is("deleted_at", null)
        .maybeSingle();

      if (existingApproval) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "This test already has a pending approval request."),
        );
      }

      // Detect re-approval: check for a previous approval with a question snapshot
      const { data: previousApproval, error: previousApprovalError } = await supabase
        .from("test_approvals")
        .select("id, previous_questions_json")
        .eq("test_id", testId)
        .not("previous_questions_json", "is", null)
        .is("deleted_at", null)
        .order("reviewed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousApprovalError) {
        console.error("[teacher/tests/submit] Re-approval lookup error:", previousApprovalError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to determine re-approval state."),
        );
      }

      const isReapproval = !!previousApproval;

      // Create approval request
      const insertData: Record<string, unknown> = {
        test_id: testId,
        requested_by_platform_user_id: session.userId,
        decision: "pending",
      };

      if (isReapproval) {
        insertData.is_reapproval = true;
        insertData.previous_questions_json = previousApproval.previous_questions_json;
      }

      const { data: approval, error: approvalError } = await supabase
        .from("test_approvals")
        .insert(insertData)
        .select("id, test_id, decision, created_at")
        .single();

      if (approvalError || !approval) {
        console.error("[teacher/tests/submit] Approval creation error:", approvalError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create approval request."),
        );
      }

      return toResponse(
        successResponse({
          approvalId: approval.id,
          testId: approval.test_id,
          decision: approval.decision,
          requestedAt: approval.created_at,
          message: "Test submitted for organization approval.",
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/tests/submit] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to submit test for approval."),
      );
    }
  },
  { requiredRole: "teacher" },
);
