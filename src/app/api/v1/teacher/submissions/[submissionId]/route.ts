/**
 * GET /api/v1/teacher/submissions/[submissionId] — Get submission detail.
 * GET /api/v1/teacher/submissions/[submissionId]/assets — Get submission assets.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

function getSubmissionPageCount(submissionFiles: Array<Record<string, unknown>>) {
  const pagePreviewCount = submissionFiles.reduce((count, file) => {
    const derivedAssets = ((file.derived_assets as Array<Record<string, unknown>>) ?? [])
      .filter((asset) => asset.is_current === true && asset.deleted_at == null);

    return count + derivedAssets.filter((asset) => asset.kind === "pdf_page_preview").length;
  }, 0);

  return pagePreviewCount > 0 ? pagePreviewCount : null;
}

// GET — Get submission detail
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const submissionId = params?.submissionId as string;

      if (!submissionId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Submission ID is required."),
        );
      }

      const supabase = createServerClient();

      // Get submission with related data
      const { data: submission, error } = await supabase
        .from("assignment_results")
        .select(
          `
          id,
          assignment_publication_class_id,
          class_enrollment_id,
          status,
          practice_submitted_at,
          test_submitted_at,
          assignment_publication_classes!inner(
            id,
            class_id,
            assignment_publication_id,
            assignment_publications!inner(
              id,
              assignment_template_id,
              published_by_teacher_id,
              assignment_templates!inner(id, title)
            )
          ),
          class_enrollments!inner(
            id,
            student_profile_id,
            class_id,
            student_profiles!inner(id, display_name, student_login)
          ),
          submission_files!left(
            id,
            is_current,
            deleted_at,
            derived_assets!left(id, kind, is_current, deleted_at)
          )
        `
        )
        .eq("id", submissionId)
        .is("deleted_at", null)
        .single();

      if (error || !submission) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Submission not found."),
        );
      }

      // Verify the submission belongs to this teacher
      const publication = submission.assignment_publication_classes as unknown as Record<string, unknown> | null;
      const pubData = publication?.assignment_publications as unknown as Record<string, unknown> | null;
      
      if (pubData?.published_by_teacher_id !== session.userId) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this submission."),
        );
      }

      // Get class info
      const enrollment = submission.class_enrollments as unknown as Record<string, unknown> | null;
      const studentProfile = enrollment?.student_profiles as unknown as Record<string, unknown> | null;
      const template = pubData?.assignment_templates as unknown as Record<string, unknown> | null;
      const submissionFiles = ((submission.submission_files as Array<Record<string, unknown>>) ?? [])
        .filter((file) => file.is_current === true && file.deleted_at == null);

      const data = {
        id: submission.id,
        resultId: submission.id,
        publicationId: pubData?.id,
        templateId: template?.id,
        studentId: studentProfile?.id,
        classId: enrollment?.class_id,
        teacherId: pubData?.published_by_teacher_id,
        status: submission.status,
        practiceSubmittedAt: submission.practice_submitted_at,
        testSubmittedAt: submission.test_submitted_at,
        submittedAt: submission.test_submitted_at || submission.practice_submitted_at,
        pageCount: getSubmissionPageCount(submissionFiles),
        student: {
          displayName: studentProfile?.display_name,
          studentLogin: studentProfile?.student_login,
        },
        publication: {
          title: template?.title,
        },
      };

      return toResponse(successResponse(data));
    } catch (err) {
      console.error("[teacher/submissions/detail] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch submission."),
      );
    }
  },
  { requiredRole: "teacher" },
);
