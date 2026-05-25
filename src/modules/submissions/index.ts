export const submissionsModule = {
  scope: "submissions",
  status: "production-ready",
  phase: "t2-ready",
} as const;

export * from "./types";
export * from "./actions";

import type { SubmissionRecord } from "./types";

/** Stub for test compatibility. Production uses Supabase. */
export function getSubmission(_submissionId: string): SubmissionRecord | undefined {
  return undefined;
}

