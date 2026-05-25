/**
 * GET /api/v1/jobs/{jobId} — Poll job status.
 *
 * Returns job status: queued/processing/succeeded/failed.
 * Includes progress percentage and result/error when available.
 * Supports job types: test_draft_generation, bulk_import, export, upload_processing
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { getJob, type JobType } from "../store";

// GET — Poll job status
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const jobId = params.jobId as string;

      const job = getJob(jobId);

      if (!job) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Job not found."),
        );
      }

      // Verify ownership
      if (job.ownerId !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this job."),
        );
      }

      // Build response
      const response: Record<string, unknown> = {
        jobId: job.jobId,
        jobType: job.jobType,
        status: job.status,
        progress: job.progress ?? 0,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };

      // Add type-specific messages and results
      switch (job.status) {
        case "queued":
          response.message = getQueuedMessage(job.jobType);
          break;
        case "processing":
          response.message = getProcessingMessage(job.jobType);
          break;
        case "succeeded":
          response.message = getSuccessMessage(job.jobType);
          response.result = buildSuccessResult(job);
          break;
        case "failed":
          response.message = getFailedMessage(job.jobType);
          response.error = job.result?.error || "Job failed.";
          break;
      }

      return toResponse(successResponse(response));
    } catch (err) {
      console.error("[jobs/[jobId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch job status."),
      );
    }
  },
  // Allow any authenticated user to poll their own jobs
  // Role is checked via job ownership
);

/**
 * Get appropriate message for queued status.
 */
function getQueuedMessage(jobType: JobType): string {
  switch (jobType) {
    case "test_draft_generation":
      return "Test draft generation is queued and will begin shortly.";
    case "bulk_import":
      return "Bulk import is queued and will begin shortly.";
    case "export":
      return "Export is queued and will begin shortly.";
    case "upload_processing":
      return "Upload processing is queued and will begin shortly.";
    default:
      return "Job is queued and will begin shortly.";
  }
}

/**
 * Get appropriate message for processing status.
 */
function getProcessingMessage(jobType: JobType): string {
  switch (jobType) {
    case "test_draft_generation":
      return "Test draft generation is in progress.";
    case "bulk_import":
      return "Bulk import is in progress.";
    case "export":
      return "Export is in progress.";
    case "upload_processing":
      return "Upload is being processed.";
    default:
      return "Job is in progress.";
  }
}

/**
 * Get appropriate message for success status.
 */
function getSuccessMessage(jobType: JobType): string {
  switch (jobType) {
    case "test_draft_generation":
      return "AI test draft generated successfully.";
    case "bulk_import":
      return "Bulk import completed successfully.";
    case "export":
      return "Export completed successfully.";
    case "upload_processing":
      return "Upload processed successfully.";
    default:
      return "Job completed successfully.";
  }
}

/**
 * Get appropriate message for failed status.
 */
function getFailedMessage(jobType: JobType): string {
  switch (jobType) {
    case "test_draft_generation":
      return "Test draft generation failed.";
    case "bulk_import":
      return "Bulk import failed.";
    case "export":
      return "Export failed.";
    case "upload_processing":
      return "Upload processing failed.";
    default:
      return "Job failed.";
  }
}

/**
 * Build success result based on job type.
 */
function buildSuccessResult(job: {
  jobType: JobType;
  result?: {
    testId?: string;
    uploadId?: string;
    downloadUrl?: string;
    [key: string]: unknown;
  };
}): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  switch (job.jobType) {
    case "test_draft_generation":
      if (job.result?.testId) {
        result.testId = job.result.testId;
        result.testUrl = `/api/v1/teacher/tests/${job.result.testId}`;
      }
      break;
    case "bulk_import":
      if (job.result?.importedCount !== undefined) {
        result.importedCount = job.result.importedCount;
        result.failedCount = job.result.failedCount ?? 0;
      }
      break;
    case "export":
      if (job.result?.downloadUrl) {
        result.downloadUrl = job.result.downloadUrl;
        result.expiresAt = job.result.expiresAt;
      }
      break;
    case "upload_processing":
      if (job.result?.uploadId) {
        result.uploadId = job.result.uploadId;
        result.processedUrl = `/api/v1/uploads/${job.result.uploadId}`;
      }
      break;
  }

  // Include any additional result fields
  if (job.result) {
    for (const [key, value] of Object.entries(job.result)) {
      if (!(key in result)) {
        result[key] = value;
      }
    }
  }

  return result;
}
