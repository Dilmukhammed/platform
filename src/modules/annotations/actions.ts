"use server";

import { revalidatePath } from "next/cache";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiPost } from "@/lib/api/server-fetch";
import type { AnnotationPayload } from "./types";

export async function saveAnnotationAction(
  reviewId: string,
  submissionId: string,
  assetId: string,
  pageNumber: number | null,
  data: AnnotationPayload,
  baseWidth: number,
  baseHeight: number
) {
  const session = await requireAreaAccess("teacher");

  const annotation = await apiPost<{
    id: string;
    reviewId: string;
    submissionId: string;
    assetId: string;
    pageNumber: number | null;
    data: AnnotationPayload;
    baseWidth: number;
    baseHeight: number;
  }>(`/api/v1/teacher/assignment-results/${submissionId}/annotations`, {
    reviewId,
    submissionId,
    assetId,
    pageNumber,
    data,
    baseWidth,
    baseHeight,
  });

  revalidatePath(`/teacher/reviews/${submissionId}`);

  return annotation;
}
