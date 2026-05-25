/**
 * GET /api/v1/teacher/tests — List teacher's tests.
 * POST /api/v1/teacher/tests — Create a new test.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const testQuestionSchema = z.object({
  orderIndex: z.number().int().min(0),
  questionType: z.string().min(1),
  prompt: z.string().min(1).max(5000),
  optionsJson: z.record(z.string(), z.unknown()).optional(),
  answerJson: z.record(z.string(), z.unknown()),
  explanation: z.string().max(5000).optional(),
  images: z.array(z.string().max(500)).optional(),
});

const createTestSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  scopeType: z.enum(["personal", "organization"]),
  organizationId: z.string().uuid().optional(),
  origin: z.enum(["manual", "ai_draft", "imported"]).default("manual"),
  sourceFilePath: z.string().max(500).optional(),
  questions: z.array(testQuestionSchema).min(1),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showResults: z.enum(["immediate", "after_review", "never"]).default("after_review"),
});

// GET — List tests
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const scopeFilter = searchParams.get("scopeType"); // optional filter: personal | organization
      const originFilter = searchParams.get("origin"); // optional filter: manual | ai_draft | imported

      const supabase = createServerClient();

      // Build base query
      let query = supabase
        .from("tests")
        .select("*, test_questions!left(*), test_approvals!left(*)", { count: "exact" })
        .is("deleted_at", null);

      // Apply origin filter if provided
      if (originFilter) {
        query = query.eq("origin", originFilter);
      }

      // Apply scope-based filtering
      if (scopeFilter === "personal") {
        query = query
          .eq("scope_type", "personal")
          .eq("owner_teacher_id", session.userId);
      } else if (scopeFilter === "organization") {
        // For organization scope, teacher must be a member
        const { data: memberships } = await supabase
          .from("organization_memberships")
          .select("organization_id")
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null);

        const orgIds = (memberships ?? []).map((m) => m.organization_id);
        if (orgIds.length === 0) {
          // No org memberships, return empty
          return toResponse(
            paginatedResponse([], buildPaginationMeta(pagination.page, pagination.pageSize, 0))
          );
        }

        query = query
          .eq("scope_type", "organization")
          .in("owner_organization_id", orgIds);
      } else {
        // No filter: show personal tests + org tests from teacher's orgs
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

      const { data: tests, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/tests] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch tests."),
        );
      }

      // Transform to response format
      const transformed = (tests ?? []).map((test: Record<string, unknown>) => {
        const questions = (test.test_questions as Array<Record<string, unknown>>) ?? [];
        const approvals = (test.test_approvals as Array<Record<string, unknown>>) ?? [];
        const pendingApproval = approvals.find((a) => a.decision === "pending");

        return {
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
          questionCount: questions.length,
          createdAt: test.created_at,
          updatedAt: test.updated_at,
          pendingApproval: pendingApproval
            ? {
                approvalId: pendingApproval.id,
                decision: pendingApproval.decision,
                requestedAt: pendingApproval.created_at,
              }
            : null,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(transformed, paginationMeta));
    } catch (err) {
      console.error("[teacher/tests] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch tests."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Create test
export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const body = await request.json();
      const validation = createTestSchema.safeParse(body);

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

      const { title, description, scopeType, organizationId, origin, sourceFilePath, questions, shuffleQuestions, shuffleOptions, showResults } = validation.data;
      const supabase = createServerClient();

      // Validate ownership based on scope type
      if (scopeType === "personal") {
        // Personal scope: owner_teacher_id must be the current user
        // organizationId should not be provided
        if (organizationId) {
          return toResponse(
            errorResponse(
              ErrorCodes.VALIDATION_ERROR,
              "Organization ID should not be provided for personal scope tests.",
            ),
          );
        }
      } else if (scopeType === "organization") {
        // Organization scope: teacher must be a member of the org
        if (!organizationId) {
          return toResponse(
            errorResponse(
              ErrorCodes.VALIDATION_ERROR,
              "Organization ID is required for organization scope tests.",
            ),
          );
        }

        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("id, status")
          .eq("organization_id", organizationId)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (membershipError) {
          console.error("[teacher/tests] Membership check error:", membershipError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify organization membership."),
          );
        }

        if (!membership || membership.status !== "active") {
          return toResponse(
            errorResponse(
              ErrorCodes.FORBIDDEN,
              "You must be an active member of the organization to create tests in its library.",
            ),
          );
        }
      }

      // Create test
      const testInsertData: Record<string, unknown> = {
        title,
        description,
        scope_type: scopeType,
        origin,
        source_file_path: sourceFilePath,
        status: "draft",
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        show_results: showResults,
      };

      if (scopeType === "personal") {
        testInsertData.owner_teacher_id = session.userId;
      } else {
        testInsertData.owner_organization_id = organizationId;
      }

      // Use transaction to create test and questions
      const { data: test, error: createError } = await supabase
        .from("tests")
        .insert(testInsertData)
        .select("id, title, description, scope_type, owner_teacher_id, owner_organization_id, status, origin, source_file_path, shuffle_questions, shuffle_options, show_results, created_at, updated_at")
        .single();

      if (createError || !test) {
        console.error("[teacher/tests] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create test."),
        );
      }

      // Create questions
      const questionInsertData = questions.map((q) => ({
        test_id: test.id,
        order_index: q.orderIndex,
        question_type: q.questionType,
        prompt: q.prompt,
        options_json: q.optionsJson ?? {},
        answer_json: q.answerJson,
        explanation: q.explanation,
        images: q.images && q.images.length > 0 ? q.images : [],
      }));

      const { data: createdQuestions, error: questionsError } = await supabase
        .from("test_questions")
        .insert(questionInsertData)
        .select("id, order_index, question_type, prompt, options_json, answer_json, explanation, images");

      if (questionsError) {
        console.error("[teacher/tests] Questions creation error:", questionsError);
        // Clean up the orphaned test since questions failed
        await supabase.from("tests").delete().eq("id", test.id);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create test questions."),
        );
      }

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
          questionCount: questions.length,
          questions: (createdQuestions ?? []).map((q) => ({
            questionId: q.id,
            orderIndex: q.order_index,
            questionType: q.question_type,
            prompt: q.prompt,
            optionsJson: q.options_json,
            answerJson: q.answer_json,
            explanation: q.explanation,
            images: (q.images as string[]) ?? [],
          })),
          createdAt: test.created_at,
          updatedAt: test.updated_at,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/tests] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create test."),
      );
    }
  },
  { requiredRole: "teacher" },
);
