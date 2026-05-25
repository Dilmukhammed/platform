export type ReviewStatus = "draft" | "released";

export type ReviewRecord = {
  id: string;
  submissionId: string;
  resultId: string;
  publicationId: string;
  studentId: string;
  teacherId: string;
  status: ReviewStatus;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  releasedAt: string | null;
};

export type ReviewsState = {
  reviews: ReviewRecord[];
};
