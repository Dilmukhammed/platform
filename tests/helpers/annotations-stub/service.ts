import { getAnnotationsState } from "./store";
import type { AnnotationRecord, AnnotationPayload } from "./types";

function generateId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export const annotationsService = {
  getAnnotationsByReviewId(reviewId: string): AnnotationRecord[] {
    const all = getAnnotationsState().annotations.filter((a) => a.reviewId === reviewId);
    // Group by assetId+pageNumber, keep max version
    const latestMap = new Map<string, AnnotationRecord>();
    for (const a of all) {
      const key = `${a.assetId}::${String(a.pageNumber)}`;
      const current = latestMap.get(key);
      if (!current || a.version > current.version) latestMap.set(key, a);
    }
    return Array.from(latestMap.values());
  },

  getAnnotation(reviewId: string, assetId: string, pageNumber: number | null): AnnotationRecord | undefined {
    const matches = getAnnotationsState().annotations.filter(
      (a) => a.reviewId === reviewId && a.assetId === assetId && a.pageNumber === pageNumber
    );
    if (!matches.length) return undefined;
    return matches.reduce((latest, a) => (a.version > latest.version ? a : latest));
  },

  getAnnotationHistory(reviewId: string, assetId: string, pageNumber: number | null): AnnotationRecord[] {
    return getAnnotationsState()
      .annotations.filter(
        (a) => a.reviewId === reviewId && a.assetId === assetId && a.pageNumber === pageNumber
      )
      .sort((a, b) => a.version - b.version);
  },

  saveAnnotation(
    reviewId: string,
    submissionId: string,
    assetId: string,
    pageNumber: number | null,
    data: AnnotationPayload,
    baseWidth: number,
    baseHeight: number
  ): AnnotationRecord {
    const state = getAnnotationsState();
    const existing = this.getAnnotation(reviewId, assetId, pageNumber);

    const now = new Date().toISOString();

    if (existing) {
      // Don't mutate existing record — create a new one with incremented version
      const newVersion: AnnotationRecord = {
        id: generateId("ann"),
        reviewId: existing.reviewId,
        submissionId: existing.submissionId,
        assetId: existing.assetId,
        pageNumber: existing.pageNumber,
        baseWidth,
        baseHeight,
        version: existing.version + 1,
        data,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      state.annotations.push(newVersion);
      return newVersion;
    }

    const newAnnotation: AnnotationRecord = {
      id: generateId("ann"),
      reviewId,
      submissionId,
      assetId,
      pageNumber,
      baseWidth,
      baseHeight,
      version: 1,
      data,
      createdAt: now,
      updatedAt: now,
    };

    state.annotations.push(newAnnotation);

    return newAnnotation;
  },
};
