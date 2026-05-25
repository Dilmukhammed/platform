import { getReviewsState } from "./store";
import type { ReviewRecord, ReviewStatus } from "./types";

function generateId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export const reviewsService = {
  getReviewBySubmissionId(submissionId: string): ReviewRecord | undefined {
    return getReviewsState().reviews.find((r) => r.submissionId === submissionId);
  },

  getReviewsByResultId(resultId: string): ReviewRecord[] {
    return getReviewsState().reviews.filter((r) => r.resultId === resultId);
  },

  createOrUpdateReview(
    submissionId: string,
    resultId: string,
    publicationId: string,
    studentId: string,
    teacherId: string,
    comment: string | null,
    status: ReviewStatus
  ): ReviewRecord {
    const state = getReviewsState();
    const existing = state.reviews.find((r) => r.submissionId === submissionId);

    const now = new Date().toISOString();

    if (existing) {
      const updated: ReviewRecord = {
        ...existing,
        comment,
        status,
        updatedAt: now,
        releasedAt: status === "released" && existing.status !== "released" ? now : existing.releasedAt,
      };

      state.reviews = state.reviews.map((r) => (r.id === existing.id ? updated : r));

      return updated;
    }

    const newReview: ReviewRecord = {
      id: generateId("rev"),
      submissionId,
      resultId,
      publicationId,
      studentId,
      teacherId,
      status,
      comment,
      createdAt: now,
      updatedAt: now,
      releasedAt: status === "released" ? now : null,
    };

    state.reviews.push(newReview);

    return newReview;
  },
};
