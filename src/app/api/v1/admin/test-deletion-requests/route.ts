/**
 * GET /api/v1/admin/test-deletion-requests — List test deletion requests.
 */

import { withAuth } from "@/lib/api/with-auth";
import { paginatedResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient, getAuthUserEmails } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (request) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const decision = searchParams.get("decision") || "pending";

      const supabase = createServerClient();

      // Get auth user emails (cross-schema join doesn't work via JS client)
      const authEmails = await getAuthUserEmails();

      let query = supabase
        .from("test_deletion_requests")
        .select(
          `
          id,
          test_id,
          decision,
          reason,
          requested_by_platform_user_id,
          reviewed_by_platform_user_id,
          review_reason,
          reviewed_at,
          created_at,
          updated_at,
          tests!inner(
            id,
            title,
            description,
            scope_type,
            owner_teacher_id
          ),
          platform_users!test_deletion_requests_requested_by_platform_user_id_fkey(
            id,
            auth_user_id,
            display_name
          )
        `,
          { count: "exact" },
        )
        .is("deleted_at", null);

      // Filter by decision status if provided
      if (decision && decision !== "all") {
        query = query.eq("decision", decision);
      }

      const { data: requests, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[admin/test-deletion-requests] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test deletion requests."),
        );
      }

      // Transform to response format
      const formattedRequests = (requests ?? []).map((req) => {
        // Supabase returns a single object for !inner joins on unique FK, not an array
        const test = (Array.isArray(req.tests) ? req.tests[0] : req.tests) as Record<string, unknown> | null | undefined;
        const requester = (Array.isArray(req.platform_users) ? req.platform_users[0] : req.platform_users) as Record<string, unknown> | null | undefined;

        return {
          requestId: req.id,
          testId: req.test_id,
          title: test?.title,
          description: test?.description,
          scopeType: test?.scope_type,
          ownerTeacherId: test?.owner_teacher_id,
          decision: req.decision,
          reason: req.reason,
          requestedBy: requester
            ? {
                userId: requester.id,
                email: requester.auth_user_id ? (authEmails.get(requester.auth_user_id as string) ?? null) : null,
                displayName: requester.display_name,
              }
            : null,
          requestedAt: req.created_at,
          reviewedBy: req.reviewed_by_platform_user_id,
          reviewReason: req.review_reason,
          reviewedAt: req.reviewed_at,
          createdAt: req.created_at,
          updatedAt: req.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(formattedRequests, paginationMeta));
    } catch (err) {
      console.error("[admin/test-deletion-requests] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch test deletion requests."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
