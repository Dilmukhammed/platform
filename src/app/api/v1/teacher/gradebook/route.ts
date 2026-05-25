/**
 * GET /api/v1/teacher/gradebook — Get gradebook data.
 *
 * Returns students × assignments matrix for classes the teacher has access to.
 * Supports optional ?classId= query parameter to filter by specific class.
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

// GET — Get gradebook data
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const classIdFilter = searchParams.get("classId"); // optional filter by class

      const supabase = createServerClient();

      // First, get all classes where this teacher is assigned
      const { data: teacherClasses, error: classesError } = await supabase
        .from("class_teachers")
        .select(
          `
          class_id,
          role,
          classes!inner(id, title, organization_id, status)
        `
        )
        .eq("platform_user_id", session.userId)
        .eq("status", "active")
        .is("deleted_at", null);

      if (classesError) {
        console.error("[teacher/gradebook] Error fetching teacher classes:", classesError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch teacher classes."),
        );
      }

      if (!teacherClasses || teacherClasses.length === 0) {
        // Teacher has no classes, return empty gradebook
        return toResponse(
          successResponse({
            classes: [],
            students: [],
            assignments: [],
            grades: [],
          })
        );
      }

      const accessibleClassIds = teacherClasses.map((tc) => tc.class_id);

      // If classId filter provided, verify teacher has access
      if (classIdFilter) {
        if (!accessibleClassIds.includes(classIdFilter)) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
          );
        }
      }

      // Get class enrollments with student profiles for accessible classes
      const targetClassIds = classIdFilter ? [classIdFilter] : accessibleClassIds;

      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("class_enrollments")
        .select(
          `
          id,
          class_id,
          student_profile_id,
          status,
          student_profiles!inner(id, display_name, student_login)
        `
        )
        .in("class_id", targetClassIds)
        .eq("status", "active")
        .is("deleted_at", null);

      if (enrollmentsError) {
        console.error("[teacher/gradebook] Error fetching enrollments:", enrollmentsError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch student enrollments."),
        );
      }

      // Get assignment publications for these classes
      const { data: publicationClasses, error: pubClassesError } = await supabase
        .from("assignment_publication_classes")
        .select(
          `
          id,
          class_id,
          assignment_publication_id,
          deadline_override,
          assignment_publications!inner(
            id,
            assignment_template_id,
            published_by_teacher_id,
            default_deadline,
            status,
            assignment_templates!left(id, title)
          )
        `
        )
        .in("class_id", targetClassIds)
        .eq("status", "published")
        .is("deleted_at", null);

      if (pubClassesError) {
        console.error("[teacher/gradebook] Error fetching publication classes:", pubClassesError);
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
            practice_submitted_at,
            test_submitted_at,
            released_at,
            grade_records!left(
              id,
              mapped_grade,
              practice_score_raw,
              test_score_raw,
              final_score_raw,
              is_overridden,
              override_reason,
              formula_snapshot_json
            ),
            submission_reviews!left(
              id,
              status,
              released_at
            )
          `
          )
          .in("class_enrollment_id", enrollmentIds)
          .in("assignment_publication_class_id", publicationClassIds)
          .is("deleted_at", null);

        if (resultsError) {
          console.error("[teacher/gradebook] Error fetching results:", resultsError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch assignment results."),
          );
        }

        results = resultsData ?? [];
      }

      // Transform to response format
      const classesData = (teacherClasses ?? []).map((tc) => {
        const classData = tc.classes as unknown as Record<string, unknown> | null;
        return {
          classId: classData?.id,
          title: classData?.title,
          organizationId: classData?.organization_id,
          status: classData?.status,
          teacherRole: tc.role,
        };
      }).filter((c) => targetClassIds.includes(c.classId as string));

      const studentsData = (enrollments ?? []).map((e) => {
        const studentProfile = e.student_profiles as unknown as Record<string, unknown> | null;
        return {
          enrollmentId: e.id,
          classId: e.class_id,
          studentProfileId: studentProfile?.id,
          displayName: studentProfile?.display_name,
          studentLogin: studentProfile?.student_login,
          enrollmentStatus: e.status,
        };
      });

      const assignmentsData = (publicationClasses ?? []).map((pc) => {
        const publication = pc.assignment_publications as unknown as Record<string, unknown> | null;
        const template = publication?.assignment_templates as unknown as Record<string, unknown> | null;
        return {
          publicationClassId: pc.id,
          classId: pc.class_id,
          publicationId: publication?.id,
          templateId: template?.id,
          title: template?.title,
          defaultDeadline: publication?.default_deadline,
          deadlineOverride: pc.deadline_override,
          effectiveDeadline: pc.deadline_override ?? publication?.default_deadline,
          status: publication?.status,
        };
      });

      const gradesData = results.map((r) => {
        const gradeRecord = getJoinedRecord<Record<string, unknown>>(r.grade_records);
        const review = getJoinedRecord<Record<string, unknown>>(r.submission_reviews);

        return {
          resultId: r.id,
          publicationClassId: r.assignment_publication_class_id,
          enrollmentId: r.class_enrollment_id,
          status: r.status,
          practiceSubmittedAt: r.practice_submitted_at,
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
            formulaSnapshot: gradeRecord.formula_snapshot_json,
          } : null,
          review: review ? {
            reviewId: review.id,
            status: review.status,
            releasedAt: review.released_at,
          } : null,
        };
      });

      return toResponse(
        successResponse({
          classes: classesData,
          students: studentsData,
          assignments: assignmentsData,
          grades: gradesData,
        })
      );
    } catch (err) {
      console.error("[teacher/gradebook] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch gradebook data."),
      );
    }
  },
  { requiredRole: "teacher" },
);
