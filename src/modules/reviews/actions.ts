"use server";

import { revalidatePath } from "next/cache";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiPost } from "@/lib/api/server-fetch";
import type { ReviewStatus } from "./types";

export async function saveReviewAction(
  submissionId: string,
  resultId: string,
  publicationId: string,
  studentId: string,
  teacherId: string,
  comment: string | null,
  status: ReviewStatus
) {
  const session = await requireAreaAccess("teacher");

  const review = await apiPost<{
    id: string;
    submissionId: string;
    resultId: string;
    publicationId: string;
    studentId: string;
    teacherId: string;
    comment: string | null;
    status: ReviewStatus;
  }>(`/api/v1/teacher/assignment-results/${resultId}/review`, {
    comment,
    status,
  });

  revalidatePath(`/teacher/reviews/${submissionId}`);
  revalidatePath(`/student/review/${submissionId}`);

  return review;
}
