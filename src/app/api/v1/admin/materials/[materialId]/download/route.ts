/**
 * GET /api/v1/admin/materials/{materialId}/download — Download material file (admin).
 *
 * Authenticates the admin, fetches the material, and redirects to a signed
 * Supabase Storage URL. Admin has access to all materials regardless of status.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  materialId: z.string().uuid("Invalid material ID format."),
});

export const GET = withAuth(
  async (_request, context) => {
    try {
      const params = await context.params;
      const validation = paramsSchema.safeParse(params);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid material ID.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { materialId } = validation.data;
      const supabase = createServerClient();

      // 1. Get material info
      const { data: material, error: materialError } = await supabase
        .from("materials")
        .select("id, source_file_path")
        .eq("id", materialId)
        .is("deleted_at", null)
        .maybeSingle();

      if (materialError) {
        console.error("[admin/materials/download] Material query error:", materialError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch material."),
        );
      }

      if (!material) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not found."),
        );
      }

      if (!material.source_file_path) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material has no attached file."),
        );
      }

      // 2. Generate signed URL from Supabase Storage
      const bucketName = process.env.SUPABASE_UPLOADS_BUCKET
        ?? process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET
        ?? "uploads";

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(material.source_file_path, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error("[admin/materials/download] Signed URL error:", signedUrlError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate download URL."),
        );
      }

      // 3. Redirect to signed URL
      return Response.redirect(signedUrlData.signedUrl, 302);
    } catch (err) {
      console.error("[admin/materials/download] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to process download request."),
      );
    }
  },
  { requiredRole: "super_admin" },
);
