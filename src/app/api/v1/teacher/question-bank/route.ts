/**
 * GET /api/v1/teacher/question-bank — List teacher's bank questions.
 * POST /api/v1/teacher/question-bank — Create a new bank question.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";
import { createBankQuestionSchema } from "./types";

/** Route-level schema extends the shared create schema with scope routing fields. */
const createRouteSchema = createBankQuestionSchema.and(
  z.object({
    organizationId: z.string().uuid().optional(),
  }),
);

// GET — List bank questions
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const scopeFilter = searchParams.get("scopeType"); // optional: personal | organization
      const searchQuery = searchParams.get("search"); // optional: ilike on prompt

      const supabase = createServerClient();

      // Build base query
      let query = supabase
        .from("question_bank")
        .select("*", { count: "exact" })
        .is("deleted_at", null);

      // Apply search filter (simple ilike, no pg_trgm)
      if (searchQuery) {
        query = query.ilike("prompt", `%${searchQuery}%`);
      }

      // Apply scope-based filtering
      if (scopeFilter === "personal") {
        query = query
          .eq("scope_type", "personal")
          .eq("owner_teacher_id", session.userId);
      } else if (scopeFilter === "organization") {
        const { data: memberships } = await supabase
          .from("organization_memberships")
          .select("organization_id")
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null);

        const orgIds = (memberships ?? []).map((m) => m.organization_id);
        if (orgIds.length === 0) {
          return toResponse(
            paginatedResponse([], buildPaginationMeta(pagination.page, pagination.pageSize, 0))
          );
        }

        query = query
          .eq("scope_type", "organization")
          .in("owner_organization_id", orgIds);
      } else {
        // No filter: show personal questions + org questions from teacher's orgs
        const { data: memberships } = await supabase
          .from("organization_memberships")
          .select("organization_id")
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null);

        const orgIds = (memberships ?? []).map((m) => m.organization_id);

        if (orgIds.length > 0) {
          query = query.or(
            `and(scope_type.eq.personal,owner_teacher_id.eq.${session.userId}),` +
            `and(scope_type.eq.organization,owner_organization_id.in.(${orgIds.join(",")}))`
          );
        } else {
          query = query
            .eq("scope_type", "personal")
            .eq("owner_teacher_id", session.userId);
        }
      }

      const { data: questions, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/question-bank] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch bank questions."),
        );
      }

      // Transform to response format
      const transformed = (questions ?? []).map((q: Record<string, unknown>) => ({
        questionId: q.id,
        questionType: q.question_type,
        prompt: q.prompt,
        optionsJson: q.options_json,
        answerJson: q.answer_json,
        explanation: q.explanation,
        images: (q.images as string[]) ?? [],
        scopeType: q.scope_type,
        ownerTeacherId: q.owner_teacher_id,
        ownerOrganizationId: q.owner_organization_id,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      }));

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(transformed, paginationMeta));
    } catch (err) {
      console.error("[teacher/question-bank] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch bank questions."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Create bank question
export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = createRouteSchema.safeParse(body);

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

      const { questionType, prompt, optionsJson, answerJson, explanation, images, scopeType, organizationId } = validation.data;
      const supabase = createServerClient();

      // Validate ownership based on scope type
      if (scopeType === "personal") {
        if (organizationId) {
          return toResponse(
            errorResponse(
              ErrorCodes.VALIDATION_ERROR,
              "Organization ID should not be provided for personal scope questions.",
            ),
          );
        }
      } else if (scopeType === "organization") {
        if (!organizationId) {
          return toResponse(
            errorResponse(
              ErrorCodes.VALIDATION_ERROR,
              "Organization ID is required for organization scope questions.",
            ),
          );
        }

        // Verify membership and derive owner_organization_id from validated membership
        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("id, status")
          .eq("organization_id", organizationId)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (membershipError) {
          console.error("[teacher/question-bank] Membership check error:", membershipError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
          );
        }

        if (!membership || membership.status !== "active") {
          return toResponse(
            errorResponse(
              ErrorCodes.FORBIDDEN,
              "You must be an active member of the organization to create questions in its library.",
            ),
          );
        }
      }

      // Build insert data — owner_teacher_id derived from session, NEVER from body
      const insertData: Record<string, unknown> = {
        question_type: questionType,
        prompt,
        options_json: optionsJson ?? {},
        answer_json: answerJson,
        explanation: explanation ?? null,
        images: images ?? [],
        scope_type: scopeType,
      };

      if (scopeType === "personal") {
        insertData.owner_teacher_id = session.userId;
      } else {
        insertData.owner_organization_id = organizationId;
      }

      const { data: question, error: createError } = await supabase
        .from("question_bank")
        .insert(insertData)
        .select("id, question_type, prompt, options_json, answer_json, explanation, images, scope_type, owner_teacher_id, owner_organization_id, created_at, updated_at")
        .single();

      if (createError || !question) {
        console.error("[teacher/question-bank] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create bank question."),
        );
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
        201,
      );
    } catch (err) {
      console.error("[teacher/question-bank] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create bank question."),
      );
    }
  },
  { requiredRole: "teacher" },
);
