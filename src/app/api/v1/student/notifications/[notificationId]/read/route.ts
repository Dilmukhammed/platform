/**
 * POST /api/v1/student/notifications/{notificationId}/read
 *
 * Mark a notification as read.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  notificationId: z.string().uuid("Invalid notification ID format."),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const validation = paramsSchema.safeParse(params);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid notification ID.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { notificationId } = validation.data;
      const supabase = createServerClient();

      // Get notification and verify ownership
      const { data: notification, error: fetchError } = await supabase
        .from("notifications")
        .select(
          `
          id,
          recipient_student_profile_id,
          read_at
        `,
        )
        .eq("id", notificationId)
        .eq("recipient_type", "student_profile")
        .maybeSingle();

      if (fetchError) {
        console.error("[student/notifications/read] Supabase error:", fetchError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch notification."),
        );
      }

      if (!notification) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Notification not found."),
        );
      }

      if (notification.recipient_student_profile_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You can only mark your own notifications as read."),
        );
      }

      // Already read
      if (notification.read_at) {
        return toResponse(
          successResponse({
            notificationId: notification.id,
            readAt: notification.read_at,
            wasAlreadyRead: true,
          }),
        );
      }

      // Mark as read
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("id", notificationId)
        .select("id, read_at")
        .single();

      if (updateError || !updated) {
        console.error("[student/notifications/read] Update error:", updateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to mark notification as read."),
        );
      }

      return toResponse(
        successResponse({
          notificationId: updated.id,
          readAt: updated.read_at,
          wasAlreadyRead: false,
        }),
      );
    } catch (err) {
      console.error("[student/notifications/read] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to mark notification as read."),
      );
    }
  },
  { requiredRole: "student" },
);
