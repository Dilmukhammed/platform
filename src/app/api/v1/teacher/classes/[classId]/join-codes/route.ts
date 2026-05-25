/**
 * GET /api/v1/teacher/classes/{classId}/join-codes — List active join codes.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

      const supabase = createServerClient();

      // Verify teacher has access to this class
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id")
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (teacherError) {
        console.error("[teacher/join-codes] Teacher check error:", teacherError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      // Get active join code
      const { data: activeCode, error: activeError } = await supabase
        .from("class_join_codes")
        .select("id, code, status, valid_from, valid_until, created_at")
        .eq("class_id", classId)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

      if (activeError) {
        console.error("[teacher/join-codes] Active code query error:", activeError);
      }

      // Get recent history (revoked/expired codes)
      const { data: history, error: historyError } = await supabase
        .from("class_join_codes")
        .select("id, code, status, valid_from, valid_until, rotated_at, created_at")
        .eq("class_id", classId)
        .in("status", ["revoked", "expired"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (historyError) {
        console.error("[teacher/join-codes] History query error:", historyError);
      }

      return toResponse(
        successResponse({
          classId,
          activeCode: activeCode
            ? {
                joinCodeId: activeCode.id,
                code: activeCode.code,
                status: activeCode.status,
                validFrom: activeCode.valid_from,
                validUntil: activeCode.valid_until,
                createdAt: activeCode.created_at,
              }
            : null,
          history: (history ?? []).map((code: Record<string, unknown>) => ({
            joinCodeId: code.id,
            code: code.code,
            status: code.status,
            validFrom: code.valid_from,
            validUntil: code.valid_until,
            rotatedAt: code.rotated_at,
            createdAt: code.created_at,
          })),
        }),
      );
    } catch (err) {
      console.error("[teacher/join-codes] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch join codes."),
      );
    }
  },
  { requiredRole: "teacher" },
);
