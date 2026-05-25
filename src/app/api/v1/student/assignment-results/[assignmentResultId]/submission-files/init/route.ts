/**
 * POST /api/v1/student/assignment-results/{assignmentResultId}/submission-files/init
 *
 * Initialize a submission file upload. Reserves a shared upload session.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createSignedUploadContract } from "@/lib/storage/upload-contract";
import { createServerClient } from "@/lib/supabase/server-client";

import {
  MAX_UPLOAD_SIZE_BYTES,
  createUploadSession,
  getAllowedMimeTypes,
  getUploadBucketName,
} from "@/app/api/v1/uploads/store";

const paramsSchema = z.object({
  assignmentResultId: z.string().uuid("Invalid assignment result ID format."),
});

const initSchema = z.object({
  fileRole: z.enum(["main", "attachment", "reference", "source"]),
  fileKind: z.enum(["image", "pdf", "dwg", "other"]),
  originalFilename: z.string().min(1, "Original filename is required."),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().int().min(1, "File size must be at least 1 byte.").max(MAX_UPLOAD_SIZE_BYTES),
  sortOrder: z.number().int().min(0).default(0),
});

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const rawParams = await context.params;
      // Next.js 15 params values can be string | string[]; normalize to string
      const normalizedParams = {
        assignmentResultId: Array.isArray(rawParams.assignmentResultId)
          ? rawParams.assignmentResultId[0]
          : rawParams.assignmentResultId,
      };
      const paramsValidation = paramsSchema.safeParse(normalizedParams);

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
      const bodyValidation = initSchema.safeParse(body);

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

      const { fileRole, fileKind, originalFilename, mimeType, fileSizeBytes, sortOrder } = bodyValidation.data;
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
        console.error("[student/submission-files/init] Supabase error:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify assignment."),
        );
      }

      if (!result) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment not found."),
        );
      }

      // Fetch deadline info
      const { data: deadlineInfo } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          assignment_publication_classes!inner(
            deadline_override,
            assignment_publications!inner(
              default_deadline
            )
          )
        `,
        )
        .eq("id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      const pubClass = deadlineInfo?.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const deadline = pubClass?.deadline_override ?? publication?.default_deadline;
      const isBeforeDeadline = !deadline || new Date() <= new Date(deadline as string);

      // Check if assignment can accept file uploads
      // Allow replacing files if: (a) not yet submitted, OR (b) submitted but deadline hasn't passed
      if (result.status === "reviewed" || result.status === "released") {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Cannot modify files for an assignment that has already been reviewed."),
        );
      }

      if (result.status === "submitted" && !isBeforeDeadline) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Cannot replace files after the deadline has passed."),
        );
      }

      if (mimeType && !getAllowedMimeTypes("submission").includes(mimeType)) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "The provided MIME type is not allowed for student submissions.",
          ),
        );
      }

      const uploadId = crypto.randomUUID();
      const storageBucket = getUploadBucketName();
      const sanitizedFilename = originalFilename
        .trim()
        .replace(/[\\/]+/g, "-")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "");
      const finalFilename = sanitizedFilename || "upload.bin";
      const storagePath = [
        "uploads",
        "submission",
        "student",
        session.userId,
        `assignment_result/${assignmentResultId}`,
        uploadId,
        finalFilename,
      ].join("/");

      const uploadContract = await createSignedUploadContract(supabase, storageBucket, storagePath);

      await createUploadSession(supabase, {
        uploadId,
        uploadType: "submission",
        ownerRole: "student",
        ownerId: session.userId,
        contextId: assignmentResultId,
        contextType: "assignment_result",
        fileName: originalFilename,
        declaredFileSize: fileSizeBytes,
        declaredMimeType: mimeType,
        storageBucket,
        storagePath,
      });

      return toResponse(
        successResponse({
          uploadId,
          fileRole,
          fileKind,
          storageBucket,
          storagePath,
          originalFilename,
          mimeType: mimeType ?? null,
          fileSizeBytes,
          sortOrder,
          targetUrl: uploadContract.signedUrl,
          upload: uploadContract,
          allowedMimeTypes: getAllowedMimeTypes("submission"),
        }),
        201,
      );
    } catch (err) {
      console.error("[student/submission-files/init] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to initialize submission file."),
      );
    }
  },
  { requiredRole: "student" },
);
