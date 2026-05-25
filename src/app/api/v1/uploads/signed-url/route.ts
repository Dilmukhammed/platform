/**
 * GET /api/v1/uploads/signed-url — Generate a signed URL for a file in the uploads bucket.
 *
 * Accepts a `path` query parameter (Supabase Storage path) and returns a 302
 * redirect to a time-limited signed URL. Used by client components to display
 * images stored in the private uploads bucket.
 *
 * NOTE: This endpoint is intentionally unauthenticated so that <img> tags can
 * load images without requiring auth headers. Security is provided by the
 * signed URL itself (time-limited, unguessable token, 1-hour expiry).
 */

import { errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return toResponse(errorResponse(ErrorCodes.VALIDATION_ERROR, "Missing path parameter."));
    }

    // Prevent directory traversal — Supabase Storage handles its own path
    // security, but we block obvious traversal patterns as defense-in-depth.
    if (path.includes("..") || path.startsWith("/")) {
      return toResponse(errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid path."));
    }

    const supabase = createServerClient();
    const bucketName = process.env.SUPABASE_UPLOADS_BUCKET
      ?? process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET
      ?? "uploads";

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate signed URL."));
    }

    return Response.redirect(data.signedUrl, 302);
  } catch (err) {
    console.error("[uploads/signed-url] Unexpected error:", err);
    return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to serve file."));
  }
}
