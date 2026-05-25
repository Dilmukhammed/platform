/**
 * GET /api/v1/teacher/materials/{materialId}/download — Download material file.
 *
 * Authenticates the teacher, verifies access using the same rules as the
 * teacher material detail API, and redirects to a signed Supabase Storage URL.
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
  async (_request, context, { session }) => {
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

      const { data: material, error: materialError } = await supabase
        .from("materials")
        .select("id, source_file_path, scope_type, owner_teacher_id, owner_organization_id")
        .eq("id", materialId)
        .is("deleted_at", null)
        .maybeSingle();

      if (materialError) {
        console.error("[teacher/materials/download] Material query error:", materialError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch material."),
        );
      }

      if (!material) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not found."),
        );
      }

      if (material.scope_type === "personal") {
        if (material.owner_teacher_id !== session.userId) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
          );
        }
      } else if (material.scope_type === "organization") {
        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("organization_id", material.owner_organization_id)
          .eq("platform_user_id", session.userId)
          .is("deleted_at", null)
          .maybeSingle();

        if (membershipError) {
          console.error("[teacher/materials/download] Membership query error:", membershipError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify access."),
          );
        }

        if (!membership) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
          );
        }
      }

      if (!material.source_file_path) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material has no attached file."),
        );
      }

      const bucketName = process.env.SUPABASE_UPLOADS_BUCKET
        ?? process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET
        ?? "uploads";

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(material.source_file_path, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error("[teacher/materials/download] Signed URL error:", signedUrlError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate download URL."),
        );
      }

      return Response.redirect(signedUrlData.signedUrl, 302);
    } catch (err) {
      console.error("[teacher/materials/download] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to process download request."),
      );
    }
  },
  { requiredRole: "teacher" },
);
