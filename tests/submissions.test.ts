import { beforeEach, describe, expect, test } from "bun:test";

import { createAssignmentTemplate, resetAssignmentsState } from "./helpers/assignments-stub";
import { resetClassesState } from "./helpers/classes-stub";
import { resetJoinCodesState } from "@/modules/join-codes";
import { resetOrganizationsState } from "./helpers/organizations-stub";
import { publishAssignmentTemplate, resetPublicationsState } from "./helpers/publications-stub";
import {
  createStudentPracticeSubmission,
  getStudentPublicationSubmissionDetail,
  getSubmissionsState,
  listStudentAssignmentPublications,
  resetSubmissionsState,
} from "./helpers/submissions-stub";
import { resetStudentsState } from "./helpers/students-stub";

const teacherId = "20000000-0000-4000-8000-000000000002";
const studentId = "50000000-0000-4000-8000-000000000001";

function publishSeededAssignment() {
  const template = createAssignmentTemplate({
    teacherId,
    title: "Submission pipeline coverage",
    description: "Deterministic submission verification template.",
    instructions: "Pick the required fixture and submit it.",
  });

  return publishAssignmentTemplate({
    teacherId,
    templateId: template.id,
    defaultDeadline: "2026-05-22T09:30",
    classIds: ["60000000-0000-4000-8000-000000000001"],
  });
}

describe("submission pipeline and asset processing", () => {
  beforeEach(() => {
    resetOrganizationsState();
    resetClassesState();
    resetJoinCodesState();
    resetStudentsState();
    resetAssignmentsState();
    resetPublicationsState();
    resetSubmissionsState();
  });

  test("student sees only publications in enrolled scope", () => {
    const publication = publishSeededAssignment();

    const listings = listStudentAssignmentPublications(studentId);

    expect(listings).toHaveLength(1);
    expect(listings[0]?.publicationId).toBe(publication.id);
    expect(() => getStudentPublicationSubmissionDetail({ studentId: "50000000-0000-4000-8000-000000009999", publicationId: publication.id })).toThrow(
      "Student profile is unavailable.",
    );
  });

  test("image submission creates distinct original and preview metadata", () => {
    const publication = publishSeededAssignment();

    const result = createStudentPracticeSubmission({
      studentId,
      publicationId: publication.id,
      fixturePath: "fixtures/submissions/sample.jpg",
    });

    expect(result.submission.assetKind).toBe("image");
    expect(result.submission.previewAssetIds).toHaveLength(1);
    expect(result.submission.pageCount).toBeNull();

    const assets = result.submission.assets;
    expect(assets).toHaveLength(2);
    expect(assets[0]?.variant).toBe("original");
    expect(assets[0]?.storagePath).toContain("/original.");
    expect(assets[1]?.variant).toBe("preview");
    expect(assets[1]?.derivativeOfAssetId).toBe(assets[0]?.id);
  });

  test("pdf submission creates page preview metadata with page count", () => {
    const publication = publishSeededAssignment();

    const result = createStudentPracticeSubmission({
      studentId,
      publicationId: publication.id,
      fixturePath: "fixtures/submissions/sample.pdf",
    });

    expect(result.submission.assetKind).toBe("pdf");
    expect(result.submission.pageCount).toBe(3);
    expect(result.submission.previewAssetIds).toHaveLength(3);

    const previewAssets = result.submission.assets.filter((asset) => asset.variant === "page_preview");
    expect(previewAssets).toHaveLength(3);
    expect(previewAssets.map((asset) => asset.pageNumber)).toEqual([1, 2, 3]);
    expect(previewAssets.every((asset) => asset.pageCount === 3)).toBe(true);
  });

  test("dwg submission stays archive-only without previews", () => {
    const publication = publishSeededAssignment();

    const result = createStudentPracticeSubmission({
      studentId,
      publicationId: publication.id,
      fixturePath: "fixtures/submissions/sample.dwg",
    });

    expect(result.submission.assetKind).toBe("dwg");
    expect(result.submission.previewAssetIds).toHaveLength(0);
    expect(result.submission.assets).toHaveLength(1);
    expect(result.submission.assets[0]?.downloadOnly).toBe(true);
    expect(result.submission.assets[0]?.variant).toBe("original");
  });

  test("result record is reused for repeated submissions to the same publication", () => {
    const publication = publishSeededAssignment();

    const first = createStudentPracticeSubmission({
      studentId,
      publicationId: publication.id,
      fixturePath: "fixtures/submissions/sample.jpg",
    });
    const second = createStudentPracticeSubmission({
      studentId,
      publicationId: publication.id,
      fixturePath: "fixtures/submissions/sample.pdf",
    });

    expect(first.result.id).toBe(second.result.id);
    expect(second.result.latestSubmissionId).toBe(second.submission.id);
    expect(second.result.submissionIds).toEqual([first.submission.id, second.submission.id]);
    expect(getSubmissionsState().results).toHaveLength(1);
  });
});
