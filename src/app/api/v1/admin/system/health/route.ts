/**
 * GET /api/v1/admin/system/health — Get system health status.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

export const GET = withAuth(
  async () => {
    try {
      const supabase = createServerClient();

      // Check database connection
      const startTime = Date.now();
      const { data: dbCheck, error: dbError } = await supabase
        .from("platform_users")
        .select("id", { count: "exact", head: true })
        .limit(1);
      const dbLatency = Date.now() - startTime;

      const dbStatus = dbError ? "error" : "healthy";

      // Get counts for key entities
      const { count: orgCount } = await supabase
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);

      const { count: teacherCount } = await supabase
        .from("platform_users")
        .select("id", { count: "exact", head: true })
        .eq("role", "teacher")
        .is("deleted_at", null);

      const { count: studentCount } = await supabase
        .from("student_profiles")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);

      const { count: classCount } = await supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);

      return toResponse(
        successResponse({
          status: dbStatus === "healthy" ? "healthy" : "degraded",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
          database: {
            status: dbStatus,
            latency: dbLatency,
          },
          stats: {
            organizations: orgCount ?? 0,
            teachers: teacherCount ?? 0,
            students: studentCount ?? 0,
            classes: classCount ?? 0,
          },
        }),
      );
    } catch (err) {
      console.error("[admin/system/health] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch system health."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
