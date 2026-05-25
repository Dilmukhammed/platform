/**
 * GET /api/v1/system/health — Get system health status (admin-protected).
 *
 * Requires super_admin role. Returns system status including:
 * - Overall health status (healthy/degraded/unhealthy)
 * - Application version
 * - Uptime (seconds since start)
 * - Database connection status and latency
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

// Track application start time for uptime calculation
const APP_START_TIME = Date.now();

// Application version - should match package.json or be from env
const APP_VERSION = process.env.APP_VERSION ?? "1.0.0";

export const GET = withAuth(
  async () => {
    try {
      const supabase = createServerClient();

      // Check database connection with latency measurement
      const dbStartTime = Date.now();
      const { error: dbError } = await supabase
        .from("platform_users")
        .select("id", { count: "exact", head: true })
        .limit(1);
      const dbLatency = Date.now() - dbStartTime;

      // Determine database status
      let dbStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
      let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

      if (dbError) {
        dbStatus = "unhealthy";
        overallStatus = "unhealthy";
      } else if (dbLatency > 1000) {
        dbStatus = "degraded";
        overallStatus = "degraded";
      }

      // Calculate uptime in seconds
      const uptimeSeconds = Math.floor((Date.now() - APP_START_TIME) / 1000);

      return toResponse(
        successResponse({
          status: overallStatus,
          version: APP_VERSION,
          uptime: uptimeSeconds,
          timestamp: new Date().toISOString(),
          database: {
            status: dbStatus,
            latency: dbLatency,
          },
        }),
      );
    } catch (err) {
      console.error("[system/health] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch system health."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
