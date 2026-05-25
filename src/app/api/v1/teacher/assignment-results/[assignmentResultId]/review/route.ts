/**
 * GET /api/v1/teacher/assignment-results/{assignmentResultId}/review — Get review details.
 * POST /api/v1/teacher/assignment-results/{assignmentResultId}/review — Save draft review feedback.
 *
 * Returns or updates the submission review with comments and annotations for a specific assignment result.
 * Verifies the teacher has access to the class this result belongs to.
 */

import { z } from "zod/v4";

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

const saveDraftReviewSchema = z.object({
  comment: z.string().trim().max(5000).nullable().optional(),
});

// GET — Get review details
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const assignmentResultId = params.assignmentResultId as string;

      const supabase = createServerClient();

      // Verify teacher has access to this assignment result (three-step query)
      const { data: resultData, error: resultError } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          assignment_publication_class_id,
          practice_submitted_at,
          test_submitted_at,
          class_enrollments!inner(
            student_profile_id,
            student_profiles!left(id, display_name, student_login)
          )
        `
        )
        .eq("id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[teacher/assignment-results/review] Error fetching result:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment result."),
        );
      }

      if (!resultData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      const { data: pubClassData, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .select(
          `
            class_id,
            classes!left(id, title),
            assignment_publications!inner(
              assignment_templates!left(id, title, description, linked_test_id)
            )
        `,
        )
        .eq("id", resultData.assignment_publication_class_id)
        .maybeSingle();

      if (pubClassError || !pubClassData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      const { data: classTeacher } = await supabase
        .from("class_teachers")
        .select("id")
        .eq("class_id", pubClassData.class_id)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      // Fetch submission review with comments and annotations
      const { data: reviewData, error: reviewError } = await supabase
        .from("submission_reviews")
        .select(
          `
          *,
          review_comments!left(
            id,
            author_type,
            author_platform_user_id,
            author_student_profile_id,
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
        `
        )
        .eq("assignment_result_id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      if (reviewError) {
        console.error("[teacher/assignment-results/review] Error fetching review:", reviewError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review."),
        );
      }

      // Get grade record if exists
      const { data: gradeRecord } = await supabase
        .from("grade_records")
        .select("*")
        .eq("assignment_result_id", assignmentResultId)
        .eq("status", "current")
        .is("deleted_at", null)
        .maybeSingle();

      // Get submission files for context
      const { data: submissionFiles } = await supabase
        .from("submission_files")
        .select(
          `
          *,
          derived_assets!left(id, kind, storage_path, page_index, width, height, derivation_status, error_message, mime_type, byte_size, is_current, deleted_at)
        `
        )
        .eq("assignment_result_id", assignmentResultId)
        .eq("is_current", true)
        .is("deleted_at", null)
        .order("sort_order");

      // Transform enrollment data
      const enrollment = resultData.class_enrollments as unknown as Record<string, unknown> | null;
      const studentProfile = enrollment?.student_profiles as unknown as Record<string, unknown> | null;
      const pubClass = pubClassData as unknown as Record<string, unknown> | null;
      const classData = pubClass?.classes as unknown as Record<string, unknown> | null;
      const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
      const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;

      // Get current test attempt if assignment has a linked test and test was submitted
      const linkedTestId = template?.linked_test_id as string | null;
      const testSubmittedAt = resultData.test_submitted_at as string | null;
      let testAttemptId: string | null = null;

      if (linkedTestId && testSubmittedAt) {
        const { data: currentAttempt } = await supabase
          .from("test_attempts")
          .select("id")
          .eq("assignment_result_id", assignmentResultId)
          .eq("is_current", true)
          .is("deleted_at", null)
          .maybeSingle();

        testAttemptId = currentAttempt?.id ?? null;
      }

      // Transform review data
      const review = reviewData;
      const comments = (review?.review_comments as Array<Record<string, unknown>>) ?? [];
      const annotations = ((review?.annotation_documents as Array<Record<string, unknown>>) ?? []).filter(
        (annotation) => annotation.is_current === true && annotation.deleted_at == null,
      );

      const response = {
        assignmentResultId,
        student: {
          studentProfileId: studentProfile?.id,
          displayName: studentProfile?.display_name,
          studentLogin: studentProfile?.student_login,
        },
        classInfo: {
          classId: classData?.id,
          title: classData?.title,
        },
        assignment: {
          templateId: template?.id,
          title: template?.title,
          description: template?.description,
          linkedTestId: linkedTestId ?? null,
        },
        practiceSubmittedAt: resultData.practice_submitted_at ?? null,
        testSubmittedAt: testSubmittedAt ?? null,
        testAttemptId,
        review: review ? {
          reviewId: review.id,
          status: review.status,
          reviewedByTeacherId: review.reviewed_by_teacher_id,
          releasedAt: review.released_at,
          createdAt: review.created_at,
          updatedAt: review.updated_at,
        } : null,
        comments: comments.map((c) => ({
          commentId: c.id,
          authorType: c.author_type,
          authorPlatformUserId: c.author_platform_user_id,
          authorStudentProfileId: c.author_student_profile_id,
          parentCommentId: c.parent_comment_id,
          body: c.body,
          isInternal: c.is_internal,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
        annotations: annotations.map((a) => ({
          annotationId: a.id,
          derivedAssetId: a.derived_asset_id,
          pageIndex: a.page_index,
          version: a.version,
          isCurrent: a.is_current,
          baseWidth: a.base_width,
          baseHeight: a.base_height,
          payloadJson: a.payload_json,
          createdAt: a.created_at,
        })),
        grade: gradeRecord ? {
          gradeRecordId: gradeRecord.id,
          mappedGrade: gradeRecord.mapped_grade,
          practiceScoreRaw: gradeRecord.practice_score_raw,
          testScoreRaw: gradeRecord.test_score_raw,
          finalScoreRaw: gradeRecord.final_score_raw,
          isOverridden: gradeRecord.is_overridden,
          overrideReason: gradeRecord.override_reason,
        } : null,
        submissionFiles: (submissionFiles ?? []).map((f) => ({
          fileId: f.id,
          fileRole: f.file_role,
          fileKind: f.file_kind,
          originalFilename: f.original_filename,
          mimeType: f.mime_type,
          fileSizeBytes: f.file_size_bytes,
          derivation: summarizeDerivedAssetRows((f.derived_assets as Array<Record<string, unknown>>) ?? []),
          derivedAssets: ((f.derived_assets as Array<Record<string, unknown>>) ?? [])
            .filter((da) => da.is_current === true && da.deleted_at == null && da.derivation_status === "ready")
            .sort((left, right) => {
              const leftPage = typeof left.page_index === "number" ? left.page_index : -1;
              const rightPage = typeof right.page_index === "number" ? right.page_index : -1;
              return leftPage - rightPage;
            })
            .map((da) => ({
              assetId: da.id,
              kind: da.kind,
              storagePath: da.storage_path,
              pageIndex: da.page_index,
              width: da.width,
              height: da.height,
              derivationStatus: da.derivation_status,
              errorMessage: da.error_message,
              mimeType: da.mime_type,
              byteSize: da.byte_size,
            })),
        })),
      };

      return toResponse(successResponse(response));
    } catch (err) {
      console.error("[teacher/assignment-results/review] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review details."),
      );
    }
  },
  { requiredRole: "teacher" },
);

export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const assignmentResultId = params.assignmentResultId as string;
      const body = await request.json();
      const validation = saveDraftReviewSchema.safeParse(body);

      if (!validation.success) {
        return toResponse(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            "Invalid review data.",
            undefined,
            validation.error.issues,
          ),
        );
      }

      const comment = validation.data.comment?.trim() ?? "";
      const supabase = createServerClient();

      const { data: resultData, error: resultError } = await supabase
        .from("assignment_results")
        .select("id, assignment_publication_class_id")
        .eq("id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      if (resultError) {
        console.error("[teacher/assignment-results/review:save] Error fetching result:", resultError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment result."),
        );
      }

      if (!resultData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      const { data: pubClassData, error: pubClassError } = await supabase
        .from("assignment_publication_classes")
        .select("class_id")
        .eq("id", resultData.assignment_publication_class_id)
        .maybeSingle();

      if (pubClassError || !pubClassData) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      const { data: classTeacher } = await supabase
        .from("class_teachers")
        .select("id")
        .eq("class_id", pubClassData.class_id)
        .eq("platform_user_id", session.userId)
        .is("deleted_at", null)
        .eq("status", "active")
        .maybeSingle();

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Assignment result not found or you do not have access."),
        );
      }

      const now = new Date().toISOString();
      const { data: existingReview, error: reviewError } = await supabase
        .from("submission_reviews")
        .select("id, status, reviewed_by_teacher_id, created_at")
        .eq("assignment_result_id", assignmentResultId)
        .is("deleted_at", null)
        .maybeSingle();

      if (reviewError) {
        console.error("[teacher/assignment-results/review:save] Error fetching review:", reviewError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review."),
        );
      }

      if (existingReview?.status === "released") {
        return toResponse(
          errorResponse(ErrorCodes.CONFLICT, "Cannot modify a released review."),
        );
      }

      if (existingReview && existingReview.reviewed_by_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You can only update reviews you created."),
        );
      }

      let reviewId = existingReview?.id as string | undefined;
      let createdAt = existingReview?.created_at as string | undefined;

      if (!reviewId) {
        const { data: createdReview, error: createError } = await supabase
          .from("submission_reviews")
          .insert({
            assignment_result_id: assignmentResultId,
            reviewed_by_teacher_id: session.userId,
            status: "draft",
            updated_at: now,
          })
          .select("id, created_at")
          .single();

        if (createError || !createdReview) {
          console.error("[teacher/assignment-results/review:save] Error creating review:", createError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create review."),
          );
        }

        reviewId = createdReview.id;
        createdAt = createdReview.created_at;
      } else {
        const { error: updateReviewError } = await supabase
          .from("submission_reviews")
          .update({
            updated_at: now,
            reviewed_by_teacher_id: session.userId,
          })
          .eq("id", reviewId);

        if (updateReviewError) {
          console.error("[teacher/assignment-results/review:save] Error updating review:", updateReviewError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update review."),
          );
        }
      }

      const { data: existingPrimaryComment, error: commentLookupError } = await supabase
        .from("review_comments")
        .select("id")
        .eq("submission_review_id", reviewId)
        .eq("author_type", "teacher")
        .is("parent_comment_id", null)
        .eq("is_internal", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (commentLookupError) {
        console.error("[teacher/assignment-results/review:save] Error fetching primary comment:", commentLookupError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch review comment."),
        );
      }

      if (comment.length > 0) {
        if (existingPrimaryComment) {
          const { error: updateCommentError } = await supabase
            .from("review_comments")
            .update({ body: comment, updated_at: now })
            .eq("id", existingPrimaryComment.id);

          if (updateCommentError) {
            console.error("[teacher/assignment-results/review:save] Error updating comment:", updateCommentError);
            return toResponse(
              errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update review comment."),
            );
          }
        } else {
          const { error: createCommentError } = await supabase
            .from("review_comments")
            .insert({
              submission_review_id: reviewId,
              author_type: "teacher",
              author_platform_user_id: session.userId,
              body: comment,
              is_internal: false,
            });

          if (createCommentError) {
            console.error("[teacher/assignment-results/review:save] Error creating comment:", createCommentError);
            return toResponse(
              errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create review comment."),
            );
          }
        }
      } else if (existingPrimaryComment) {
        const { error: deleteCommentError } = await supabase
          .from("review_comments")
          .update({ deleted_at: now, updated_at: now })
          .eq("id", existingPrimaryComment.id);

        if (deleteCommentError) {
          console.error("[teacher/assignment-results/review:save] Error deleting comment:", deleteCommentError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to clear review comment."),
          );
        }
      }

      return toResponse(
        successResponse({
          reviewId,
          assignmentResultId,
          status: "draft",
          comment,
          releasedAt: null,
          createdAt: createdAt ?? now,
          updatedAt: now,
        }),
      );
    } catch (err) {
      console.error("[teacher/assignment-results/review:save] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to save review."),
      );
    }
  },
  { requiredRole: "teacher" },
);

function summarizeDerivedAssetRows(rows: Array<Record<string, unknown>>) {
  const currentRows = rows.filter((row) => row.is_current === true && row.deleted_at == null);
  const statuses = currentRows
    .map((row) => row.derivation_status)
    .filter((status): status is "pending" | "processing" | "ready" | "failed" => typeof status === "string");

  const status = statuses.includes("failed")
    ? "failed"
    : statuses.includes("processing")
      ? "processing"
      : statuses.includes("pending")
        ? "pending"
        : "ready";

  return {
    status,
    totalAssetCount: currentRows.length,
    readyAssetCount: currentRows.filter((row) => row.derivation_status === "ready").length,
    failedAssetCount: currentRows.filter((row) => row.derivation_status === "failed").length,
  };
}
