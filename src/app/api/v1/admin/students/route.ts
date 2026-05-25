/**
 * GET /api/v1/admin/students — List all students.
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
      const status = searchParams.get("status");

      const supabase = createServerClient();

      let query = supabase
        .from("student_profiles")
        .select(
          `
          id,
          student_login,
          first_name,
          last_name,
          middle_name,
          display_name,
          status,
          created_at,
          updated_at
        `,
          { count: "exact" },
        )
        .is("deleted_at", null);

      // Filter by status if provided
      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data: students, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[admin/students] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch students."),
        );
      }

      // Transform to response format
      const formattedStudents = (students ?? []).map((student: Record<string, unknown>) => {
        return {
          studentId: student.id,
          studentLogin: student.student_login,
          firstName: student.first_name,
          lastName: student.last_name,
          middleName: student.middle_name,
          displayName: student.display_name,
          status: student.status,
          createdAt: student.created_at,
          updatedAt: student.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(formattedStudents, paginationMeta));
    } catch (err) {
      console.error("[admin/students] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch students."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
