/**
 * POST /api/v1/uploads/init — Reserve a DB-backed upload session.
 *
 * Persists an upload session, reserves the canonical storage path,
 * and returns a real Supabase Storage signed upload contract.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createSignedUploadContract } from "@/lib/storage/upload-contract";
import { createServerClient } from "@/lib/supabase/server-client";

import {
  MAX_UPLOAD_SIZE_BYTES,
  buildReservedUploadStoragePath,
  createUploadSession,
  getAllowedMimeTypes,
  getUploadBucketName,
  getUploadOwnerRole,
  type UploadContextType,
  type UploadType,
} from "../store";

const initUploadSchema = z.object({
  uploadType: z.enum(["material", "submission", "test_asset"]),
  contextId: z.string().uuid().optional(),
  contextType: z.enum(["material", "submission", "test", "assignment_result"]).optional(),
  fileName: z.string().min(1).max(255).optional(),
  fileSize: z.number().int().min(1).max(MAX_UPLOAD_SIZE_BYTES).optional(),
  mimeType: z.string().max(255).optional(),
});

export const POST = withAuth(async (request, _context, { session }) => {
  try {
    const body = await request.json();
    const validation = initUploadSchema.safeParse(body);

    if (!validation.success) {
      return toResponse(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid upload initialization request.",
          undefined,
          validation.error.issues,
        ),
      );
    }

    const { uploadType, contextId, contextType, fileName, fileSize, mimeType } = validation.data;
    const ownerRole = getUploadOwnerRole(session);

    if (!ownerRole) {
      return toResponse(
        errorResponse(ErrorCodes.FORBIDDEN, "Only teachers and students can initialize uploads."),
      );
    }

    const intentError = validateUploadIntent({ ownerRole, uploadType, contextId, contextType, mimeType });
    if (intentError) {
      return intentError;
    }

    const uploadId = crypto.randomUUID();
    const storageBucket = getUploadBucketName();
    const storagePath = buildReservedUploadStoragePath({
      uploadId,
      uploadType,
      ownerRole,
      ownerId: session.userId,
      contextId,
      contextType,
      fileName,
    });

    const supabase = createServerClient();
    const uploadContract = await createSignedUploadContract(supabase, storageBucket, storagePath);

    await createUploadSession(supabase, {
      uploadId,
      uploadType,
      ownerRole,
      ownerId: session.userId,
      contextId,
      contextType,
      fileName,
      declaredFileSize: fileSize,
      declaredMimeType: mimeType,
      storageBucket,
      storagePath,
    });

    return toResponse(
      successResponse({
        uploadId,
        status: "pending",
        targetUrl: uploadContract.signedUrl,
        upload: uploadContract,
        fields: {
          uploadType,
          maxFileSize: MAX_UPLOAD_SIZE_BYTES,
          allowedMimeTypes: getAllowedMimeTypes(uploadType),
        },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
      201,
    );
  } catch (err) {
    console.error("[uploads/init] Unexpected error:", err);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to initialize upload."),
    );
  }
});

function validateUploadIntent(input: {
  ownerRole: "teacher" | "student";
  uploadType: UploadType;
  contextId?: string;
  contextType?: UploadContextType;
  mimeType?: string;
}) {
  if ((input.contextId && !input.contextType) || (!input.contextId && input.contextType)) {
    // Allow test_asset without contextId — test may not exist yet during creation
    if (!(input.uploadType === "test_asset" && input.contextType === "test" && !input.contextId)) {
      return toResponse(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "contextId and contextType must be provided together.",
        ),
      );
    }
  }

  if (input.ownerRole === "student" && input.uploadType !== "submission") {
    return toResponse(
      errorResponse(ErrorCodes.FORBIDDEN, "Students can only initialize submission uploads."),
    );
  }

  const expectedContextType: Partial<Record<UploadType, UploadContextType>> = {
    material: "material",
    submission: "assignment_result",
    test_asset: "test",
  };

  if (input.contextType && expectedContextType[input.uploadType] !== input.contextType) {
    return toResponse(
      errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        `Upload type ${input.uploadType} requires contextType ${expectedContextType[input.uploadType]}.`,
      ),
    );
  }

  if (input.mimeType && !getAllowedMimeTypes(input.uploadType).includes(input.mimeType)) {
    return toResponse(
      errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "The provided MIME type is not allowed for this upload type.",
      ),
    );
  }

  return null;
}
