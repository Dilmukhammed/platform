/**
 * GET    /api/v1/teacher/tests/{testId} — Get test details.
 * PATCH  /api/v1/teacher/tests/{testId} — Update test.
 * DELETE /api/v1/teacher/tests/{testId} — Delete test (soft-delete for drafts/pending, request deletion for active).
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const testQuestionSchema = z.object({
  questionId: z.string().uuid().optional(),
  orderIndex: z.number().int().min(0),
  questionType: z.string().min(1),
  prompt: z.string().min(1).max(5000),
  optionsJson: z.record(z.string(), z.unknown()).optional(),
  answerJson: z.record(z.string(), z.unknown()),
  explanation: z.string().max(5000).optional(),
  images: z.array(z.string().max(500)).optional(),
});

const updateTestSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  sourceFilePath: z.string().max(500).optional(),
  questions: z.array(testQuestionSchema).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showResults: z.enum(["immediate", "after_review", "never"]).optional(),
});

// GET — Get test details
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const testId = params.testId as string;

      const supabase = createServerClient();

      // Fetch test with questions and approval info
      const { data: test, error } = await supabase
        .from("tests")
        .select("*, test_questions!left(*), test_approvals!left(*)")
        .eq("id", testId)
        .is("deleted_at", null)
        .single();

      if (error || !test) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Check ownership/permissions
      if (test.scope_type === "personal") {
        if (test.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this test."),
          );
        }
      } else if (test.scope_type === "organization") {
        // Check if teacher is a member of the organization
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("organization_id", test.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this test."),
          );
        }
      }

      // Check if any attempts exist for this test
      const { count: attemptsCount } = await supabase
        .from("test_attempts")
        .select("id", { count: "exact", head: true })
        .eq("test_id", testId)
        .is("deleted_at", null);

      const hasAttempts = (attemptsCount ?? 0) > 0;

      const questions = (test.test_questions as Array<Record<string, unknown>>) ?? [];
      const approvals = (test.test_approvals as Array<Record<string, unknown>>) ?? [];
      const pendingApproval = approvals.find((a) => a.decision === "pending");
      const lastDecision = approvals
        .filter((a) => a.decision !== "pending")
        .sort((a, b) => new Date(b.reviewed_at as string).getTime() - new Date(a.reviewed_at as string).getTime())[0];

      return toResponse(
        successResponse({
          testId: test.id,
          title: test.title,
          description: test.description,
          scopeType: test.scope_type,
          ownerTeacherId: test.owner_teacher_id,
          ownerOrganizationId: test.owner_organization_id,
          status: test.status,
          origin: test.origin,
          sourceFilePath: test.source_file_path,
          shuffleQuestions: test.shuffle_questions,
          shuffleOptions: test.shuffle_options,
          showResults: test.show_results,
          hasAttempts,
          createdAt: test.created_at,
          updatedAt: test.updated_at,
          questions: questions
            .sort((a, b) => (a.order_index as number) - (b.order_index as number))
            .map((q) => {
              const images = (q.images as string[]) ?? [];
              return {
                questionId: q.id,
                orderIndex: q.order_index,
                questionType: q.question_type,
                prompt: q.prompt,
                optionsJson: q.options_json,
                answerJson: q.answer_json,
                explanation: q.explanation,
                images,
              };
            }),
          pendingApproval: pendingApproval
            ? {
                approvalId: pendingApproval.id,
                decision: pendingApproval.decision,
                requestedAt: pendingApproval.created_at,
              }
            : null,
          lastDecision: lastDecision
            ? {
                approvalId: lastDecision.id,
                decision: lastDecision.decision,
                decisionReason: lastDecision.decision_reason,
                reviewedAt: lastDecision.reviewed_at,
              }
            : null,
        }),
      );
    } catch (err) {
      console.error("[teacher/tests/[testId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// PATCH — Update test
export const PATCH = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const testId = params.testId as string;

      const body = await request.json();
      const validation = updateTestSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid test data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const supabase = createServerClient();

      // Fetch test to check ownership
      const { data: test, error: fetchError } = await supabase
        .from("tests")
        .select("id, scope_type, owner_teacher_id, owner_organization_id, status")
        .eq("id", testId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !test) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Block updates to tests pending deletion
      if (test.status === "deletion_requested") {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "This test is pending deletion by an admin and cannot be edited."),
        );
      }

      // Check ownership/permissions
      if (test.scope_type === "personal") {
        if (test.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to update this test."),
          );
        }
      } else if (test.scope_type === "organization") {
        // Check if teacher is a member of the organization
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id, role")
          .eq("organization_id", test.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to update this test."),
          );
        }

        // For organization tests, only owners/admins can update
        if (membership.role !== "owner" && membership.role !== "manager") {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "Only organization owners or admins can update organization tests."),
          );
        }
      }

      // Check if show_results change is attempted and block if attempts exist
      if (validation.data.showResults !== undefined) {
        const { count: attemptsCount } = await supabase
          .from("test_attempts")
          .select("id", { count: "exact", head: true })
          .eq("test_id", testId)
          .is("deleted_at", null);

        if ((attemptsCount ?? 0) > 0) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "Cannot change show_results after students have submitted attempts."),
          );
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (validation.data.title !== undefined) updateData.title = validation.data.title;
      if (validation.data.description !== undefined) updateData.description = validation.data.description;
      if (validation.data.status !== undefined) updateData.status = validation.data.status;
      if (validation.data.sourceFilePath !== undefined) updateData.source_file_path = validation.data.sourceFilePath;
      if (validation.data.shuffleQuestions !== undefined) updateData.shuffle_questions = validation.data.shuffleQuestions;
      if (validation.data.shuffleOptions !== undefined) updateData.shuffle_options = validation.data.shuffleOptions;
      if (validation.data.showResults !== undefined) updateData.show_results = validation.data.showResults;
      updateData.updated_at = new Date().toISOString();

      // Update test
      const { data: updatedTest, error: updateError } = await supabase
        .from("tests")
        .update(updateData)
        .eq("id", testId)
        .is("deleted_at", null)
        .select("id, title, description, scope_type, owner_teacher_id, owner_organization_id, status, origin, source_file_path, shuffle_questions, shuffle_options, show_results, created_at, updated_at")
        .single();

      if (updateError || !updatedTest) {
        console.error("[teacher/tests/[testId]] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update test."),
        );
      }

      // Update questions if provided
      let updatedQuestions: Array<Record<string, unknown>> = [];
      if (validation.data.questions && validation.data.questions.length > 0) {
        // Delete existing questions
        await supabase
          .from("test_questions")
          .delete()
          .eq("test_id", testId);

        // Insert new questions
        const questionInsertData = validation.data.questions.map((q) => ({
          test_id: testId,
          order_index: q.orderIndex,
          question_type: q.questionType,
          prompt: q.prompt,
          options_json: q.optionsJson ?? {},
          answer_json: q.answerJson,
          explanation: q.explanation,
          images: q.images ?? [],
        }));

        const { data: createdQuestions, error: questionsError } = await supabase
          .from("test_questions")
          .insert(questionInsertData)
          .select("id, order_index, question_type, prompt, options_json, answer_json, explanation, images");

        if (!questionsError && createdQuestions) {
          updatedQuestions = createdQuestions;
        } else if (questionsError) {
          console.error("[teacher/tests/[testId]] Questions insert error after delete:", questionsError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update test questions. Your test may have lost its questions — please contact support."),
          );
        }
      }

      return toResponse(
        successResponse({
          testId: updatedTest.id,
          title: updatedTest.title,
          description: updatedTest.description,
          scopeType: updatedTest.scope_type,
          ownerTeacherId: updatedTest.owner_teacher_id,
          ownerOrganizationId: updatedTest.owner_organization_id,
          status: updatedTest.status,
          origin: updatedTest.origin,
          sourceFilePath: updatedTest.source_file_path,
          shuffleQuestions: updatedTest.shuffle_questions,
          shuffleOptions: updatedTest.shuffle_options,
          showResults: updatedTest.show_results,
          questionCount: updatedQuestions.length,
          questions: updatedQuestions.map((q) => ({
            questionId: q.id,
            orderIndex: q.order_index,
            questionType: q.question_type,
            prompt: q.prompt,
            optionsJson: q.options_json,
            answerJson: q.answer_json,
            explanation: q.explanation,
            images: (q.images as string[]) ?? [],
          })),
          createdAt: updatedTest.created_at,
          updatedAt: updatedTest.updated_at,
        }),
      );
    } catch (err) {
      console.error("[teacher/tests/[testId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update test."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// DELETE — Delete test
export const DELETE = withAuth(
  async (_request, context, { session }) => {
    try {
      const params = await context.params;
      const testId = params.testId as string;

      const supabase = createServerClient();

      // Fetch test to verify existence and ownership
      const { data: test, error: fetchError } = await supabase
        .from("tests")
        .select("id, owner_teacher_id, status")
        .eq("id", testId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !test) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Test not found."),
        );
      }

      // Verify ownership — only the teacher who owns the test can delete it
      if (test.owner_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to delete this test."),
        );
      }

      const testStatus = test.status as string;

      // For tests already in deletion_requested state, reject
      if (testStatus === "deletion_requested") {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Deletion already requested."),
        );
      }

      // For DRAFT and PENDING (under review) tests: soft-delete immediately
      if (testStatus === "draft" || testStatus === "pending") {
        const timestamp = new Date().toISOString();

        // Soft-delete the test record
        const { data: deletedTest, error: deleteError } = await supabase
          .from("tests")
          .update({
            deleted_at: timestamp,
            updated_at: timestamp,
          })
          .eq("id", testId)
          .is("deleted_at", null)
          .select("id")
          .single();

        if (deleteError || !deletedTest) {
          console.error("[teacher/tests/[testId]] Soft-delete error:", deleteError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete test."),
          );
        }

        // Soft-delete all test_questions for this test
        const { error: questionsDeleteError } = await supabase
          .from("test_questions")
          .update({ deleted_at: timestamp })
          .eq("test_id", testId)
          .is("deleted_at", null);

        if (questionsDeleteError) {
          console.error("[teacher/tests/[testId]] Test questions soft-delete error:", questionsDeleteError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete test questions."),
          );
        }

        return toResponse(
          successResponse({
            testId: deletedTest.id,
            message: "Test deleted successfully.",
          }),
        );
      }

      // For ACTIVE tests: create a deletion request and change status
      if (testStatus === "active") {
        const timestamp = new Date().toISOString();

        // Insert a deletion request record
        const { data: deletionRequest, error: requestError } = await supabase
          .from("test_deletion_requests")
          .insert({
            test_id: testId,
            requested_by_platform_user_id: session.userId,
            decision: "pending",
          })
          .select("id, test_id, decision, created_at")
          .single();

        if (requestError || !deletionRequest) {
          console.error("[teacher/tests/[testId]] Deletion request creation error:", requestError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create deletion request."),
          );
        }

        // Update test status to deletion_requested
        const { data: updatedTest, error: updateError } = await supabase
          .from("tests")
          .update({
            status: "deletion_requested",
            updated_at: timestamp,
          })
          .eq("id", testId)
          .is("deleted_at", null)
          .select("id, status")
          .single();

        if (updateError || !updatedTest) {
          console.error("[teacher/tests/[testId]] Status update error:", updateError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update test status."),
          );
        }

        return toResponse(
          successResponse({
            testId: deletionRequest.test_id,
            deletionRequestId: deletionRequest.id,
            decision: deletionRequest.decision,
            requestedAt: deletionRequest.created_at,
            message: "Deletion request submitted. The test status has been updated to deletion_requested.",
          }),
        );
      }

      // Any other status — treat as not allowed
      return toResponse(
        errorResponse(ErrorCodes.CONFLICT, `Cannot delete a test with status '${testStatus}'.`),
      );
    } catch (err) {
      console.error("[teacher/tests/[testId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete test."),
      );
    }
  },
  { requiredRole: "teacher" },
);
