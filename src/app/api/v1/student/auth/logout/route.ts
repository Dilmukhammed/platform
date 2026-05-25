/**
 * POST /api/v1/student/auth/logout — Clear session cookie.
 *
 * Clears the HMAC-signed auth cookie, effectively logging the user out.
 */

import { clearAuthSession } from "@/lib/auth/session";
import { successResponse, toResponse } from "@/lib/api/envelope";

export async function POST() {
  await clearAuthSession();

  return toResponse(
    successResponse({
      authenticated: false,
      message: "Logged out successfully.",
    }),
  );
}
