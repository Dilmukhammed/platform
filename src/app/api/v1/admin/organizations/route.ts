/**
 * GET /api/v1/admin/organizations — List all organizations.
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
      const status = searchParams.get("status");

      const supabase = createServerClient();

      // Get auth user emails (cross-schema join doesn't work via JS client)
      const authEmails = await getAuthUserEmails();

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
            auth_user_id,
            display_name
          ),
          organization_memberships(
            id
          ),
          organization_students(
            id
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
        console.error("[admin/organizations] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organizations."),
        );
      }

      // Transform to response format
      const formattedOrgs = (organizations ?? []).map((org) => {
        const creator = (Array.isArray(org.platform_users) ? org.platform_users[0] : org.platform_users) as Record<string, unknown> | null | undefined;
        const memberships = org.organization_memberships as Array<Record<string, unknown>> | null;
        const students = org.organization_students as Array<Record<string, unknown>> | null;

        return {
          organizationId: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          teacherCount: memberships?.filter((m) => !m.deleted_at).length ?? 0,
          studentCount: students?.filter((s) => !s.deleted_at).length ?? 0,
          createdBy: creator
            ? {
                userId: creator.id,
                email: creator.auth_user_id ? (authEmails.get(creator.auth_user_id as string) ?? null) : null,
                displayName: creator.display_name,
              }
            : null,
          approvedBy: org.approved_by_platform_user_id,
          approvedAt: org.approved_at,
          createdAt: org.created_at,
          updatedAt: org.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(formattedOrgs, paginationMeta));
    } catch (err) {
      console.error("[admin/organizations] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch organizations."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
