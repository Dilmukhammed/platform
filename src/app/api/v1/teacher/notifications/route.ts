/**
 * GET /api/v1/teacher/notifications — List teacher notifications.
 *
 * Returns notifications scoped to the teacher (recipient_type=platform_user).
 * Supports filtering by read status.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

// GET — List notifications
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const readFilter = searchParams.get("read"); // optional filter: true | false

      const supabase = createServerClient();

      // Build query for teacher notifications
      let query = supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("recipient_type", "platform_user")
        .eq("recipient_platform_user_id", session.userId)
        .order("created_at", { ascending: false });

      // Apply read filter if provided
      if (readFilter === "true") {
        query = query.not("read_at", "is", null);
      } else if (readFilter === "false") {
        query = query.is("read_at", null);
      }

      const { data: notifications, error, count } = await query
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/notifications] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch notifications."),
        );
      }

      // Transform to response format
      const transformed = (notifications ?? []).map((n: Record<string, unknown>) => ({
        notificationId: n.id,
        recipientType: n.recipient_type,
        recipientPlatformUserId: n.recipient_platform_user_id,
        type: n.type,
        payloadJson: n.payload_json,
        isRead: n.read_at !== null,
        readAt: n.read_at,
        createdAt: n.created_at,
      }));

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      // Get unread count for convenience
      const { count: unreadCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_type", "platform_user")
        .eq("recipient_platform_user_id", session.userId)
        .is("read_at", null);

      return toResponse(
        paginatedResponse(transformed, paginationMeta, {
          unreadCount: unreadCount ?? 0,
        })
      );
    } catch (err) {
      console.error("[teacher/notifications] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch notifications."),
      );
    }
  },
  { requiredRole: "teacher" },
);
