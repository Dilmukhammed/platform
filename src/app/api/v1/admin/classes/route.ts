/**
 * GET /api/v1/admin/classes — List all classes.
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
      const organizationId = searchParams.get("organizationId");

      const supabase = createServerClient();

      let query = supabase
        .from("classes")
        .select(
          `
          id,
          organization_id,
          title,
          description,
          status,
          created_at,
          updated_at,
          organizations!inner(
            id,
            name,
            slug
          )
        `,
          { count: "exact" },
        )
        .is("deleted_at", null);

      // Filter by status if provided
      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      // Filter by organization if provided
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data: classes, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[admin/classes] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch classes."),
        );
      }

      // Fetch teacher counts for each class
      const classIds = (classes ?? []).map((c: Record<string, unknown>) => c.id);
      let teacherCounts: Record<string, number> = {};

      if (classIds.length > 0) {
        const { data: teacherData, error: teacherError } = await supabase
          .from("class_teachers")
          .select("class_id, id")
          .in("class_id", classIds)
          .is("deleted_at", null);

        if (!teacherError && teacherData) {
          for (const item of teacherData as Array<Record<string, unknown>>) {
            const cid = item.class_id as string;
            teacherCounts[cid] = (teacherCounts[cid] || 0) + 1;
          }
        }
      }

      // Fetch student counts for each class
      let studentCounts: Record<string, number> = {};

      if (classIds.length > 0) {
        const { data: studentData, error: studentError } = await supabase
          .from("class_enrollments")
          .select("class_id, id")
          .in("class_id", classIds)
          .eq("status", "active")
          .is("deleted_at", null);

        if (!studentError && studentData) {
          for (const item of studentData as Array<Record<string, unknown>>) {
            const cid = item.class_id as string;
            studentCounts[cid] = (studentCounts[cid] || 0) + 1;
          }
        }
      }

      // Transform to response format
      const formattedClasses = (classes ?? []).map((cls: Record<string, unknown>) => {
        const org = (Array.isArray(cls.organizations) ? cls.organizations[0] : cls.organizations) as Record<string, unknown> | null | undefined;

        return {
          classId: cls.id,
          organizationId: cls.organization_id,
          organizationName: org?.name,
          organizationSlug: org?.slug,
          title: cls.title,
          description: cls.description,
          status: cls.status,
          teacherCount: teacherCounts[cls.id as string] || 0,
          studentCount: studentCounts[cls.id as string] || 0,
          createdAt: cls.created_at,
          updatedAt: cls.updated_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(formattedClasses, paginationMeta));
    } catch (err) {
      console.error("[admin/classes] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch classes."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
