/**
 * POST /api/v1/student/assignment-results/{assignmentResultId}/submission-files/complete
 *
 * Mark a submission file upload as complete after the file has been uploaded to storage.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { renderPdfPagePreviewSvg, inspectUploadedPdf, buildUploadedPdfPagePreviewAssets } from "@/lib/pdf/page-previews";
import { buildUploadedImagePreviewAsset, type CanonicalDerivedAssetDraft } from "@/lib/storage/submission-assets";
import { createServerClient } from "@/lib/supabase/server-client";

import { getUploadSessionById, uploadSessionBelongsToUser } from "@/app/api/v1/uploads/store";

const paramsSchema = z.object({
  assignmentResultId: z.string().uuid("Invalid assignment result ID format."),
});

const completeSchema = z.object({
  uploadId: z.string().uuid("Invalid upload ID format."),
  fileRole: z.enum(["main", "attachment", "reference", "source"]),
  fileKind: z.enum(["image", "pdf", "dwg", "other"]),
  originalFilename: z.string().min(1, "Original filename is required."),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

type DerivationStatus = "pending" | "processing" | "ready" | "failed";

type CreatedSubmissionFile = {
  id: string;
  assignment_result_id: string;
  file_role: string;
  file_kind: "image" | "pdf" | "dwg" | "other";
  original_storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size_bytes: number;
  sort_order: number;
  created_at: string;
  is_current: boolean;
};

type DerivedAssetStatusRow = {
  id: string;
  kind: string;
  storage_path: string;
  page_index: number | null;
  width: number | null;
  height: number | null;
  derivation_status: DerivationStatus;
  error_message: string | null;
  mime_type: string | null;
  byte_size: number | null;
};

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const paramsValidation = paramsSchema.safeParse(params);

      if (!paramsValidation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid assignment result ID.",
            undefined,
            paramsValidation.error.issues,
          ),
        );
      }

      const { assignmentResultId } = paramsValidation.data;

      const body = await request.json();
      const bodyValidation = completeSchema.safeParse(body);

      if (!bodyValidation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid request body.",
            undefined,
            bodyValidation.error.issues,
          ),
        );
      }

      const { uploadId, fileRole, fileKind, originalFilename, mimeType, fileSizeBytes, sortOrder } = bodyValidation.data;
      const supabase = createServerClient();

      // Verify ownership of assignment result
      const { data: result, error: resultError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          status,
          class_enrollments!inner(
            student_profile_id
          )
        `,
        )
        .eq("id", assignmentResultId)
        .eq("class_enrollments.student_profile_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[student/submission-files/complete] Supabase error:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify assignment."),
        );
      }

      if (!result) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment not found."),
        );
      }

      const upload = await getUploadSessionById(supabase, uploadId);

      if (!upload) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Upload session not found."),
        );
      }

      if (!uploadSessionBelongsToUser(upload, session)) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this upload."),
        );
      }

      if (
        upload.uploadType !== "submission"
        || upload.contextType !== "assignment_result"
        || upload.contextId !== assignmentResultId
      ) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Upload session does not belong to this assignment result.",
          ),
        );
      }

      if (upload.status !== "completed") {
        return toResponse(
          errorResponse(
            ErrorCodes.CONFLICT,
            "Upload must be finalized before it can be attached to the submission.",
          ),
        );
      }

      const resolvedStoragePath = upload.storagePath;
      const resolvedMimeType = upload.completedMimeType ?? upload.declaredMimeType ?? mimeType ?? null;
      const resolvedFileSizeBytes = upload.completedFileSize ?? upload.declaredFileSize ?? fileSizeBytes;

      if (!resolvedFileSizeBytes || resolvedFileSizeBytes < 1) {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Finalized upload is missing file size metadata."),
        );
      }

      const { data: existingSubmissionFile, error: existingFileError } = await supabase
        .from("submission_files")
        .select(
          `
          id,
          assignment_result_id,
          file_role,
          file_kind,
          original_storage_path,
          original_filename,
          mime_type,
          file_size_bytes,
          sort_order,
          created_at,
          is_current
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .eq("original_storage_path", resolvedStoragePath)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingFileError) {
        console.error("[student/submission-files/complete] Existing file query error:", existingFileError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch submission file."),
        );
      }

      if (existingSubmissionFile) {
        const existingDerivedAssets = await getDerivedAssetStatusRows(supabase, existingSubmissionFile.id);

        return toResponse(
          successResponse({
            submissionFileId: existingSubmissionFile.id,
            assignmentResultId: existingSubmissionFile.assignment_result_id,
            fileRole: existingSubmissionFile.file_role,
            fileKind: existingSubmissionFile.file_kind,
            storagePath: existingSubmissionFile.original_storage_path,
            originalFilename: existingSubmissionFile.original_filename,
            mimeType: existingSubmissionFile.mime_type,
            fileSizeBytes: existingSubmissionFile.file_size_bytes,
            sortOrder: existingSubmissionFile.sort_order,
            isCurrent: existingSubmissionFile.is_current,
            createdAt: existingSubmissionFile.created_at,
            status: "complete",
            derivation: summarizeDerivation(existingDerivedAssets),
            derivedAssets: mapDerivedAssetStatusRows(existingDerivedAssets),
          }),
        );
      }

      const { error: clearCurrentError } = await supabase
        .from("submission_files")
        .update({ is_current: false })
        .eq("assignment_result_id", assignmentResultId)
        .eq("file_role", fileRole)
        .eq("is_current", true)
        .is("deleted_at", null);

      if (clearCurrentError) {
        console.error("[student/submission-files/complete] Clear current error:", clearCurrentError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to finalize submission file."),
        );
      }

      const { data: submissionFile, error: createError } = await supabase
        .from("submission_files")
        .insert({
          assignment_result_id: assignmentResultId,
          file_role: fileRole,
          file_kind: fileKind,
          original_storage_path: resolvedStoragePath,
          original_filename: originalFilename,
          mime_type: resolvedMimeType,
          file_size_bytes: resolvedFileSizeBytes,
          sort_order: sortOrder,
          is_current: true,
        })
        .select(
          `
          id,
          assignment_result_id,
          file_role,
          file_kind,
          original_storage_path,
          original_filename,
          mime_type,
          file_size_bytes,
          sort_order,
          created_at,
          is_current
        `,
        )
        .single();

      if (createError || !submissionFile) {
        console.error("[student/submission-files/complete] Create error:", createError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to finalize submission file."),
        );
      }

      const derivation = await generateDerivedAssetsForSubmissionFile({
        supabase,
        storageBucket: upload.storageBucket,
        submissionFile: submissionFile as CreatedSubmissionFile,
      });

      return toResponse(
        successResponse({
          submissionFileId: submissionFile.id,
          assignmentResultId: submissionFile.assignment_result_id,
          fileRole: submissionFile.file_role,
          fileKind: submissionFile.file_kind,
          storagePath: submissionFile.original_storage_path,
          originalFilename: submissionFile.original_filename,
          mimeType: submissionFile.mime_type,
          fileSizeBytes: submissionFile.file_size_bytes,
          sortOrder: submissionFile.sort_order,
          isCurrent: submissionFile.is_current,
          createdAt: submissionFile.created_at,
          status: "complete",
          derivation,
        }),
      );
    } catch (err) {
      console.error("[student/submission-files/complete] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to complete submission file."),
      );
    }
  },
  { requiredRole: "student" },
);

async function getDerivedAssetStatusRows(
  supabase: ReturnType<typeof createServerClient>,
  submissionFileId: string,
) {
  const { data, error } = await supabase
    .from("derived_assets")
    .select("id, kind, storage_path, page_index, width, height, derivation_status, error_message, mime_type, byte_size")
    .eq("submission_file_id", submissionFileId)
    .eq("is_current", true)
    .is("deleted_at", null)
    .order("page_index", { ascending: true, nullsFirst: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as DerivedAssetStatusRow[];
}

function mapDerivedAssetStatusRows(rows: DerivedAssetStatusRow[]) {
  return rows.map((row) => ({
    assetId: row.id,
    kind: row.kind,
    storagePath: row.storage_path,
    pageIndex: row.page_index,
    width: row.width,
    height: row.height,
    derivationStatus: row.derivation_status,
    errorMessage: row.error_message,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
  }));
}

function summarizeDerivation(rows: DerivedAssetStatusRow[]) {
  const statuses = rows.map((row) => row.derivation_status);
  const status: DerivationStatus = statuses.includes("failed")
    ? "failed"
    : statuses.includes("processing")
      ? "processing"
      : statuses.includes("pending")
        ? "pending"
        : "ready";

  return {
    status,
    readyAssetCount: rows.filter((row) => row.derivation_status === "ready").length,
    totalAssetCount: rows.length,
    failedAssetCount: rows.filter((row) => row.derivation_status === "failed").length,
    assets: mapDerivedAssetStatusRows(rows),
  };
}

function planDerivedAssets(submissionFile: CreatedSubmissionFile, sourceBytes: Buffer) {
  if (submissionFile.file_kind === "image") {
    return {
      drafts: [
        buildUploadedImagePreviewAsset({
          assignmentResultId: submissionFile.assignment_result_id,
          submissionFileId: submissionFile.id,
          originalFilename: submissionFile.original_filename,
          mimeType: submissionFile.mime_type,
          sourceStoragePath: submissionFile.original_storage_path,
        }),
      ],
      pageCount: null,
    };
  }

  if (submissionFile.file_kind === "pdf") {
    const pdf = inspectUploadedPdf(sourceBytes);
    const previews = buildUploadedPdfPagePreviewAssets({
      assignmentResultId: submissionFile.assignment_result_id,
      submissionFileId: submissionFile.id,
      originalFilename: submissionFile.original_filename,
      sourceStoragePath: submissionFile.original_storage_path,
      pageCount: pdf.pageCount,
      width: pdf.width,
      height: pdf.height,
    });

    return {
      drafts: previews.previews,
      pageCount: previews.pageCount,
    };
  }

  return {
    drafts: [],
    pageCount: null,
  };
}

async function generateDerivedAssetsForSubmissionFile(input: {
  supabase: ReturnType<typeof createServerClient>;
  storageBucket: string;
  submissionFile: CreatedSubmissionFile;
}) {
  const { data: sourceObject, error: sourceError } = await input.supabase.storage
    .from(input.storageBucket)
    .download(input.submissionFile.original_storage_path);

  if (sourceError || !sourceObject) {
    throw sourceError ?? new Error("Submission file could not be downloaded for derivation.");
  }

  const sourceArrayBuffer = await sourceObject.arrayBuffer();
  const sourceBytes = Buffer.from(sourceArrayBuffer);
  const plan = planDerivedAssets(input.submissionFile, sourceBytes);

  if (plan.drafts.length === 0) {
    return {
      status: "ready" as const,
      readyAssetCount: 0,
      totalAssetCount: 0,
      failedAssetCount: 0,
      assets: [],
    };
  }

  const { error: clearCurrentError } = await input.supabase
    .from("derived_assets")
    .update({ is_current: false })
    .eq("submission_file_id", input.submissionFile.id)
    .eq("is_current", true)
    .is("deleted_at", null);

  if (clearCurrentError) {
    throw clearCurrentError;
  }

  const { data: insertedRows, error: insertError } = await input.supabase
    .from("derived_assets")
    .insert(
      plan.drafts.map((draft) => ({
        submission_file_id: input.submissionFile.id,
        kind: draft.kind,
        storage_path: draft.storagePath,
        page_index: draft.pageIndex,
        width: draft.width,
        height: draft.height,
        metadata_json: draft.metadataJson,
        is_current: true,
        derivation_status: "pending",
        source_storage_bucket: input.storageBucket,
        source_storage_path: input.submissionFile.original_storage_path,
        mime_type: draft.mimeType,
      })),
    )
    .select("id, kind, storage_path, page_index, width, height, derivation_status, error_message, mime_type, byte_size");

  if (insertError || !insertedRows) {
    throw insertError ?? new Error("Failed to create derived asset rows.");
  }

  const assetRows = insertedRows as DerivedAssetStatusRow[];
  const rowsByPath = new Map(assetRows.map((row) => [row.storage_path, row]));

  for (const draft of plan.drafts) {
    const row = rowsByPath.get(draft.storagePath);

    if (!row) {
      continue;
    }

    await input.supabase
      .from("derived_assets")
      .update({ derivation_status: "processing", error_message: null })
      .eq("id", row.id);

    try {
      const generated = await materializeDerivedAsset({
        supabase: input.supabase,
        storageBucket: input.storageBucket,
        submissionFile: input.submissionFile,
        sourceObject,
        draft,
        pageCount: plan.pageCount,
      });

      await input.supabase
        .from("derived_assets")
        .update({
          derivation_status: "ready",
          error_message: null,
          mime_type: generated.mimeType,
          byte_size: generated.byteSize,
          width: generated.width,
          height: generated.height,
          metadata_json: {
            ...draft.metadataJson,
            generatedAt: new Date().toISOString(),
          },
        })
        .eq("id", row.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Derived asset generation failed.";

      await input.supabase
        .from("derived_assets")
        .update({ derivation_status: "failed", error_message: message })
        .eq("id", row.id);
    }
  }

  const finalRows = await getDerivedAssetStatusRows(input.supabase, input.submissionFile.id);
  return summarizeDerivation(finalRows);
}

async function materializeDerivedAsset(input: {
  supabase: ReturnType<typeof createServerClient>;
  storageBucket: string;
  submissionFile: CreatedSubmissionFile;
  sourceObject: Blob;
  draft: CanonicalDerivedAssetDraft;
  pageCount: number | null;
}) {
  if (input.submissionFile.file_kind === "image") {
    const uploadResult = await input.supabase.storage
      .from(input.storageBucket)
      .upload(input.draft.storagePath, input.sourceObject, {
        contentType: input.draft.mimeType,
        upsert: true,
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    return {
      mimeType: input.draft.mimeType,
      byteSize: input.sourceObject.size,
      width: input.draft.width,
      height: input.draft.height,
    };
  }

  if (input.submissionFile.file_kind === "pdf" && input.draft.pageIndex !== null) {
    const pageNumber = input.draft.pageIndex + 1;
    const svg = renderPdfPagePreviewSvg({
      fileName: input.submissionFile.original_filename,
      pageNumber,
      pageCount: input.pageCount ?? pageNumber,
      width: input.draft.width ?? 816,
      height: input.draft.height ?? 1056,
    });
    const svgBlob = new Blob([svg], { type: input.draft.mimeType });
    const uploadResult = await input.supabase.storage
      .from(input.storageBucket)
      .upload(input.draft.storagePath, svgBlob, {
        contentType: input.draft.mimeType,
        upsert: true,
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    return {
      mimeType: input.draft.mimeType,
      byteSize: Buffer.byteLength(svg),
      width: input.draft.width,
      height: input.draft.height,
    };
  }

  throw new Error(`Unsupported submission file kind for derivation: ${input.submissionFile.file_kind}`);
}
