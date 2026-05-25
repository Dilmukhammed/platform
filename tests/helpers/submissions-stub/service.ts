import {
  buildImagePreviewAsset,
  buildOriginalSubmissionAsset,
  getSubmissionFixtureDescriptor,
  listSubmissionFixtureOptions,
  type DeterministicAssetDraft,
} from "@/lib/storage/submission-assets";
import { buildPdfPagePreviewAssets } from "@/lib/pdf/page-previews";
import { getClassesState } from "../classes-stub";
import { getPublicationsState } from "../publications-stub";
import { getStudentsState } from "../students-stub";

import { getSubmissionsState } from "./store";
import type {
  AssignmentResultRecord,
  StudentAssignmentPublicationSummary,
  StudentPublicationSubmissionDetail,
  StudentSubmissionAssetSummary,
  StudentSubmissionSummary,
  SubmissionAssetRecord,
  SubmissionRecord,
} from "./types";

function nextResultId(records: AssignmentResultRecord[]) {
  return `74000000-0000-4000-8000-${String(records.length + 1).padStart(12, "0")}`;
}

function nextSubmissionId(records: SubmissionRecord[]) {
  return `74100000-0000-4000-8000-${String(records.length + 1).padStart(12, "0")}`;
}

function nextAssetId(records: SubmissionAssetRecord[]) {
  return `74200000-0000-4000-8000-${String(records.length + 1).padStart(12, "0")}`;
}

function getStudentProfile(studentId: string) {
  const student = getStudentsState().profiles.find((candidate) => candidate.id === studentId && candidate.status === "active");

  if (!student) {
    throw new Error("Student profile is unavailable.");
  }

  return student;
}

