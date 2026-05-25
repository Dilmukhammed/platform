/**
 * GET /api/v1/admin/test-approvals — List test approval requests.
 */

import { withAuth } from "@/lib/api/with-auth";
import { paginatedResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient, getAuthUserEmails } from "@/lib/supabase/server-client";

function parsePreviousQuestions(raw: unknown): Array<{
  questionId: string;
  questionType: string;
  prompt: string;
  optionsJson: Record<string, unknown> | null;
  answerJson: Record<string, unknown> | null;
  explanation: string | null;
  images: string[];
}> | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((q: Record<string, unknown>, idx: number) => ({
    questionId: (q.id ?? q.questionId ?? `prev-${idx}`) as string,
    questionType: (q.questionType as string) ?? "unknown",
    prompt: (q.prompt as string) ?? "",
    optionsJson: (q.optionsJson ?? q.options_json ?? null) as Record<string, unknown> | null,
    answerJson: (q.answerJson ?? q.answer_json ?? null) as Record<string, unknown> | null,
    explanation: (q.explanation ?? null) as string | null,
    images: ((q.images as string[]) ?? (q.imageUrl ? [q.imageUrl] : [])) ,
  }));
}

export const GET = withAuth(
  async (request) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const status = searchParams.get("status") || "pending";

      const supabase = createServerClient();

      // Get auth user emails (cross-schema join doesn't work via JS client)
      const authEmails = await getAuthUserEmails();

      let query = supabase
        .from("test_approvals")
        .select(
          `
          id,
          test_id,
          decision,
          requested_by_platform_user_id,
          reviewed_by_platform_user_id,
          decision_reason,
          is_reapproval,
          previous_questions_json,
          reviewed_at,
          created_at,
          updated_at,
          tests!inner(
            id,
            title,
            description,
            scope_type,
            origin,
            owner_teacher_id,
            owner_organization_id,
            status,
            test_questions!left(
              id,
              order_index,
              question_type,
              prompt,
              options_json,
              answer_json,
              explanation,
              images
            )
          ),
          platform_users!test_approvals_requested_by_platform_user_id_fkey(
            id,
            auth_user_id,
            display_name
          )
        `,
          { count: "exact" },
        )
        .is("deleted_at", null);

      // Filter by decision status if provided
      if (status && status !== "all") {
        query = query.eq("decision", status);
      }

      const { data: approvals, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[admin/test-approvals] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test approvals."),
        );
      }

      // Transform to response format
      const formattedApprovals = (approvals ?? []).map((approval) => {
        // Supabase returns a single object for !inner joins on unique FK, not an array
        const test = (Array.isArray(approval.tests) ? approval.tests[0] : approval.tests) as Record<string, unknown> | null | undefined;
        const requester = (Array.isArray(approval.platform_users) ? approval.platform_users[0] : approval.platform_users) as Record<string, unknown> | null | undefined;

        return {
          approvalId: approval.id,
          testId: approval.test_id,
          title: test?.title,
          description: test?.description,
          scopeType: test?.scope_type,
          origin: test?.origin,
          ownerTeacherId: test?.owner_teacher_id,
          ownerOrganizationId: test?.owner_organization_id,
          testStatus: test?.status,
          decision: approval.decision,
          isReapproval: approval.is_reapproval ?? false,
          questions: ((test?.test_questions as Array<Record<string, unknown>> | undefined) ?? [])
            .sort((a, b) => ((a.order_index as number) ?? 0) - ((b.order_index as number) ?? 0))
            .map((q) => ({
              questionId: q.id,
              questionType: q.question_type,
              prompt: q.prompt,
              optionsJson: q.options_json,
              answerJson: q.answer_json,
              explanation: q.explanation,
              images: (q.images as string[]) ?? [],
            })),
          previousQuestions: approval.previous_questions_json
            ? parsePreviousQuestions(approval.previous_questions_json)
            : null,
          requestedBy: requester
            ? {
                userId: requester.id,
                email: requester.auth_user_id ? (authEmails.get(requester.auth_user_id as string) ?? null) : null,
                displayName: requester.display_name,
              }
            : null,
          requestedAt: approval.created_at,
          reviewedBy: approval.reviewed_by_platform_user_id,
          reviewedAt: approval.reviewed_at,
          rejectionReason: approval.decision_reason,
          createdAt: approval.created_at,
          updatedAt: approval.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(formattedApprovals, paginationMeta));
    } catch (err) {
      console.error("[admin/test-approvals] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test approvals."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
