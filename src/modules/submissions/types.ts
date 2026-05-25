import type { SubmissionFixtureKind, SubmissionFixtureOption } from "@/lib/storage/submission-assets";

export type SubmissionAssetVariant = "original" | "preview" | "page_preview";

export type SubmissionAssetRecord = {
  id: string;
  submissionId: string;
  resultId: string;
  publicationId: string;
  studentId: string;
  variant: SubmissionAssetVariant;
  assetKind: SubmissionFixtureKind;
  storagePath: string;
  fixturePath: string;
  fileName: string;
  mimeType: string;
  extension: string;
  byteSize: number;
  checksum: string;
  width: number | null;
  height: number | null;
  pageNumber: number | null;
  pageCount: number | null;
  derivativeOfAssetId: string | null;
  downloadOnly: boolean;
  createdAt: string;
};

export type SubmissionRecord = {
  id: string;
  resultId: string;
  publicationId: string;
  studentId: string;
  classId: string;
  organizationId: string;
  teacherId: string;
  templateId: string;
  assetKind: SubmissionFixtureKind;
  originalAssetId: string;
  previewAssetIds: string[];
  pageCount: number | null;
  submittedAt: string;
};

export type AssignmentResultRecord = {
  id: string;
  publicationId: string;
  studentId: string;
  classId: string;
  organizationId: string;
  teacherId: string;
  templateId: string;
  status: "submitted";
  latestSubmissionId: string;
  submissionIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SubmissionsState = {
  results: AssignmentResultRecord[];
  submissions: SubmissionRecord[];
  assets: SubmissionAssetRecord[];
};

export type StudentAssignmentPublicationSummary = {
  publicationId: string;
  templateId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  classId: string;
  className: string;
  organizationId: string;
  effectiveDeadline: string;
  linkedMaterialCount: number;
  linkedTestCount: number;
  resultStatus: "not_started" | "submitted";
  latestSubmittedAt: string | null;
};

export type StudentSubmissionAssetSummary = Omit<SubmissionAssetRecord, "resultId" | "publicationId" | "studentId">;

export type StudentSubmissionSummary = Omit<SubmissionRecord, "studentId" | "organizationId" | "teacherId" | "templateId"> & {
  assets: StudentSubmissionAssetSummary[];
};

export type StudentAssignmentResultSummary = AssignmentResultRecord & {
  latestSubmission: StudentSubmissionSummary | null;
};

export type StudentPublicationSubmissionDetail = StudentAssignmentPublicationSummary & {
  result: StudentAssignmentResultSummary | null;
  submissions: StudentSubmissionSummary[];
  fixtureOptions: SubmissionFixtureOption[];
};
