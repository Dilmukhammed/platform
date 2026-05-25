/**
 * GET /api/v1/teacher/reviews/[reviewId]/annotations — Get annotations for a review.
 * POST /api/v1/teacher/reviews/[reviewId]/annotations — Create annotation.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const createAnnotationSchema = z.object({
  derivedAssetId: z.string().uuid(),
  pageIndex: z.number().int().min(0).optional().nullable(),
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

// GET — Get annotations for review
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const reviewId = params?.reviewId as string;

      if (!reviewId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Review ID is required."),
        );
      }

      const supabase = createServerClient();

      // Verify review belongs to this teacher
      const { data: review, error: reviewError } = await supabase
        .from("submission_reviews")
        .select("reviewed_by_teacher_id, assignment_result_id")
        .eq("id", reviewId)
        .is("deleted_at", null)
        .single();

      if (reviewError || !review) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Review not found."),
        );
      }

      if (review.reviewed_by_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this review."),
        );
      }

      // Get current annotations
      const { data: annotations, error } = await supabase
        .from("annotation_documents")
        .select("id, submission_review_id, derived_asset_id, page_index, version, is_current, base_width, base_height, payload_json, created_at, updated_at")
        .eq("submission_review_id", reviewId)
        .eq("is_current", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[teacher/annotations] Error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch annotations."),
        );
      }

      const data = (annotations ?? []).map((annotation) => ({
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
      }));

      return toResponse(successResponse(data));
    } catch (err) {
      console.error("[teacher/annotations] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch annotations."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Create annotation
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const reviewId = params?.reviewId as string;

      if (!reviewId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Review ID is required."),
        );
      }

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

      // Verify review belongs to this teacher
      const { data: review, error: reviewError } = await supabase
        .from("submission_reviews")
        .select("reviewed_by_teacher_id, assignment_result_id")
        .eq("id", reviewId)
        .is("deleted_at", null)
        .single();

      if (reviewError || !review) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Review not found."),
        );
      }

      if (review.reviewed_by_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this review."),
        );
      }

      const { data: assetData, error: assetError } = await supabase
        .from("derived_assets")
        .select(
          `
          id,
          page_index,
          submission_files!inner(assignment_result_id, is_current, deleted_at)
        `,
        )
        .eq("id", derivedAssetId)
        .eq("is_current", true)
        .is("deleted_at", null)
        .eq("submission_files.assignment_result_id", review.assignment_result_id)
        .eq("submission_files.is_current", true)
        .is("submission_files.deleted_at", null)
        .maybeSingle();

      if (assetError) {
        console.error("[teacher/annotations] Error verifying derived asset:", assetError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify derived asset."),
        );
      }

      if (!assetData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Derived asset not found or does not belong to this review."),
        );
      }

      const resolvedPageIndex = assetData.page_index ?? pageIndex ?? null;

      if (pageIndex != null && assetData.page_index != null && assetData.page_index !== pageIndex) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Annotation page does not match the derived asset page."),
        );
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
      const { data: annotation, error } = await supabase
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

      if (error || !annotation) {
        console.error("[teacher/annotations] Error creating:", error);
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
