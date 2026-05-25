/**
 * GET /api/v1/teacher/publications/[publicationId]/gradebook — Get gradebook for a publication.
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

// GET — Get publication gradebook
export const GET = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const publicationId = params?.publicationId as string;

      if (!publicationId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Publication ID is required."),
        );
      }

      const supabase = createServerClient();

      const { data: publication, error: pubError } = await supabase
        .from("assignment_publications")
        .select("id, assignment_template_id, published_by_teacher_id")
        .eq("id", publicationId)
        .is("deleted_at", null)
        .single();

      if (pubError || !publication) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Publication not found."),
        );
      }

      const { data: pubClasses, error: classesError } = await supabase
        .from("assignment_publication_classes")
        .select("id, class_id")
        .eq("assignment_publication_id", publicationId)
        .is("deleted_at", null);

      if (classesError) {
        console.error("[teacher/publications/gradebook] Error fetching classes:", classesError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch publication classes."),
        );
      }

      const allPublicationClasses = pubClasses ?? [];
      const allClassIds = allPublicationClasses.map((pc) => pc.class_id as string);
      const isPublisher = publication.published_by_teacher_id === session.userId;

      let accessibleClassIds = allClassIds;
      if (!isPublisher && allClassIds.length > 0) {
        const { data: classTeachers, error: accessError } = await supabase
          .from("class_teachers")
          .select("class_id")
          .eq("platform_user_id", session.userId)
          .eq("status", "active")
          .is("deleted_at", null)
          .in("class_id", allClassIds);

        if (accessError) {
          console.error("[teacher/publications/gradebook] Error verifying class access:", accessError);
          return toResponse(
            errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to verify publication access."),
          );
        }

        accessibleClassIds = (classTeachers ?? []).map((row) => row.class_id as string);
      }

      if (!isPublisher && accessibleClassIds.length === 0) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Publication not found."),
        );
      }

      const visiblePublicationClasses = allPublicationClasses.filter((pc) =>
        accessibleClassIds.includes(pc.class_id as string),
      );
      const publicationClassIds = visiblePublicationClasses.map((pc) => pc.id as string);
      const classIds = visiblePublicationClasses.map((pc) => pc.class_id as string);

      if (publicationClassIds.length === 0) {
        return toResponse(
          successResponse({
            grades: [],
            totalStudents: 0,
            gradedCount: 0,
            averageScore: null,
            overrideCount: 0,
            scoreDistribution: {
              excellent: 0,
              good: 0,
              average: 0,
              belowAverage: 0,
            },
          })
        );
      }

      // Get class enrollments for these classes
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("class_enrollments")
        .select(
          `
          id,
          class_id,
          student_profile_id,
          student_profiles!inner(id, display_name, student_login)
        `
        )
        .in("class_id", classIds)
        .eq("status", "active")
        .is("deleted_at", null);

      if (enrollmentsError) {
        console.error("[teacher/publications/gradebook] Error fetching enrollments:", enrollmentsError);
      }

      // Get assignment results for these publication classes and enrollments
      const enrollmentIds = (enrollments ?? []).map((e) => e.id);
      let results: Array<Record<string, unknown>> = [];

      if (enrollmentIds.length > 0 && publicationClassIds.length > 0) {
        const { data: resultsData, error: resultsError } = await supabase
          .from("assignment_results")
          .select(
            `
            id,
            assignment_publication_class_id,
            class_enrollment_id,
            practice_submitted_at,
            test_submitted_at,
            grade_records!left(
              id,
              mapped_grade,
              practice_score_raw,
              test_score_raw,
              final_score_raw,
              override_reason,
              formula_snapshot_json
            )
          `
          )
          .in("assignment_publication_class_id", publicationClassIds)
          .in("class_enrollment_id", enrollmentIds)
          .is("deleted_at", null);

        if (resultsError) {
          console.error("[teacher/publications/gradebook] Error fetching results:", resultsError);
        }

        results = resultsData ?? [];
      }

      // Transform grades
      const grades = (results ?? []).map((r) => {
        const gradeRecord = getJoinedRecord<Record<string, unknown>>(r.grade_records);
        const enrollment = (enrollments ?? []).find(
          (e) => e.id === r.class_enrollment_id
        );
        const studentProfile = enrollment?.student_profiles as unknown as Record<string, unknown> | null;

        return {
          id: r.id,
          resultId: r.id,
          studentId: studentProfile?.student_login || r.class_enrollment_id,
          studentDisplayName: studentProfile?.display_name,
          practiceScoreRaw: gradeRecord?.practice_score_raw ?? null,
          testScoreRaw: gradeRecord?.test_score_raw ?? null,
          finalScoreRaw: gradeRecord?.final_score_raw ?? null,
          mappedGrade: gradeRecord?.mapped_grade ?? null,
          overrideReason: gradeRecord?.override_reason ?? null,
          formulaSnapshot: gradeRecord?.formula_snapshot_json,
        };
      });

      // Calculate stats
      const totalStudents = enrollmentIds.length;
      const gradedCount = grades.filter((g) => g.mappedGrade !== null).length;
      const overrideCount = grades.filter((g) => g.overrideReason !== null).length;
      const gradedScores = grades.filter((g) => g.finalScoreRaw !== null).map((g) => g.finalScoreRaw as number);
      const averageScore = gradedScores.length > 0
        ? Math.round(gradedScores.reduce((sum, s) => sum + s, 0) / gradedScores.length)
        : null;

      const scoreDistribution = {
        excellent: gradedScores.filter((s) => s >= 90).length,
        good: gradedScores.filter((s) => s >= 70 && s < 90).length,
        average: gradedScores.filter((s) => s >= 50 && s < 70).length,
        belowAverage: gradedScores.filter((s) => s < 50).length,
      };

      return toResponse(
        successResponse({
          grades,
          totalStudents,
          gradedCount,
          averageScore,
          overrideCount,
          scoreDistribution,
        })
      );
    } catch (err) {
      console.error("[teacher/publications/gradebook] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch gradebook."),
      );
    }
  },
  { requiredRole: "teacher" },
);
