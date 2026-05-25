/**
 * GET /api/v1/student/materials/{materialId}/download — Download material file.
 *
 * Authenticates the student, verifies access through assignment enrollment chain,
 * and redirects to a signed Supabase Storage URL.
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
  async (request, context, { session }) => {
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
        .select("id, source_file_path, status")
        .eq("id", materialId)
        .is("deleted_at", null)
        .maybeSingle();

      if (materialError) {
        console.error("[student/materials/download] Material query error:", materialError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch material."),
        );
      }

      if (!material) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not found."),
        );
      }

      if (material.status !== "active") {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Material not available."),
        );
      }

      // 2. Check student access via assignment_results
      // Students have access to materials if they have an assignment result
      // for an assignment that has this material linked
      
      // Step 1: Get assignment template IDs that have this material
      const { data: templateMaterials, error: templateError } = await supabase
        .from("assignment_template_materials")
        .select("assignment_template_id")
        .eq("material_id", materialId)
        .is("deleted_at", null);

      if (templateError) {
        console.error("[student/materials/download] Template materials query error:", templateError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify access."),
        );
      }

      if (!templateMaterials || templateMaterials.length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
        );
      }

      const templateIds = templateMaterials.map(tm => tm.assignment_template_id);

      // Step 2: Get assignment_publication_ids for these templates
      const { data: publications, error: pubError } = await supabase
        .from("assignment_publications")
        .select("id")
        .in("assignment_template_id", templateIds)
        .is("deleted_at", null);

      if (pubError) {
        console.error("[student/materials/download] Publications query error:", pubError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify access."),
        );
      }

      if (!publications || publications.length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
        );
      }

      const publicationIds = publications.map(p => p.id);

      // Step 3: Get assignment_publication_class_ids for these publications
      const { data: pubClasses, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .select("id")
        .in("assignment_publication_id", publicationIds)
        .is("deleted_at", null);

      if (pubClassError) {
        console.error("[student/materials/download] Publication classes query error:", pubClassError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify access."),
        );
      }

      if (!pubClasses || pubClasses.length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
        );
      }

      const pubClassIds = pubClasses.map(pc => pc.id);

      // Step 4: Check if student has an assignment_result for any of these publication classes
      // Need to join through class_enrollments to get student_profile_id
      const { data: studentAccess, error: accessError } = await supabase
        .from("assignment_results")
        .select(`
          id,
          class_enrollments!inner(
            student_profile_id
          )
        `)
        .eq("class_enrollments.student_profile_id", session.userId)
        .in("assignment_publication_class_id", pubClassIds)
        .is("deleted_at", null)
        .limit(1);

      if (accessError) {
        console.error("[student/materials/download] Access check error:", accessError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify access."),
        );
      }

      if (!studentAccess || studentAccess.length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this material."),
        );
      }

      // 3. Generate signed URL from Supabase Storage
      const bucketName = process.env.SUPABASE_UPLOADS_BUCKET
        ?? process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET
        ?? "uploads";

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(material.source_file_path, 3600); // 1 hour expiry

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error("[student/materials/download] Signed URL error:", signedUrlError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate download URL."),
        );
      }

      // 4. Redirect to signed URL
      return Response.redirect(signedUrlData.signedUrl, 302);
    } catch (err) {
      console.error("[student/materials/download] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to process download request."),
      );
    }
  },
  { requiredRole: "student" },
);
