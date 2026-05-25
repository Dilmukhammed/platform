/**
 * GET    /api/v1/teacher/question-bank/{questionId} — Get a bank question.
 * PATCH  /api/v1/teacher/question-bank/{questionId} — Update a bank question.
 * DELETE /api/v1/teacher/question-bank/{questionId} — Soft-delete a bank question.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { updateBankQuestionSchema } from "../types";

// GET — Get bank question by ID
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const questionId = params.questionId as string;

      const supabase = createServerClient();

      const { data: question, error } = await supabase
        .from("question_bank")
        .select("*")
        .eq("id", questionId)
        .is("deleted_at", null)
        .single();

      if (error || !question) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Bank question not found."),
        );
      }

      // Ownership check
      if (question.scope_type === "personal") {
        if (question.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this bank question."),
          );
        }
      } else if (question.scope_type === "organization") {
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("organization_id", question.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this bank question."),
          );
        }
      }

      return toResponse(
        successResponse({
          questionId: question.id,
          questionType: question.question_type,
          prompt: question.prompt,
          optionsJson: question.options_json,
          answerJson: question.answer_json,
          explanation: question.explanation,
          images: (question.images as string[]) ?? [],
          scopeType: question.scope_type,
          ownerTeacherId: question.owner_teacher_id,
          ownerOrganizationId: question.owner_organization_id,
          createdAt: question.created_at,
          updatedAt: question.updated_at,
        }),
      );
    } catch (err) {
      console.error("[teacher/question-bank/[questionId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch bank question."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// PATCH — Update bank question
export const PATCH = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const questionId = params.questionId as string;

      const body = await request.json();
      const validation = updateBankQuestionSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid bank question data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const supabase = createServerClient();

      // Fetch question to check ownership
      const { data: question, error: fetchError } = await supabase
        .from("question_bank")
        .select("id, scope_type, owner_teacher_id, owner_organization_id")
        .eq("id", questionId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !question) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Bank question not found."),
        );
      }

      // Ownership check
      if (question.scope_type === "personal") {
        if (question.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to update this bank question."),
          );
        }
      } else if (question.scope_type === "organization") {
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id, role")
          .eq("organization_id", question.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to update this bank question."),
          );
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (validation.data.questionType !== undefined) updateData.question_type = validation.data.questionType;
      if (validation.data.prompt !== undefined) updateData.prompt = validation.data.prompt;
      if (validation.data.optionsJson !== undefined) updateData.options_json = validation.data.optionsJson;
      if (validation.data.answerJson !== undefined) updateData.answer_json = validation.data.answerJson;
      if (validation.data.explanation !== undefined) updateData.explanation = validation.data.explanation;
      if (validation.data.images !== undefined) updateData.images = validation.data.images;
      updateData.updated_at = new Date().toISOString();

      const { data: updated, error: updateError } = await supabase
        .from("question_bank")
        .update(updateData)
        .eq("id", questionId)
        .is("deleted_at", null)
        .select("id, question_type, prompt, options_json, answer_json, explanation, images, scope_type, owner_teacher_id, owner_organization_id, created_at, updated_at")
        .single();

      if (updateError || !updated) {
        console.error("[teacher/question-bank/[questionId]] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update bank question."),
        );
      }

      return toResponse(
        successResponse({
          questionId: updated.id,
          questionType: updated.question_type,
          prompt: updated.prompt,
          optionsJson: updated.options_json,
          answerJson: updated.answer_json,
          explanation: updated.explanation,
          images: (updated.images as string[]) ?? [],
          scopeType: updated.scope_type,
          ownerTeacherId: updated.owner_teacher_id,
          ownerOrganizationId: updated.owner_organization_id,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        }),
      );
    } catch (err) {
      console.error("[teacher/question-bank/[questionId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update bank question."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// DELETE — Soft-delete bank question
export const DELETE = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const questionId = params.questionId as string;

      const supabase = createServerClient();

      // Fetch question to check ownership
      const { data: question, error: fetchError } = await supabase
        .from("question_bank")
        .select("id, scope_type, owner_teacher_id, owner_organization_id")
        .eq("id", questionId)
        .is("deleted_at", null)
        .single();

      if (fetchError || !question) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Bank question not found."),
        );
      }

      // Ownership check
      if (question.scope_type === "personal") {
        if (question.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to delete this bank question."),
          );
        }
      } else if (question.scope_type === "organization") {
        const { data: membership } = await supabase
          .from("organization_memberships")
          .select("id, role")
          .eq("organization_id", question.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have permission to delete this bank question."),
          );
        }
      }

      // Soft-delete: set deleted_at = now()
      const { error: deleteError } = await supabase
        .from("question_bank")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", questionId)
        .is("deleted_at", null);

      if (deleteError) {
        console.error("[teacher/question-bank/[questionId]] Soft-delete error:", deleteError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete bank question."),
        );
      }

      return toResponse(
        successResponse({ questionId }),
      );
    } catch (err) {
      console.error("[teacher/question-bank/[questionId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete bank question."),
      );
    }
  },
  { requiredRole: "teacher" },
);
