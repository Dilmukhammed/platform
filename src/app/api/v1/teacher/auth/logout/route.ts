/**
 * POST /api/v1/teacher/auth/logout — Clear teacher auth session.
 *
 * Clears the HMAC-signed auth cookie, effectively logging the teacher out.
 */

import { clearAuthSession } from "@/lib/auth/session";
import { successResponse, toResponse } from "@/lib/api/envelope";

export async function POST() {
  await clearAuthSession();

  return toResponse(
    successResponse({
      loggedOut: true,
    }),
  );
}
