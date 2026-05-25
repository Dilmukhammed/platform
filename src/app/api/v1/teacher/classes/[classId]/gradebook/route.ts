/**
 * GET /api/v1/teacher/classes/{classId}/gradebook — Get class-specific gradebook.
 *
 * Returns students × assignments matrix for a specific class.
 * Verifies the teacher has access to the class.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";

function getJoinedRecord<T extends Record<string, unknown>>(value: unknown): T | null {
  if (Array.isArray(value)) {
    return ((value[0] as T | undefined) ?? null);
  }
  return (value as T | null) ?? null;
}

// GET — Get class gradebook
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const classId = params.classId as string;

      const supabase = createServerClient();

      // Verify teacher has access to this class
      const { data: classTeacher, error: accessError } = await supabase
        .from("class_teachers")
        .select(
          `
          id,
          role,
          classes!inner(id, title, organization_id, status)
        `
        )
        .eq("class_id", classId)
        .eq("platform_user_id", session.userId)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

      if (accessError) {
        console.error("[teacher/classes/gradebook] Error verifying class access:", accessError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify class access."),
        );
      }

      if (!classTeacher) {
        return toResponse(
          errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
        );
      }

      const classData = classTeacher.classes as unknown as Record<string, unknown> | null;

      // Get class enrollments with student profiles
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("class_enrollments")
        .select(
          `
          id,
          student_profile_id,
          status,
          source,
          created_at,
          student_profiles!inner(id, display_name, student_login)
        `
        )
        .eq("class_id", classId)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (enrollmentsError) {
        console.error("[teacher/classes/gradebook] Error fetching enrollments:", enrollmentsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch student enrollments."),
        );
      }

      // Get assignment publications for this class
      const { data: publicationClasses, error: pubClassesError } = await supabase
        .from("assignment_publication_classes")
        .select(
          `
          id,
          assignment_publication_id,
          deadline_override,
          assignment_publications!inner(
            id,
            assignment_template_id,
            published_by_teacher_id,
            default_deadline,
            status,
            published_at,
            assignment_templates!left(id, title, description, has_practice, has_test)
          )
        `
        )
        .eq("class_id", classId)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("published_at", { ascending: false, referencedTable: "assignment_publications" });

      if (pubClassesError) {
        console.error("[teacher/classes/gradebook] Error fetching publication classes:", pubClassesError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment publications."),
        );
      }

      // Get assignment results for these enrollments and publications
      const enrollmentIds = (enrollments ?? []).map((e) => e.id);
      const publicationClassIds = (publicationClasses ?? []).map((pc) => pc.id);

      let results: Array<Record<string, unknown>> = [];

      if (enrollmentIds.length > 0 && publicationClassIds.length > 0) {
        const { data: resultsData, error: resultsError } = await supabase
          .from("assignment_results")
          .select(
            `
            id,
            assignment_publication_class_id,
            class_enrollment_id,
            status,
            practice_started_at,
            practice_submitted_at,
            test_started_at,
            test_submitted_at,
            released_at,
            created_at,
            grade_records!left(
              id,
              mapped_grade,
              practice_score_raw,
              test_score_raw,
              final_score_raw,
              is_overridden,
              override_reason
            ),
            submission_reviews!left(
              id,
              status,
              reviewed_by_teacher_id,
              released_at,
              created_at
            )
          `
          )
          .in("class_enrollment_id", enrollmentIds)
          .in("assignment_publication_class_id", publicationClassIds)
          .is("deleted_at", null);

        if (resultsError) {
          console.error("[teacher/classes/gradebook] Error fetching results:", resultsError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment results."),
          );
        }

        results = resultsData ?? [];
      }

      // Transform students data
      const studentsData = (enrollments ?? []).map((e) => {
        const studentProfile = e.student_profiles as unknown as Record<string, unknown> | null;
        return {
          enrollmentId: e.id,
          studentProfileId: studentProfile?.id,
          displayName: studentProfile?.display_name,
          studentLogin: studentProfile?.student_login,
          enrollmentStatus: e.status,
          enrollmentSource: e.source,
          enrolledAt: e.created_at,
        };
      });

      // Transform assignments data
      const assignmentsData = (publicationClasses ?? []).map((pc) => {
        const publication = pc.assignment_publications as unknown as Record<string, unknown> | null;
        const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
        return {
          publicationClassId: pc.id,
          publicationId: publication?.id,
          templateId: template?.id,
          title: template?.title,
          description: template?.description,
          hasPractice: template?.has_practice,
          hasTest: template?.has_test,
          defaultDeadline: publication?.default_deadline,
          deadlineOverride: pc.deadline_override,
          effectiveDeadline: pc.deadline_override ?? publication?.default_deadline,
          publishedAt: publication?.published_at,
          status: publication?.status,
        };
      });

      // Build the grades matrix
      const gradesMatrix = results.map((r) => {
        const gradeRecord = getJoinedRecord<Record<string, unknown>>(r.grade_records);
        const review = getJoinedRecord<Record<string, unknown>>(r.submission_reviews);

        return {
          resultId: r.id,
          publicationClassId: r.assignment_publication_class_id,
          enrollmentId: r.class_enrollment_id,
          status: r.status,
          practiceStartedAt: r.practice_started_at,
          practiceSubmittedAt: r.practice_submitted_at,
          testStartedAt: r.test_started_at,
          testSubmittedAt: r.test_submitted_at,
          releasedAt: r.released_at,
          grade: gradeRecord ? {
            gradeRecordId: gradeRecord.id,
            mappedGrade: gradeRecord.mapped_grade,
            practiceScoreRaw: gradeRecord.practice_score_raw,
            testScoreRaw: gradeRecord.test_score_raw,
            finalScoreRaw: gradeRecord.final_score_raw,
            isOverridden: gradeRecord.is_overridden,
            overrideReason: gradeRecord.override_reason,
          } : null,
          review: review ? {
            reviewId: review.id,
            status: review.status,
            reviewedByTeacherId: review.reviewed_by_teacher_id,
            releasedAt: review.released_at,
            createdAt: review.created_at,
          } : null,
        };
      });

      // Calculate summary statistics
      const totalStudents = studentsData.length;
      const totalAssignments = assignmentsData.length;

      const statusCounts = {
        notStarted: gradesMatrix.filter((g) => g.status === "not_started").length,
        inProgress: gradesMatrix.filter((g) => g.status === "in_progress").length,
        submitted: gradesMatrix.filter((g) => g.status === "submitted").length,
        released: gradesMatrix.filter((g) => g.status === "released").length,
      };

      return toResponse(
        successResponse({
          class: {
            classId: classData?.id,
            title: classData?.title,
            organizationId: classData?.organization_id,
            status: classData?.status,
            teacherRole: classTeacher.role,
          },
          summary: {
            totalStudents,
            totalAssignments,
            statusCounts,
          },
          students: studentsData,
          assignments: assignmentsData,
          grades: gradesMatrix,
        })
      );
    } catch (err) {
      console.error("[teacher/classes/gradebook] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch gradebook data."),
      );
    }
  },
  { requiredRole: "teacher" },
);
