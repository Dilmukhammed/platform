/**
 * GET /api/v1/admin/teachers — List all teachers.
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

      // Query platform_users with teacher role
      let query = supabase
        .from("platform_users")
        .select(
          `
          id,
          auth_user_id,
          display_name,
          role,
          status,
          created_at,
          updated_at
        `,
          { count: "exact" },
        )
        .eq("role", "teacher")
        .is("deleted_at", null);

      // Filter by status if provided
      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data: teachers, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[admin/teachers] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch teachers."),
        );
      }

      // Transform to response format
      const formattedTeachers = (teachers ?? []).map((teacher) => {
        return {
          teacherId: teacher.id,
          userId: teacher.id,
          email: teacher.auth_user_id ? (authEmails.get(teacher.auth_user_id) ?? null) : null,
          displayName: teacher.display_name,
          role: teacher.role,
          status: teacher.status,
          createdAt: teacher.created_at,
          updatedAt: teacher.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(formattedTeachers, paginationMeta));
    } catch (err) {
      console.error("[admin/teachers] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch teachers."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
