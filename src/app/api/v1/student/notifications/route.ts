/**
 * GET /api/v1/student/notifications — List student's notifications.
 *
 * Returns paginated list of notifications for the student.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

const querySchema = z.object({
  read: z.enum(["true", "false"]).optional(),
  type: z.string().optional(),
});

export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);

      const queryValidation = querySchema.safeParse({
        read: searchParams.get("read") ?? undefined,
        type: searchParams.get("type") ?? undefined,
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

      const { read, type } = queryValidation.data;
      const supabase = createServerClient();

      // Build query for notifications
      let dbQuery = supabase
        .from("notifications")
        .select(
          `
          id,
          recipient_type,
          type,
          payload_json,
          read_at,
          created_at
        `,
          { count: "exact" },
        )
        .eq("recipient_student_profile_id", session.userId)
        .eq("recipient_type", "student_profile");

      if (read === "true") {
        dbQuery = dbQuery.not("read_at", "is", null);
      } else if (read === "false") {
        dbQuery = dbQuery.is("read_at", null);
      }

      if (type) {
        dbQuery = dbQuery.eq("type", type);
      }

      // Apply pagination
      const { data: notifications, error, count } = await dbQuery
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[student/notifications] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch notifications."),
        );
      }

      // Transform notifications
      const notificationList = (notifications ?? []).map((n: Record<string, unknown>) => ({
        id: n.id,
        type: n.type,
        payload: n.payload_json,
        isRead: n.read_at !== null,
        readAt: n.read_at,
        createdAt: n.created_at,
      }));

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(notificationList, paginationMeta));
    } catch (err) {
      console.error("[student/notifications] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch notifications."),
      );
    }
  },
  { requiredRole: "student" },
);
