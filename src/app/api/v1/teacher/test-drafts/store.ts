/**
 * In-memory job store for AI test draft generation.
 * Replace with Redis/DB in production.
 */

export type JobStatus = "queued" | "processing" | "succeeded" | "failed";

export interface Job {
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  result?: {
    testId?: string;
    error?: string;
  };
  teacherId: string;
}

// In-memory job store for MVP (replace with Redis/DB in production)
export const jobStore = new Map<string, Job>();
