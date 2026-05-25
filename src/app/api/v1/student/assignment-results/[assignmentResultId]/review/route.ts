/**
 * GET /api/v1/student/assignment-results/{assignmentResultId}/review
 *
 * Returns student-safe released review details for the owning student only.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const paramsSchema = z.object({
  assignmentResultId: z.string().uuid("Invalid assignment result ID format."),
});

export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const validation = paramsSchema.safeParse(params);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid assignment result ID.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const { assignmentResultId } = validation.data;
      const supabase = createServerClient();

      const { data: result, error: resultError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          status,
          released_at,
          assignment_publication_classes!inner(
            assignment_publications!inner(
              assignment_templates!inner(
                id,
                title,
                description
              )
            )
          ),
          class_enrollments!inner(
            student_profile_id
          )
        `,
        )
        .eq("id", assignmentResultId)
        .eq("class_enrollments.student_profile_id", session.userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[student/assignment-results/review] Result query error:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review details."),
        );
      }

      if (!result) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found."),
        );
      }

      if (result.status !== "released") {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "Review has not been released yet."),
        );
      }

      const { data: review, error: reviewError } = await supabase
        .from("submission_reviews")
        .select(
          `
          *,
          review_comments!left(
            id,
            author_type,
            parent_comment_id,
            body,
            is_internal,
            created_at,
            updated_at
          ),
          annotation_documents!left(
            id,
            derived_asset_id,
            page_index,
            version,
            is_current,
            base_width,
            base_height,
            payload_json,
            created_at,
            deleted_at
          )
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .eq("status", "released")
        .is("deleted_at", null)
        .maybeSingle();

      if (reviewError) {
        console.error("[student/assignment-results/review] Review query error:", reviewError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review details."),
        );
      }

      const { data: grade, error: gradeError } = await supabase
        .from("grade_records")
        .select(
          `
          id,
          mapped_grade,
          practice_score_raw,
          test_score_raw,
          final_score_raw,
          is_overridden,
          override_reason,
          formula_snapshot_json
        `,
        )
        .eq("assignment_result_id", assignmentResultId)
        .eq("status", "current")
        .is("deleted_at", null)
        .maybeSingle();

      if (gradeError) {
        console.error("[student/assignment-results/review] Grade query error:", gradeError);
      }

      // Supabase JS v2: many-to-one joins return single objects, not arrays
      const pubClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;

      const reviewRecord = review as Record<string, unknown> | null;
      const comments = ((reviewRecord?.review_comments as Array<Record<string, unknown>> | undefined) ?? []).filter(
        (comment) => comment.is_internal !== true,
      );
      const annotations = ((reviewRecord?.annotation_documents as Array<Record<string, unknown>> | undefined) ?? []).filter(
        (annotation) => annotation.is_current === true && annotation.deleted_at == null,
      );

      return toResponse(
        successResponse({
          assignmentResultId: result.id,
          status: result.status,
          releasedAt: result.released_at,
          assignment: {
            templateId: template?.id,
            title: template?.title,
            description: template?.description,
          },
          review: reviewRecord
            ? {
                reviewId: reviewRecord.id,
                status: reviewRecord.status,
                releasedAt: reviewRecord.released_at,
                reviewedAt: reviewRecord.reviewed_at ?? reviewRecord.updated_at,
                createdAt: reviewRecord.created_at,
                updatedAt: reviewRecord.updated_at,
                teacherFeedback:
                  reviewRecord.teacher_feedback ??
                  reviewRecord.feedback ??
                  reviewRecord.overall_feedback ??
                  null,
                teacherSummary: reviewRecord.teacher_summary ?? reviewRecord.summary ?? null,
                reviewMetadata: {
                  rubricSnapshot:
                    reviewRecord.rubric_snapshot_json ?? reviewRecord.grade_breakdown_json ?? null,
                  criteriaScores:
                    reviewRecord.criteria_scores_json ?? reviewRecord.scores_json ?? null,
                },
              }
            : null,
          comments: comments.map((comment) => ({
            commentId: comment.id,
            authorType: comment.author_type,
            parentCommentId: comment.parent_comment_id,
            body: comment.body,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
          })),
          annotations: annotations.map((annotation) => ({
            annotationId: annotation.id,
            derivedAssetId: annotation.derived_asset_id,
            pageIndex: annotation.page_index,
            version: annotation.version,
            isCurrent: annotation.is_current,
            baseWidth: annotation.base_width,
            baseHeight: annotation.base_height,
            payloadJson: annotation.payload_json,
            createdAt: annotation.created_at,
          })),
          grade: grade
            ? {
                mappedGrade: grade.mapped_grade,
                practiceScore: grade.practice_score_raw,
                testScore: grade.test_score_raw,
                finalScore: grade.final_score_raw,
                isOverridden: grade.is_overridden,
                overrideReason: grade.override_reason,
                formulaSnapshot: grade.formula_snapshot_json,
              }
            : null,
        }),
      );
    } catch (err) {
      console.error("[student/assignment-results/review] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review details."),
      );
    }
  },
  { requiredRole: "student" },
);
