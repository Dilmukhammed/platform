/**
 * POST /api/v1/teacher/assignment-results/{assignmentResultId}/annotations — Add an annotation.
 *
 * Creates a new annotation document on the submission review. If no review exists yet,
 * creates one in draft status first. Verifies teacher has access to the class.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const createAnnotationSchema = z.object({
  derivedAssetId: z.string().uuid(),
  pageIndex: z.number().int().min(0).optional(),
  baseWidth: z.number().int().min(1),
  baseHeight: z.number().int().min(1),
  payloadJson: z.record(z.string(), z.unknown()),
});

function normalizePageScopedQuery<T extends {
  eq: (column: string, value: string | number | boolean) => T;
  is: (column: string, value: null) => T;
}>(query: T, pageIndex: number | null | undefined): T {
  return pageIndex == null ? query.is("page_index", null) : query.eq("page_index", pageIndex);
}

// POST — Add annotation
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const assignmentResultId = params.assignmentResultId as string;

      // Parse and validate request body
      const body = await request.json();
      const validation = createAnnotationSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid annotation data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { derivedAssetId, pageIndex, baseWidth, baseHeight, payloadJson } = validation.data;
      const supabase = createServerClient();

      // Verify teacher has access to this assignment result (two-step query)
      // Step 1: Get the assignment result with its publication class info
      const { data: resultData, error: resultError } = await supabase
        .from("assignment_results")
        .select("id, assignment_publication_class_id")
        .eq("id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[teacher/annotations] Error fetching result:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify assignment result access."),
        );
      }

      if (!resultData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      // Step 2: Get the class_id from the publication class
      const { data: pubClassData, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .select("class_id")
        .eq("id", resultData.assignment_publication_class_id)
        .maybeSingle();

      if (pubClassError || !pubClassData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      // Step 3: Verify teacher access via class_teachers
      const { data: classTeacher, error: teacherError } = await supabase
        .from("class_teachers")
        .select("id")
        .eq("class_id", pubClassData.class_id)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      // Verify the derived asset exists and belongs to a submission file for this result
      const { data: assetData, error: assetError } = await supabase
        .from("derived_assets")
        .select(
          `
          id,
          page_index,
          derivation_status,
          error_message,
          submission_files!inner(assignment_result_id, is_current, deleted_at)
        `
        )
        .eq("id", derivedAssetId)
        .eq("is_current", true)
        .is("deleted_at", null)
        .eq("submission_files.assignment_result_id", assignmentResultId)
        .eq("submission_files.is_current", true)
        .is("submission_files.deleted_at", null)
        .maybeSingle();

      if (assetError) {
        console.error("[teacher/annotations] Error fetching asset:", assetError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify derived asset."),
        );
      }

      if (!assetData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Derived asset not found or does not belong to this submission."),
        );
      }

      if (assetData.derivation_status !== "ready") {
        return toResponse(
          errorResponse(
            ErrorCodes.CONFLICT,
            assetData.derivation_status === "failed"
              ? assetData.error_message ?? "Derived asset generation failed for this submission file."
              : "Derived asset is not ready for annotation yet.",
          ),
        );
      }

      const resolvedPageIndex = assetData.page_index ?? pageIndex ?? null;

      if (pageIndex != null && assetData.page_index != null && assetData.page_index !== pageIndex) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Annotation page does not match the derived asset page."),
        );
      }

      // Check if a review already exists for this result
      let { data: existingReview } = await supabase
        .from("submission_reviews")
        .select("id, status")
        .eq("assignment_result_id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      let reviewId: string;

      if (existingReview) {
        reviewId = existingReview.id;
      } else {
        // Create a new review in draft status
        const { data: newReview, error: createError } = await supabase
          .from("submission_reviews")
          .insert({
            assignment_result_id: assignmentResultId,
            reviewed_by_teacher_id: session.userId,
            status: "draft",
          })
          .select("id")
          .single();

        if (createError || !newReview) {
          console.error("[teacher/annotations] Error creating review:", createError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create review."),
          );
        }

        reviewId = newReview.id;
      }

      // Mark any existing current annotation for this (review, asset, page) as not current
      let latestVersionQuery = supabase
        .from("annotation_documents")
        .select("version")
        .eq("submission_review_id", reviewId)
        .eq("derived_asset_id", derivedAssetId)
        .is("deleted_at", null)
        .order("version", { ascending: false })
        .limit(1);

      latestVersionQuery = normalizePageScopedQuery(latestVersionQuery, resolvedPageIndex);

      const { data: latestVersionRows, error: latestVersionError } = await latestVersionQuery;

      if (latestVersionError) {
        console.error("[teacher/annotations] Error determining annotation version:", latestVersionError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to determine annotation version."),
        );
      }

      const nextVersion = (latestVersionRows?.[0]?.version ?? 0) + 1;

      let updateCurrentQuery = supabase
        .from("annotation_documents")
        .update({ is_current: false })
        .eq("submission_review_id", reviewId)
        .eq("derived_asset_id", derivedAssetId)
        .eq("is_current", true)
        .is("deleted_at", null);

      updateCurrentQuery = normalizePageScopedQuery(updateCurrentQuery, resolvedPageIndex);

      const { error: updateError } = await updateCurrentQuery;

      if (updateError) {
        console.error("[teacher/annotations] Error updating existing annotations:", updateError);
        // Continue anyway - not a fatal error
      }

      // Create the annotation document
      const { data: annotation, error: annotationError } = await supabase
        .from("annotation_documents")
        .insert({
          submission_review_id: reviewId,
          derived_asset_id: derivedAssetId,
          page_index: resolvedPageIndex,
          version: nextVersion,
          is_current: true,
          base_width: baseWidth,
          base_height: baseHeight,
          payload_json: payloadJson,
        })
        .select("*")
        .single();

      if (annotationError || !annotation) {
        console.error("[teacher/annotations] Error creating annotation:", annotationError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create annotation."),
        );
      }

      return toResponse(
        successResponse({
          annotationId: annotation.id,
          reviewId: annotation.submission_review_id,
          derivedAssetId: annotation.derived_asset_id,
          pageIndex: annotation.page_index,
          version: annotation.version,
          isCurrent: annotation.is_current,
          baseWidth: annotation.base_width,
          baseHeight: annotation.base_height,
          payloadJson: annotation.payload_json,
          createdAt: annotation.created_at,
          updatedAt: annotation.updated_at,
        }),
        201,
      );
    } catch (err) {
      console.error("[teacher/annotations] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create annotation."),
      );
    }
  },
  { requiredRole: "teacher" },
);
