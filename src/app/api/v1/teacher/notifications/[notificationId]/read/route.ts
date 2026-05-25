/**
 * POST /api/v1/teacher/notifications/{notificationId}/read — Mark notification as read.
 *
 * Updates the notification's read_at timestamp. Verifies the notification
 * belongs to the authenticated teacher.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

// POST — Mark notification as read
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const notificationId = params.notificationId as string;

      const supabase = createServerClient();

      // Verify the notification exists and belongs to this teacher
      const { data: notification, error: fetchError } = await supabase
        .from("notifications")
        .select("*")
        .eq("id", notificationId)
        .eq("recipient_type", "platform_user")
        .eq("recipient_platform_user_id", session.userId)
        .maybeSingle();

      if (fetchError) {
        console.error("[teacher/notifications/read] Error fetching notification:", fetchError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch notification."),
        );
      }

      if (!notification) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Notification not found."),
        );
      }

      // Check if already read
      if (notification.read_at) {
        return toResponse(
          successResponse({
            notificationId: notification.id,
            isRead: true,
            readAt: notification.read_at,
            message: "Notification was already marked as read.",
          })
        );
      }

      // Mark as read
      const now = new Date().toISOString();
      const { data: updatedNotification, error: updateError } = await supabase
        .from("notifications")
        .update({
          read_at: now,
        })
        .eq("id", notificationId)
        .select("*")
        .single();

      if (updateError || !updatedNotification) {
        console.error("[teacher/notifications/read] Error updating notification:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to mark notification as read."),
        );
      }

      return toResponse(
        successResponse({
          notificationId: updatedNotification.id,
          isRead: true,
          readAt: updatedNotification.read_at,
          type: updatedNotification.type,
          payloadJson: updatedNotification.payload_json,
        })
      );
    } catch (err) {
      console.error("[teacher/notifications/read] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to mark notification as read."),
      );
    }
  },
  { requiredRole: "teacher" },
);