function resolveStudentPublicationAccess(studentId: string, publicationId: string) {
  getStudentProfile(studentId);

  const publicationsState = getPublicationsState();
  const classesState = getClassesState();
  const publication = publicationsState.publications.find((candidate) => candidate.id === publicationId);

  if (!publication) {
    throw new Error("Publication not found in the student enrollment scope.");
  }

  const enrollmentClassIds = new Set(
    classesState.enrollments.filter((enrollment) => enrollment.studentId === studentId).map((enrollment) => enrollment.classId),
  );
  const matchingTarget = publicationsState.publicationClasses
    .filter((record) => record.publicationId === publicationId && enrollmentClassIds.has(record.classId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.classId.localeCompare(right.classId))[0];

  if (!matchingTarget) {
    throw new Error("Publication not found in the student enrollment scope.");
  }

  const classRecord = classesState.classes.find((candidate) => candidate.id === matchingTarget.classId && candidate.status === "active");

  if (!classRecord) {
    throw new Error("Publication target class is unavailable.");
  }

  return {
    publication,
    classRecord,
    effectiveDeadline: matchingTarget.deadlineOverride ?? publication.defaultDeadline,
  };
}

function mapSubmissionAssets(submissionId: string): StudentSubmissionAssetSummary[] {
  return getSubmissionsState().assets
    .filter((asset) => asset.submissionId === submissionId)
    .map(({ resultId: _resultId, publicationId: _publicationId, studentId: _studentId, ...asset }) => asset)
    .sort((left, right) => {
      const leftOrder = left.pageNumber ?? 0;
      const rightOrder = right.pageNumber ?? 0;
      return leftOrder - rightOrder || left.createdAt.localeCompare(right.createdAt);
    });
}

function mapSubmissionSummary(record: SubmissionRecord): StudentSubmissionSummary {
  return {
    ...record,
    assets: mapSubmissionAssets(record.id),
  };
}

function getResultByPublicationAndStudent(input: { publicationId: string; studentId: string }) {
  return (
    getSubmissionsState().results.find(
      (record) => record.publicationId === input.publicationId && record.studentId === input.studentId,
    ) ?? null
  );
}

function getOrCreateAssignmentResult(input: {
  publicationId: string;
  studentId: string;
  classId: string;
  organizationId: string;
  teacherId: string;
  templateId: string;
  timestamp: string;
}) {
  const state = getSubmissionsState();
  const existing = getResultByPublicationAndStudent(input);

  if (existing) {
    return existing;
  }

  const result: AssignmentResultRecord = {
    id: nextResultId(state.results),
    publicationId: input.publicationId,
    studentId: input.studentId,
    classId: input.classId,
    organizationId: input.organizationId,
    teacherId: input.teacherId,
    templateId: input.templateId,
    status: "submitted",
    latestSubmissionId: "",
    submissionIds: [],
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };

  state.results.push(result);
  return result;
}

function persistAssetDrafts(input: {
  resultId: string;
  submissionId: string;
  publicationId: string;
  studentId: string;
  timestamp: string;
  original: DeterministicAssetDraft;
  previews: DeterministicAssetDraft[];
}) {
  const state = getSubmissionsState();
  const originalAssetId = nextAssetId(state.assets);
  const originalAsset: SubmissionAssetRecord = {
    id: originalAssetId,
    submissionId: input.submissionId,
    resultId: input.resultId,
    publicationId: input.publicationId,
    studentId: input.studentId,
    variant: input.original.variant,
    assetKind: input.original.assetKind,
    storagePath: input.original.storagePath,
    fixturePath: input.original.fixturePath,
    fileName: input.original.fileName,
    mimeType: input.original.mimeType,
    extension: input.original.extension,
    byteSize: input.original.byteSize,
    checksum: input.original.checksum,
    width: input.original.width,
    height: input.original.height,
    pageNumber: input.original.pageNumber,
    pageCount: input.original.pageCount,
    derivativeOfAssetId: null,
    downloadOnly: input.original.downloadOnly,
    createdAt: input.timestamp,
  };

  state.assets.push(originalAsset);

  const previewAssetIds = input.previews.map((draft) => {
    const id = nextAssetId(state.assets);

    state.assets.push({
      id,
      submissionId: input.submissionId,
      resultId: input.resultId,
      publicationId: input.publicationId,
      studentId: input.studentId,
      variant: draft.variant,
      assetKind: draft.assetKind,
      storagePath: draft.storagePath,
      fixturePath: draft.fixturePath,
      fileName: draft.fileName,
      mimeType: draft.mimeType,
      extension: draft.extension,
      byteSize: draft.byteSize,
      checksum: draft.checksum,
      width: draft.width,
      height: draft.height,
      pageNumber: draft.pageNumber,
      pageCount: draft.pageCount,
      derivativeOfAssetId: originalAssetId,
      downloadOnly: draft.downloadOnly,
      createdAt: input.timestamp,
    });

    return id;
  });

  return {
    originalAssetId,
    previewAssetIds,
  };
}

function buildPreviewDrafts(input: {
  fixturePath: string;
  publicationId: string;
  studentId: string;
  submissionId: string;
}) {
  const descriptor = getSubmissionFixtureDescriptor(input.fixturePath);

  if (descriptor.assetKind === "image") {
    return {
      pageCount: null,
      previews: [
        buildImagePreviewAsset({
          fixturePath: input.fixturePath,
          publicationId: input.publicationId,
          studentId: input.studentId,
          submissionId: input.submissionId,
        }),
      ],
    };
  }

  if (descriptor.assetKind === "pdf") {
    return buildPdfPagePreviewAssets(input);
  }

  return {
    pageCount: null,
    previews: [],
  };
}

export function listStudentAssignmentPublications(studentId: string): StudentAssignmentPublicationSummary[] {
  getStudentProfile(studentId);

  const publicationsState = getPublicationsState();
  const classesState = getClassesState();
  const enrollmentClassIds = new Set(
    classesState.enrollments.filter((enrollment) => enrollment.studentId === studentId).map((enrollment) => enrollment.classId),
  );

  return publicationsState.publicationClasses
    .filter((target) => enrollmentClassIds.has(target.classId))
    .map((target) => {
      const publication = publicationsState.publications.find((candidate) => candidate.id === target.publicationId);
      const classRecord = classesState.classes.find((candidate) => candidate.id === target.classId && candidate.status === "active");

      if (!publication || !classRecord) {
        throw new Error("Student publication listing contains unavailable records.");
      }

      const result = getResultByPublicationAndStudent({ publicationId: publication.id, studentId });
      const latestSubmission = result
        ? getSubmissionsState().submissions.find((candidate) => candidate.id === result.latestSubmissionId) ?? null
        : null;

      return {
        publicationId: publication.id,
        templateId: publication.templateId,
        title: publication.title,
        description: publication.description,
        instructions: publication.instructions,
        classId: classRecord.id,
        className: classRecord.name,
        organizationId: publication.organizationId,
        effectiveDeadline: target.deadlineOverride ?? publication.defaultDeadline,
        linkedMaterialCount: publication.linkedMaterialIds.length,
        linkedTestCount: publication.linkedTestIds.length,
        resultStatus: result ? "submitted" : "not_started",
        latestSubmittedAt: latestSubmission?.submittedAt ?? null,
      } satisfies StudentAssignmentPublicationSummary;
    })
    .sort((left, right) => left.effectiveDeadline.localeCompare(right.effectiveDeadline) || left.title.localeCompare(right.title));
}

export function getSubmission(submissionId: string): SubmissionRecord | undefined {
  return getSubmissionsState().submissions.find((s) => s.id === submissionId);
}

export function getSubmissionAssets(submissionId: string): SubmissionAssetRecord[] {
  return getSubmissionsState().assets.filter((a) => a.submissionId === submissionId);
}

export function getStudentPublicationSubmissionDetail(input: {
  studentId: string;
  publicationId: string;
}): StudentPublicationSubmissionDetail {
  const access = resolveStudentPublicationAccess(input.studentId, input.publicationId);
  const result = getResultByPublicationAndStudent(input);
  const submissions = result
    ? getSubmissionsState().submissions
        .filter((submission) => submission.resultId === result.id)
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
        .map(mapSubmissionSummary)
    : [];

  return {
    publicationId: access.publication.id,
    templateId: access.publication.templateId,
    title: access.publication.title,
    description: access.publication.description,
    instructions: access.publication.instructions,
    classId: access.classRecord.id,
    className: access.classRecord.name,
    organizationId: access.publication.organizationId,
    effectiveDeadline: access.effectiveDeadline,
    linkedMaterialCount: access.publication.linkedMaterialIds.length,
    linkedTestCount: access.publication.linkedTestIds.length,
    resultStatus: result ? "submitted" : "not_started",
    latestSubmittedAt: submissions[0]?.submittedAt ?? null,
    result: result
      ? {
          ...result,
          latestSubmission: submissions.find((submission) => submission.id === result.latestSubmissionId) ?? null,
        }
      : null,
    submissions,
    fixtureOptions: listSubmissionFixtureOptions(),
  };
}

export function createStudentPracticeSubmission(input: {
  studentId: string;
  publicationId: string;
  fixturePath: string;
}) {
  const timestamp = new Date().toISOString();
  const access = resolveStudentPublicationAccess(input.studentId, input.publicationId);
  const state = getSubmissionsState();
  const submissionId = nextSubmissionId(state.submissions);
  const originalAssetDraft = buildOriginalSubmissionAsset({
    fixturePath: input.fixturePath,
    publicationId: input.publicationId,
    studentId: input.studentId,
    submissionId,
  });
  const previewDrafts = buildPreviewDrafts({
    fixturePath: input.fixturePath,
    publicationId: input.publicationId,
    studentId: input.studentId,
    submissionId,
  });
  const result = getOrCreateAssignmentResult({
    publicationId: input.publicationId,
    studentId: input.studentId,
    classId: access.classRecord.id,
    organizationId: access.publication.organizationId,
    teacherId: access.publication.teacherId,
    templateId: access.publication.templateId,
    timestamp,
  });
  const assets = persistAssetDrafts({
    resultId: result.id,
    submissionId,
    publicationId: input.publicationId,
    studentId: input.studentId,
    timestamp,
    original: originalAssetDraft,
    previews: previewDrafts.previews,
  });
  const submission: SubmissionRecord = {
    id: submissionId,
    resultId: result.id,
    publicationId: input.publicationId,
    studentId: input.studentId,
    classId: access.classRecord.id,
    organizationId: access.publication.organizationId,
    teacherId: access.publication.teacherId,
    templateId: access.publication.templateId,
    assetKind: originalAssetDraft.assetKind,
    originalAssetId: assets.originalAssetId,
    previewAssetIds: assets.previewAssetIds,
    pageCount: previewDrafts.pageCount,
    submittedAt: timestamp,
  };

  state.submissions.push(submission);
  result.status = "submitted";
  result.latestSubmissionId = submission.id;
  result.submissionIds = [...result.submissionIds, submission.id];
  result.updatedAt = timestamp;

  return {
    result: { ...result, submissionIds: [...result.submissionIds] },
    submission: mapSubmissionSummary(submission),
  };
}
