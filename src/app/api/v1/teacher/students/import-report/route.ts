/**
 * GET /api/v1/teacher/students/import-report — Returns last import report.
 *
 * For now, returns null/empty if no report exists. This is a placeholder
 * that can be extended to read from a cookie or session storage.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, toResponse } from "@/lib/api/envelope";

export const GET = withAuth(
  async (_request, _context, { session: _session }) => {
    // Placeholder: no persistent import report storage yet
    return toResponse(
      successResponse({
        report: null,
      }),
    );
  },
  { requiredRole: "teacher" },
);
