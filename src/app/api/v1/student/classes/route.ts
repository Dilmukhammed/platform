/**
 * GET /api/v1/student/classes — List student's enrolled classes.
 *
 * Returns paginated list of classes the student is enrolled in.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const querySchema = z.object({
  status: z.enum(["active", "inactive", "left", "archived"]).optional(),
});

export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);

      const queryValidation = querySchema.safeParse({
        status: searchParams.get("status") ?? undefined,
      });

      if (!queryValidation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid query parameters.",
            undefined,
            queryValidation.error.issues,
          ),
        );
      }

      const { status } = queryValidation.data;
      const supabase = createServerClient();

      // Build base query for enrollments with class details
      let dbQuery = supabase
        .from("class_enrollments")
        .select(
          `
          id,
          status,
          joined_at,
          left_at,
          source,
          classes!inner(
            id,
            title,
            description,
            status,
            organization_id
          )
        `,
          { count: "exact" },
        )
        .eq("student_profile_id", session.userId)
        .is("deleted_at", null)
        .is("classes.deleted_at", null);

      if (status) {
        dbQuery = dbQuery.eq("status", status);
      }

      // Apply pagination
      const { data: enrollments, error, count } = await dbQuery
        .order("joined_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[student/classes] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch classes."),
        );
      }

      // Transform enrollments to class list format
      // Supabase JS v2 returns many-to-one joins as a single object, not an array
      const classes = (enrollments ?? []).map((enrollment: Record<string, unknown>) => {
        const classData = enrollment.classes as unknown as Record<string, unknown> | null;
        return {
          enrollmentId: enrollment.id,
          classId: classData?.id,
          title: classData?.title,
          description: classData?.description,
          status: enrollment.status,
          joinedAt: enrollment.joined_at,
          leftAt: enrollment.left_at,
          source: enrollment.source,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(classes, paginationMeta));
    } catch (err) {
      console.error("[student/classes] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch classes."),
      );
    }
  },
  { requiredRole: "student" },
);
