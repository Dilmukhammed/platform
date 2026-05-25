/**
 * GET /api/v1/uploads/{uploadId} — Check DB-backed upload status.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

import { getUploadSessionById, uploadSessionBelongsToUser } from "../store";

const paramsSchema = z.object({
  uploadId: z.string().uuid("Invalid upload ID format."),
});

export const GET = withAuth(async (request, context, { session }) => {
  try {
    const rawParams = await context.params;
    const normalizedParams = {
      uploadId: Array.isArray(rawParams.uploadId)
        ? rawParams.uploadId[0]
        : rawParams.uploadId,
    };
    const paramsValidation = paramsSchema.safeParse(normalizedParams);

    if (!paramsValidation.success) {
      return toResponse(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid upload ID.",
          undefined,
          paramsValidation.error.issues,
        ),
      );
    }

    const { uploadId } = paramsValidation.data;
    const supabase = createServerClient();
    const upload = await getUploadSessionById(supabase, uploadId);

    if (!upload) {
      return toResponse(
        errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Upload not found."),
      );
    }

    if (!uploadSessionBelongsToUser(upload, session)) {
      return toResponse(
        errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this upload."),
      );
    }

    const response: Record<string, unknown> = {
      uploadId: upload.id,
      status: upload.status,
      uploadType: upload.uploadType,
      storageBucket: upload.storageBucket,
      storagePath: upload.storagePath,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
    };

    if (upload.contextId) {
      response.contextId = upload.contextId;
      response.contextType = upload.contextType;
    }

    if (upload.status === "completed") {
      response.fileName = upload.fileName;
      response.fileSize = upload.completedFileSize ?? upload.declaredFileSize;
      response.mimeType = upload.completedMimeType ?? upload.declaredMimeType;
      response.completedAt = upload.completedAt;
      response.checksum = upload.checksum;
    }

    if (upload.status === "failed" && upload.errorMessage) {
      response.error = upload.errorMessage;
    }

    return toResponse(successResponse(response));
  } catch (err) {
    console.error("[uploads/[uploadId]] Unexpected error:", err);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch upload status."),
    );
  }
});
