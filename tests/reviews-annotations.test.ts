import { describe, it, expect, beforeEach } from "bun:test";
import { reviewsService, resetReviewsState } from "./helpers/reviews-stub";
import { annotationsService, resetAnnotationsState } from "./helpers/annotations-stub";
import { requireTeacherOwnedReview, requireTeacherOwnedSubmission } from "./helpers/reviews-stub/access";
import { getSubmissionsState, resetSubmissionsState } from "./helpers/submissions-stub";

const ownerTeacherId = "teacher-owner-1";
const otherTeacherId = "teacher-owner-2";

function seedSubmission() {
  getSubmissionsState().submissions.push({
    id: "sub-1",
    resultId: "res-1",
    publicationId: "pub-1",
    studentId: "stu-1",
    classId: "class-1",
    organizationId: "org-1",
    teacherId: ownerTeacherId,
    templateId: "template-1",
    assetKind: "image",
    originalAssetId: "asset-original-1",
    previewAssetIds: [],
    pageCount: 1,
    submittedAt: "2026-04-11T12:00:00.000Z",
  });
}

describe("Reviews and Annotations", () => {
  beforeEach(() => {
    resetReviewsState();
    resetAnnotationsState();
    resetSubmissionsState();
  });

  it("should create and update a review", () => {
    const review = reviewsService.createOrUpdateReview(
      "sub-1",
      "res-1",
      "pub-1",
      "stu-1",
      "tea-1",
      "Great work!",
      "draft"
    );

    expect(review.submissionId).toBe("sub-1");
    expect(review.status).toBe("draft");
    expect(review.comment).toBe("Great work!");
    expect(review.releasedAt).toBeNull();

    const updated = reviewsService.createOrUpdateReview(
      "sub-1",
      "res-1",
      "pub-1",
      "stu-1",
      "tea-1",
      "Great work! Released.",
      "released"
    );

    expect(updated.id).toBe(review.id);
    expect(updated.status).toBe("released");
    expect(updated.comment).toBe("Great work! Released.");
    expect(updated.releasedAt).not.toBeNull();
  });

  it("should save and update annotations by asset and page with immutable versioning", () => {
    const reviewId = "rev-1";
    const submissionId = "sub-1";
    const assetId = "asset-1";
    const pageNumber = 1;

    const data1 = { strokes: [{ points: [{ x: 10, y: 10 }], color: "red", width: 2 }] };
    const ann1 = annotationsService.saveAnnotation(reviewId, submissionId, assetId, pageNumber, data1, 800, 600);

    expect(ann1.reviewId).toBe(reviewId);
    expect(ann1.assetId).toBe(assetId);
    expect(ann1.pageNumber).toBe(pageNumber);
    expect(ann1.version).toBe(1);
    expect(ann1.data).toEqual(data1);
    expect(ann1.baseWidth).toBe(800);
    expect(ann1.baseHeight).toBe(600);

    const data2 = { strokes: [{ points: [{ x: 10, y: 10 }, { x: 20, y: 20 }], color: "red", width: 2 }] };
    const ann2 = annotationsService.saveAnnotation(reviewId, submissionId, assetId, pageNumber, data2, 800, 600);

    // Immutable versioning: new record, different id
    expect(ann2.id).not.toBe(ann1.id);
    expect(ann2.version).toBe(2);
    expect(ann2.data).toEqual(data2);

    // Different page
    const ann3 = annotationsService.saveAnnotation(reviewId, submissionId, assetId, 2, data1, 800, 600);
    expect(ann3.id).not.toBe(ann1.id);
    expect(ann3.id).not.toBe(ann2.id);
    expect(ann3.pageNumber).toBe(2);
    expect(ann3.version).toBe(1);
  });

  it("should retrieve only latest annotations by reviewId", () => {
    annotationsService.saveAnnotation("rev-1", "sub-1", "asset-1", 1, { strokes: [] }, 800, 600);
    annotationsService.saveAnnotation("rev-1", "sub-1", "asset-1", 2, { strokes: [] }, 800, 600);
    annotationsService.saveAnnotation("rev-2", "sub-2", "asset-2", null, { strokes: [] }, 800, 600);

    const rev1Anns = annotationsService.getAnnotationsByReviewId("rev-1");
    expect(rev1Anns.length).toBe(2);

    const rev2Anns = annotationsService.getAnnotationsByReviewId("rev-2");
    expect(rev2Anns.length).toBe(1);
  });

  it("should return all versions via getAnnotationHistory in ascending order", () => {
    const reviewId = "rev-1";
    const assetId = "asset-1";
    const pageNumber = 1;

    annotationsService.saveAnnotation(reviewId, "sub-1", assetId, pageNumber, { strokes: [] }, 800, 600);
    annotationsService.saveAnnotation(reviewId, "sub-1", assetId, pageNumber, { strokes: [{ points: [{ x: 1, y: 1 }], color: "blue", width: 1 }] }, 800, 600);
    annotationsService.saveAnnotation(reviewId, "sub-1", assetId, pageNumber, { strokes: [{ points: [{ x: 2, y: 2 }], color: "green", width: 3 }] }, 800, 600);

    const history = annotationsService.getAnnotationHistory(reviewId, assetId, pageNumber);
    expect(history.length).toBe(3);
    expect(history[0].version).toBe(1);
    expect(history[1].version).toBe(2);
    expect(history[2].version).toBe(3);
  });

  it("should return latest version via getAnnotation after multiple saves", () => {
    const reviewId = "rev-1";
    const assetId = "asset-1";
    const pageNumber = 1;

    annotationsService.saveAnnotation(reviewId, "sub-1", assetId, pageNumber, { strokes: [] }, 800, 600);
    annotationsService.saveAnnotation(reviewId, "sub-1", assetId, pageNumber, { strokes: [] }, 800, 600);
    annotationsService.saveAnnotation(reviewId, "sub-1", assetId, pageNumber, { strokes: [] }, 800, 600);

    const latest = annotationsService.getAnnotation(reviewId, assetId, pageNumber);
    expect(latest).toBeDefined();
    expect(latest!.version).toBe(3);
  });

  it("should return only latest per (assetId, pageNumber) from getAnnotationsByReviewId — no duplicates", () => {
    const reviewId = "rev-1";

    // Save 3 versions for asset-1 page 1
    annotationsService.saveAnnotation(reviewId, "sub-1", "asset-1", 1, { strokes: [] }, 800, 600);
    annotationsService.saveAnnotation(reviewId, "sub-1", "asset-1", 1, { strokes: [] }, 800, 600);
    annotationsService.saveAnnotation(reviewId, "sub-1", "asset-1", 1, { strokes: [] }, 800, 600);

    // Save 2 versions for asset-1 page 2
    annotationsService.saveAnnotation(reviewId, "sub-1", "asset-1", 2, { strokes: [] }, 800, 600);
    annotationsService.saveAnnotation(reviewId, "sub-1", "asset-1", 2, { strokes: [] }, 800, 600);

    const results = annotationsService.getAnnotationsByReviewId(reviewId);
    // Should be exactly 2 entries: one for page 1 (version 3) and one for page 2 (version 2)
    expect(results.length).toBe(2);

    const page1 = results.find(a => a.pageNumber === 1);
    const page2 = results.find(a => a.pageNumber === 2);
    expect(page1).toBeDefined();
    expect(page1!.version).toBe(3);
    expect(page2).toBeDefined();
    expect(page2!.version).toBe(2);
  });

  it("should preserve old versions in the store (retrievable via history)", () => {
    const reviewId = "rev-1";
    const assetId = "asset-1";
    const pageNumber = 1;

    const data1 = { strokes: [{ points: [{ x: 1, y: 1 }], color: "red", width: 1 }] };
    const data2 = { strokes: [{ points: [{ x: 2, y: 2 }], color: "blue", width: 2 }] };

    const ann1 = annotationsService.saveAnnotation(reviewId, "sub-1", assetId, pageNumber, data1, 800, 600);
    const ann2 = annotationsService.saveAnnotation(reviewId, "sub-1", assetId, pageNumber, data2, 800, 600);

    const history = annotationsService.getAnnotationHistory(reviewId, assetId, pageNumber);
    expect(history.length).toBe(2);
    // Old version preserved
    expect(history[0].id).toBe(ann1.id);
    expect(history[0].version).toBe(1);
    expect(history[0].data).toEqual(data1);
    // New version present
    expect(history[1].id).toBe(ann2.id);
    expect(history[1].version).toBe(2);
    expect(history[1].data).toEqual(data2);
  });

  it("rejects review writes for a teacher who does not own the submission", () => {
    seedSubmission();

    expect(() =>
      requireTeacherOwnedSubmission({
        teacherId: otherTeacherId,
        submissionId: "sub-1",
      }),
    ).toThrow("Submission not found for this teacher.");
  });

  it("rejects annotation writes when the review is not owned by the teacher", () => {
    seedSubmission();
    const review = reviewsService.createOrUpdateReview("sub-1", "res-1", "pub-1", "stu-1", ownerTeacherId, null, "draft");

    expect(() =>
      requireTeacherOwnedReview({
        teacherId: otherTeacherId,
        submissionId: "sub-1",
        reviewId: review.id,
      }),
    ).toThrow("Submission not found for this teacher.");
  });
});
