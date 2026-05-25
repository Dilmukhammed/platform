/**
 * GET /api/v1/teacher/submissions/[submissionId]/assets — Get submission assets.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

function getFileExtension(value: string | null | undefined) {
  if (!value) {
    return "unknown";
  }

  const normalized = value.trim();
  const lastDot = normalized.lastIndexOf(".");

  if (lastDot < 0 || lastDot === normalized.length - 1) {
    return "unknown";
  }

  return normalized.slice(lastDot + 1).toLowerCase();
}

function mapDerivedAssetVariant(kind: unknown): "preview" | "page_preview" {
  return kind === "pdf_page_preview" ? "page_preview" : "preview";
}

// GET — Get submission assets
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const submissionId = params?.submissionId as string;

      if (!submissionId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Submission ID is required."),
        );
      }

      const supabase = createServerClient();

      // First verify the submission belongs to this teacher
      const { data: submission, error: subError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          assignment_publication_classes!inner(
            assignment_publications!inner(published_by_teacher_id)
          )
        `
        )
        .eq("id", submissionId)
        .is("deleted_at", null)
        .single();

      if (subError || !submission) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Submission not found."),
        );
      }

      const pubClass = submission.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const pub = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      
      if (pub?.published_by_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this submission."),
        );
      }

      // Bridge the legacy submission-assets response onto canonical submission_files + derived_assets.
      const { data: files, error } = await supabase
        .from("submission_files")
        .select(
          `
          id,
          file_kind,
          original_filename,
          mime_type,
          original_storage_path,
          file_size_bytes,
          sort_order,
          created_at,
          derived_assets!left(
            id,
            kind,
            storage_path,
            page_index,
            width,
            height,
            created_at,
            is_current,
            deleted_at
          )
        `,
        )
        .eq("assignment_result_id", submissionId)
        .eq("is_current", true)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("[teacher/submissions/assets] Error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch submission assets."),
        );
      }

      const data = (files ?? []).flatMap((file) => {
        const originalAsset = {
          id: file.id,
          fileName: file.original_filename,
          assetKind: file.file_kind,
          extension: getFileExtension(file.original_filename ?? file.original_storage_path),
          pageNumber: null,
          variant: "original" as const,
          storagePath: file.original_storage_path,
        };

        const derivedAssets = ((file.derived_assets as Array<Record<string, unknown>>) ?? [])
          .filter((asset) => asset.is_current === true && asset.deleted_at == null)
          .sort((left, right) => {
            const leftPage = typeof left.page_index === "number" ? left.page_index : -1;
            const rightPage = typeof right.page_index === "number" ? right.page_index : -1;

            if (leftPage !== rightPage) {
              return leftPage - rightPage;
            }

            return String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""));
          })
          .map((asset) => ({
            id: String(asset.id ?? ""),
            fileName: file.original_filename,
            assetKind: file.file_kind,
            extension: getFileExtension(
              typeof asset.storage_path === "string" ? asset.storage_path : file.original_filename,
            ),
            pageNumber: typeof asset.page_index === "number" ? asset.page_index + 1 : null,
            variant: mapDerivedAssetVariant(asset.kind),
            storagePath: String(asset.storage_path ?? ""),
          }));

        return [originalAsset, ...derivedAssets];
      });

      return toResponse(successResponse(data));
    } catch (err) {
      console.error("[teacher/submissions/assets] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch submission assets."),
      );
    }
  },
  { requiredRole: "teacher" },
);
