/**
 * GET /api/v1/admin/organization-approvals — List organization approval requests.
 */

import { withAuth } from "@/lib/api/with-auth";
import { paginatedResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (request) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const status = searchParams.get("status") || "pending";

      const supabase = createServerClient();

      let query = supabase
        .from("organizations")
        .select(
          `
          id,
          name,
          slug,
          status,
          created_by_platform_user_id,
          approved_by_platform_user_id,
          approved_at,
          created_at,
          updated_at,
          platform_users!organizations_created_by_platform_user_id_fkey(
            id,
            email,
            display_name
          )
        `,
          { count: "exact" },
        )
        .is("deleted_at", null);

      // Filter by status if provided
      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data: organizations, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[admin/organization-approvals] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organization approvals."),
        );
      }

      // Transform to response format
      const approvals = (organizations ?? []).map((org: Record<string, unknown>) => {
        const requester = (Array.isArray(org.platform_users) ? org.platform_users[0] : org.platform_users) as Record<string, unknown> | null | undefined;
        return {
          approvalId: org.id,
          organizationId: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          requestedBy: requester
            ? {
                userId: requester.id,
                email: requester.email,
                displayName: requester.display_name,
              }
            : null,
          requestedAt: org.created_at,
          decidedBy: org.approved_by_platform_user_id,
          decidedAt: org.approved_at,
          createdAt: org.created_at,
          updatedAt: org.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(approvals, paginationMeta));
    } catch (err) {
      console.error("[admin/organization-approvals] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organization approvals."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
