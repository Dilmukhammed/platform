/**
 * Shared job store for async job tracking.
 * Replaces the test-drafts specific store with a general-purpose one.
 * Supports job types: test_draft_generation, bulk_import, export, upload_processing
 */

export type JobStatus = "queued" | "processing" | "succeeded" | "failed";
export type JobType = "test_draft_generation" | "bulk_import" | "export" | "upload_processing";

export interface Job {
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  progress?: number; // 0-100
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  ownerRole: "teacher" | "student" | "super_admin";
  result?: {
    testId?: string;
    uploadId?: string;
    downloadUrl?: string;
    error?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
}

// In-memory job store for MVP (replace with Redis/DB in production)
export const sharedJobStore = new Map<string, Job>();

/**
 * Create a new job entry.
 */
export function createJob(
  jobId: string,
  jobType: JobType,
  ownerId: string,
  ownerRole: "teacher" | "student" | "super_admin",
  metadata?: Record<string, unknown>,
): Job {
  const now = new Date().toISOString();
  const job: Job = {
    jobId,
    jobType,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
    ownerId,
    ownerRole,
    metadata,
  };
  sharedJobStore.set(jobId, job);
  return job;
}

/**
 * Update job status.
 */
export function updateJobStatus(
  jobId: string,
  status: JobStatus,
  progress?: number,
  result?: Job["result"],
): Job | null {
  const job = sharedJobStore.get(jobId);
  if (!job) return null;

  job.status = status;
  job.updatedAt = new Date().toISOString();
  if (progress !== undefined) job.progress = progress;
  if (result !== undefined) job.result = result;

  return job;
}

/**
 * Get job by ID.
 */
export function getJob(jobId: string): Job | undefined {
  return sharedJobStore.get(jobId);
}

/**
 * Delete job (cleanup).
 */
export function deleteJob(jobId: string): boolean {
  return sharedJobStore.delete(jobId);
}
