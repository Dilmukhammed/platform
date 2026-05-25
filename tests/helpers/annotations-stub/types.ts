export type AnnotationPoint = { x: number; y: number };
export type AnnotationStroke = { points: AnnotationPoint[]; color: string; width: number };
export type AnnotationPayload = { strokes: AnnotationStroke[] };

export type AnnotationRecord = {
  id: string;
  reviewId: string;
  submissionId: string;
  assetId: string;
  pageNumber: number | null;
  baseWidth: number;
  baseHeight: number;
  version: number;
  data: AnnotationPayload;
  createdAt: string;
  updatedAt: string;
};

export type AnnotationsState = {
  annotations: AnnotationRecord[];
};
