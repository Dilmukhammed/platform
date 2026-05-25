import { getSubmission } from "@/modules/submissions";

import { reviewsService } from "./service";

export function requireTeacherOwnedSubmission(input: { teacherId: string; submissionId: string }) {
  const submission = getSubmission(input.submissionId);

  if (!submission || submission.teacherId !== input.teacherId) {
    throw new Error("Submission not found for this teacher.");
  }

  return submission;
}

export function requireTeacherOwnedReview(input: { teacherId: string; submissionId: string; reviewId: string }) {
  const submission = requireTeacherOwnedSubmission(input);
  const review = reviewsService.getReviewBySubmissionId(input.submissionId);

  if (!review || review.id !== input.reviewId || review.teacherId !== input.teacherId) {
    throw new Error("Review not found for this teacher submission.");
  }

  return { submission, review };
}
