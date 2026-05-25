/**
 * POST /api/v1/uploads/{uploadId}/complete — Verify and finalize an upload session.
 *
 * Confirms the reserved Supabase Storage object exists and only then marks the
 * DB-backed upload session as completed. Safe for duplicate client retries.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { getStoredObjectMetadata } from "@/lib/storage/upload-contract";
import { createServerClient } from "@/lib/supabase/server-client";

import {
  finalizeUploadSession,
  getUploadSessionById,
  uploadSessionBelongsToUser,
  type UploadSessionRecord,
} from "../../store";

const completeUploadSchema = z.object({
  storagePath: z.string().min(1).max(1024).optional(),
  fileSize: z.number().int().min(1).optional(),
  mimeType: z.string().min(1).max(255).optional(),
  fileName: z.string().min(1).max(255).optional(),
  checksum: z.string().max(128).optional(),
});

const paramsSchema = z.object({
  uploadId: z.string().uuid("Invalid upload ID format."),
});

export const POST = withAuth(async (request, context, { session }) => {
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

    const body = await request.json();
    const validation = completeUploadSchema.safeParse(body);

    if (!validation.success) {
      return toResponse(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          "Invalid upload completion request.",
          undefined,
          validation.error.issues,
        ),
      );
    }

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

    const requestMismatch = getCompletionRequestMismatch(upload, validation.data);
    if (requestMismatch) {
      return toResponse(
        errorResponse(ErrorCodes.VALIDATION_ERROR, requestMismatch),
      );
    }

    const contextError = await verifyUploadContext(supabase, upload, session.userId);
    if (contextError) {
      return contextError;
    }

    if (upload.status === "failed") {
      return toResponse(
        errorResponse(ErrorCodes.CONFLICT, "Upload has failed and cannot be completed."),
      );
    }

    const storedObject = await getVerifiedStoredObject(supabase, upload);
    if (!storedObject.ok) {
      return storedObject.response;
    }

    const storedObjectMismatch = getStoredObjectMismatch(upload, validation.data, storedObject.data);
    if (storedObjectMismatch) {
      return toResponse(
        errorResponse(ErrorCodes.VALIDATION_ERROR, storedObjectMismatch),
      );
    }

    if (upload.status === "completed") {
      return handleCompletedRetry(upload, validation.data, storedObject.data);
    }

    const finalized = await finalizeUploadSession(supabase, {
      uploadId,
      completedFileSize: storedObject.data.size,
      completedMimeType: storedObject.data.mimeType,
      storageObjectId: storedObject.data.objectId,
      storageObjectVersion: storedObject.data.version,
      storageEtag: storedObject.data.etag,
      checksum: validation.data.checksum,
    });

    if (!finalized) {
      const latest = await getUploadSessionById(supabase, uploadId);

      if (!latest) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Upload not found."),
        );
      }

      if (latest.status === "completed") {
        return handleCompletedRetry(latest, validation.data, storedObject.data);
      }

      return toResponse(
        errorResponse(ErrorCodes.CONFLICT, "Upload could not be finalized."),
      );
    }

    return toResponse(successResponse(buildCompletedResponse(finalized)));
  } catch (err) {
    console.error("[uploads/complete] Unexpected error:", err);
    return toResponse(
      errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to complete upload."),
    );
  }
});

function getCompletionRequestMismatch(
  upload: UploadSessionRecord,
  request: z.infer<typeof completeUploadSchema>,
) {
  if (request.storagePath && request.storagePath !== upload.storagePath) {
    return "Storage path does not match the reserved upload session.";
  }

  if (request.fileName && upload.fileName && request.fileName !== upload.fileName) {
    return "File name does not match the reserved upload session.";
  }

  if (
    request.mimeType
    && upload.declaredMimeType
    && request.mimeType !== upload.declaredMimeType
  ) {
    return "MIME type does not match the reserved upload session.";
  }

  if (
    request.fileSize !== undefined
    && upload.declaredFileSize !== undefined
    && request.fileSize !== upload.declaredFileSize
  ) {
    return "File size does not match the reserved upload session.";
  }

  return null;
}

function getStoredObjectMismatch(
  upload: UploadSessionRecord,
  request: z.infer<typeof completeUploadSchema>,
  storedObject: {
    objectId: string | null;
    version: string | null;
    etag: string | null;
    size: number | null;
    mimeType: string | null;
  },
) {
  if (upload.status === "completed") {
    if (upload.storageObjectId && storedObject.objectId && storedObject.objectId !== upload.storageObjectId) {
      return "Stored object metadata no longer matches the completed upload.";
    }

    if (upload.storageObjectVersion && storedObject.version && storedObject.version !== upload.storageObjectVersion) {
      return "Stored object metadata no longer matches the completed upload.";
    }

    if (upload.storageEtag && storedObject.etag && storedObject.etag !== upload.storageEtag) {
      return "Stored object metadata no longer matches the completed upload.";
    }
  }

  const expectedFileSize = upload.status === "completed"
    ? upload.completedFileSize ?? upload.declaredFileSize
    : request.fileSize ?? upload.declaredFileSize;
  if (expectedFileSize !== undefined && storedObject.size !== expectedFileSize) {
    return upload.status === "completed"
      ? "Stored object metadata no longer matches the completed upload."
      : "Uploaded object size does not match the reserved upload session.";
  }

  const expectedMimeType = upload.status === "completed"
    ? upload.completedMimeType ?? upload.declaredMimeType
    : request.mimeType ?? upload.declaredMimeType;
  if (expectedMimeType && storedObject.mimeType !== expectedMimeType) {
    return upload.status === "completed"
      ? "Stored object metadata no longer matches the completed upload."
      : "Uploaded object MIME type does not match the reserved upload session.";
  }

  return null;
}

async function verifyUploadContext(
  supabase: ReturnType<typeof createServerClient>,
  upload: UploadSessionRecord,
  sessionUserId: string,
) {
  if (!upload.contextId || !upload.contextType) {
    return null;
  }

  switch (upload.uploadType) {
    case "material": {
      const { data, error } = await supabase
        .from("materials")
        .select("id, owner_teacher_id, owner_organization_id")
        .eq("id", upload.contextId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        console.error("[uploads/complete] Material context lookup failed:", error);
        return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify upload context."));
      }

      if (!data) {
        return toResponse(errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Upload context not found."));
      }

      if (data.owner_teacher_id === sessionUserId) {
        return null;
      }

      if (data.owner_organization_id) {
        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("organization_id", data.owner_organization_id)
          .eq("platform_user_id", sessionUserId)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle();

        if (membershipError) {
          console.error("[uploads/complete] Material organization access lookup failed:", membershipError);
          return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify upload context."));
        }

        if (membership) {
          return null;
        }
      }

      return toResponse(errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this upload context."));
    }
    case "test_asset": {
      const { data, error } = await supabase
        .from("tests")
        .select("id, owner_teacher_id, owner_organization_id")
        .eq("id", upload.contextId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        console.error("[uploads/complete] Test context lookup failed:", error);
        return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify upload context."));
      }

      if (!data) {
        return toResponse(errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Upload context not found."));
      }

      if (data.owner_teacher_id === sessionUserId) {
        return null;
      }

      if (data.owner_organization_id) {
        const { data: membership, error: membershipError } = await supabase
          .from("organization_memberships")
          .select("id")
          .eq("organization_id", data.owner_organization_id)
          .eq("platform_user_id", sessionUserId)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle();

        if (membershipError) {
          console.error("[uploads/complete] Test organization access lookup failed:", membershipError);
          return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify upload context."));
        }

        if (membership) {
          return null;
        }
      }

      return toResponse(errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this upload context."));
    }
    case "submission": {
      const { data, error } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          assignment_publication_class_id,
          class_enrollments!inner(student_profile_id)
        `,
        )
        .eq("id", upload.contextId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        console.error("[uploads/complete] Submission context lookup failed:", error);
        return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify upload context."));
      }

      if (!data) {
        return toResponse(errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Upload context not found."));
      }

      const enrollment = data.class_enrollments as { student_profile_id?: string } | null;
      if (upload.ownerRole === "student" && enrollment?.student_profile_id === sessionUserId) {
        return null;
      }

      if (upload.ownerRole === "teacher") {
        const { data: publicationClass, error: publicationClassError } = await supabase
          .from("assignment_publication_classes")
          .select("class_id")
          .eq("id", data.assignment_publication_class_id)
          .maybeSingle();

        if (publicationClassError || !publicationClass) {
          console.error("[uploads/complete] Submission class lookup failed:", publicationClassError);
          return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify upload context."));
        }

        const { data: classTeacher, error: classTeacherError } = await supabase
          .from("class_teachers")
          .select("id")
          .eq("class_id", publicationClass.class_id)
          .eq("platform_user_id", sessionUserId)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle();

        if (classTeacherError) {
          console.error("[uploads/complete] Submission teacher access lookup failed:", classTeacherError);
          return toResponse(errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify upload context."));
        }

        if (classTeacher) {
          return null;
        }
      }

      return toResponse(errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this upload context."));
    }
  }
}

async function getVerifiedStoredObject(
  supabase: ReturnType<typeof createServerClient>,
  upload: UploadSessionRecord,
) {
  try {
    const metadata = await getStoredObjectMetadata(supabase, upload.storageBucket, upload.storagePath);
    return { ok: true as const, data: metadata };
  } catch (error) {
    console.error("[uploads/complete] Storage verification failed:", error);

    return {
      ok: false as const,
      response: toResponse(
        errorResponse(
          ErrorCodes.RESOURCE_NOT_FOUND,
          "Uploaded object was not found in Supabase Storage.",
        ),
      ),
    };
  }
}

function handleCompletedRetry(
  upload: UploadSessionRecord,
  request: z.infer<typeof completeUploadSchema>,
  storedObject: {
    objectId: string | null;
    version: string | null;
    etag: string | null;
    size: number | null;
    mimeType: string | null;
  },
) {
  if (request.checksum && upload.checksum && request.checksum !== upload.checksum) {
    return toResponse(
      errorResponse(ErrorCodes.CONFLICT, "Upload is already completed with different file metadata."),
    );
  }

  if (request.fileSize !== undefined && storedObject.size !== request.fileSize) {
    return toResponse(
      errorResponse(ErrorCodes.CONFLICT, "Upload is already completed with different file metadata."),
    );
  }

  if (request.mimeType && storedObject.mimeType && request.mimeType !== storedObject.mimeType) {
    return toResponse(
      errorResponse(ErrorCodes.CONFLICT, "Upload is already completed with different file metadata."),
    );
  }

  return toResponse(successResponse(buildCompletedResponse(upload)));
}

function buildCompletedResponse(upload: UploadSessionRecord) {
  return {
    uploadId: upload.id,
    status: upload.status,
    uploadType: upload.uploadType,
    fileName: upload.fileName,
    fileSize: upload.completedFileSize ?? upload.declaredFileSize,
    mimeType: upload.completedMimeType ?? upload.declaredMimeType,
    storageBucket: upload.storageBucket,
    storagePath: upload.storagePath,
    contextId: upload.contextId,
    contextType: upload.contextType,
    checksum: upload.checksum,
    completedAt: upload.completedAt,
  };
}
