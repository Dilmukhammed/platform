/**
 * POST /api/v1/teacher/profile/avatar — Get signed upload URL for avatar.
 * GET  /api/v1/teacher/profile/avatar — Redirect to signed avatar URL.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const AVATARS_BUCKET = process.env.SUPABASE_UPLOADS_BUCKET || "uploads";
const SIGNED_URL_EXPIRY = 3600; // 1 hour

// POST — Get signed upload URL for avatar
export const POST = withAuth(
  async (request, _context, { session }) => {
    try {
      const supabase = createServerClient();

      const filePath = `avatars/${session.userId}/${Date.now()}.png`;

      const { data, error } = await supabase.storage
        .from(AVATARS_BUCKET)
        .createSignedUploadUrl(filePath);

      if (error || !data?.signedUrl) {
        console.error("[teacher/profile/avatar] Signed URL error:", error);
        return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate upload URL."));
      }

      return toResponse(
        successResponse({
          signedUrl: data.signedUrl,
          path: filePath,
          token: data.token,
        }),
      );
    } catch (err) {
      console.error("[teacher/profile/avatar] Unexpected error:", err);
      return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate upload URL."));
    }
  },
  { requiredRole: "teacher" },
);

// GET — Redirect to signed avatar URL
export const GET = withAuth(
  async (_request, _context, { session }) => {
    try {
      const supabase = createServerClient();

      // Get current avatar path from platform_users
      const { data: user, error: userError } = await supabase
        .from("platform_users")
        .select("avatar_url")
        .eq("id", session.userId)
        .single();

      if (userError || !user?.avatar_url) {
        return toResponse(errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "No avatar found."));
      }

      const { data, error } = await supabase.storage
        .from(AVATARS_BUCKET)
        .createSignedUrl(user.avatar_url as string, SIGNED_URL_EXPIRY);

      if (error || !data?.signedUrl) {
        console.error("[teacher/profile/avatar] Signed serve URL error:", error);
        return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate avatar URL."));
      }

      return Response.redirect(data.signedUrl);
    } catch (err) {
      console.error("[teacher/profile/avatar] Unexpected error:", err);
      return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to serve avatar."));
    }
  },
  { requiredRole: "teacher" },
);
