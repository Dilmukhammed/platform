/**
 * GET /api/v1/admin/notifications — List all notifications.
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
      const type = searchParams.get("type");
      const recipientType = searchParams.get("recipientType");
      const read = searchParams.get("read");

      const supabase = createServerClient();

      let query = supabase
        .from("notifications")
        .select(
          `
          id,
          recipient_type,
          recipient_platform_user_id,
          recipient_student_profile_id,
          type,
          payload_json,
          read_at,
          created_at
        `,
          { count: "exact" },
        );

      // Filter by type if provided
      if (type) {
        query = query.eq("type", type);
      }

      // Filter by recipient type if provided
      if (recipientType) {
        query = query.eq("recipient_type", recipientType);
      }

      // Filter by read status if provided
      if (read === "true") {
        query = query.not("read_at", "is", null);
      } else if (read === "false") {
        query = query.is("read_at", null);
      }

      const { data: notifications, error, count } = await query
        .order("created_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[admin/notifications] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch notifications."),
        );
      }

      // Transform to response format
      const formattedNotifications = (notifications ?? []).map((notification: Record<string, unknown>) => {
        return {
          notificationId: notification.id,
          recipientType: notification.recipient_type,
          recipientPlatformUserId: notification.recipient_platform_user_id,
          recipientStudentProfileId: notification.recipient_student_profile_id,
          type: notification.type,
          payload: notification.payload_json,
          isRead: notification.read_at !== null,
          readAt: notification.read_at,
          createdAt: notification.created_at,
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(formattedNotifications, paginationMeta));
    } catch (err) {
      console.error("[admin/notifications] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch notifications."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
