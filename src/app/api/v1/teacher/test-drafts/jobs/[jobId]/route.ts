/**
 * GET /api/v1/teacher/test-drafts/jobs/{jobId} — Poll AI test draft generation job status.
 *
 * Returns job status: queued, processing, succeeded, or failed.
 * When succeeded, includes the generated testId.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { jobStore } from "../../store";

// GET — Poll job status
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const jobId = params.jobId as string;

      const job = jobStore.get(jobId);

      if (!job) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Job not found."),
        );
      }

      // Verify the job belongs to the requesting teacher
      if (job.teacherId !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this job."),
        );
      }

      const response: Record<string, unknown> = {
        jobId,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };

      if (job.status === "succeeded" && job.result?.testId) {
        response.testId = job.result.testId;
        response.message = "AI test draft generated successfully.";
        response.testUrl = `/api/v1/teacher/tests/${job.result.testId}`;
      } else if (job.status === "failed") {
        response.error = job.result?.error || "Generation failed.";
      } else if (job.status === "queued") {
        response.message = "Test draft generation is queued and will begin shortly.";
      } else if (job.status === "processing") {
        response.message = "Test draft generation is in progress.";
      }

      return toResponse(successResponse(response));
    } catch (err) {
      console.error("[teacher/test-drafts/jobs/[jobId]] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch job status."),
      );
    }
  },
  { requiredRole: "teacher" },
);
