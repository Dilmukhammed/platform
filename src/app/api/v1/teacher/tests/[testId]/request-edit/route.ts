/**
 * POST /api/v1/teacher/tests/{testId}/request-edit — Request to edit an approved test.
 *
 * Snapshots the current questions into the last approved approval's
 * previous_questions_json column, then sets the test status to "draft"
 * so the teacher can edit and resubmit.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

export const POST = withAuth(
  async (_request, context, { session }) => {
    try {
      const params = await context.params;
      const testId = params.testId as string;

      const supabase = createServerClient();

      // 1. Fetch test — must exist, be owned by teacher, and be active
      const { data: test, error: fetchError } = await supabase
        .from("tests")
        .select("id, title, description, scope_type, owner_teacher_id, owner_organization_id, status")
        .eq("id", testId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !test) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Ownership check
      if (test.scope_type === "personal") {
        if (test.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to edit this test."),
          );
        }
      } else if (test.scope_type === "organization") {
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id, role")
          .eq("organization_id", test.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to edit this test."),
          );
        }

        if (membership.role !== "owner" && membership.role !== "manager") {
          return toResponse(
            errorResponse(
              ErrorCodes.FORBIDDEN,
              "Only organization owners or admins can edit organization tests.",
            ),
          );
        }
      }

      // Must be active to request edit
      if (test.status === "draft") {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Test is already in draft status and can be edited."),
        );
      }

      if (test.status !== "active") {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Only active tests can be set to draft for editing."),
        );
      }

      // 2. Fetch current questions (the approved version)
      const { data: questions, error: questionsError } = await supabase
        .from("test_questions")
        .select("order_index, question_type, prompt, options_json, answer_json, explanation, images")
        .eq("test_id", testId)
        .order("order_index", { ascending: true });

      if (questionsError) {
        console.error("[teacher/tests/request-edit] Questions fetch error:", questionsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test questions."),
        );
      }

      // Build the snapshot in the required format
      const questionSnapshot = (questions ?? []).map((q) => ({
        orderIndex: q.order_index,
        questionType: q.question_type,
        prompt: q.prompt,
        optionsJson: q.options_json,
        answerJson: q.answer_json,
        explanation: q.explanation,
        images: q.images ?? [],
      }));

      // 3. Find the most recent approved approval
      const { data: lastApprovedApproval, error: approvalFetchError } = await supabase
        .from("test_approvals")
        .select("id")
        .eq("test_id", testId)
        .eq("decision", "approved")
        .is("deleted_at", null)
        .order("reviewed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (approvalFetchError) {
        console.error("[teacher/tests/request-edit] Approval fetch error:", approvalFetchError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch approval records."),
        );
      }

      // 4. Store snapshot into the last approved approval's previous_questions_json
      if (!lastApprovedApproval) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "No approved version found to snapshot for editing."),
        );
      }

      const { error: snapshotError } = await supabase
        .from("test_approvals")
        .update({ previous_questions_json: questionSnapshot })
        .eq("id", lastApprovedApproval.id);

      if (snapshotError) {
        console.error("[teacher/tests/request-edit] Snapshot update error:", snapshotError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to store question snapshot."),
        );
      }

      // 5. Set test status to draft
      const { data: updatedTest, error: updateError } = await supabase
        .from("tests")
        .update({ status: "draft", updated_at: new Date().toISOString() })
        .eq("id", testId)
        .is("deleted_at", null)
        .select("id, title, description, status")
        .single();

      if (updateError || !updatedTest) {
        console.error("[teacher/tests/request-edit] Status update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update test status."),
        );
      }

      // 6. Return test data with questions so the edit form can be pre-filled
      return toResponse(
        successResponse({
          testId: updatedTest.id,
          title: updatedTest.title,
          description: updatedTest.description,
          status: updatedTest.status,
          questions: questionSnapshot,
          previousApprovalId: lastApprovedApproval.id,
          message: "Test set to draft. You can now edit and resubmit for approval.",
        }),
      );
    } catch (err) {
      console.error("[teacher/tests/request-edit] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to request edit."),
      );
    }
  },
  { requiredRole: "teacher" },
);
