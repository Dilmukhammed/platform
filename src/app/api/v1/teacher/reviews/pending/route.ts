/**
 * GET /api/v1/teacher/reviews/pending — List pending reviews for teacher.
 *
 * Returns assignment results with status=submitted that are in classes
 * where the teacher is assigned. These are submissions awaiting review.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, paginatedResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/api/pagination";
import { createServerClient } from "@/lib/supabase/server-client";

// GET — List pending reviews
export const GET = withAuth(
  async (request, _context, { session }) => {
    try {
      const { searchParams } = new URL(request.url);
      const pagination = parsePaginationParams(searchParams);
      const classIdFilter = searchParams.get("classId"); // optional filter by class

      const supabase = createServerClient();

      // First, get all classes where this teacher is assigned
      const { data: teacherClasses, error: classesError } = await supabase
        .from("class_teachers")
        .select("class_id")
        .eq("platform_user_id", session.userId)
        .eq("status", "active")
        .is("deleted_at", null);

      if (classesError) {
        console.error("[teacher/reviews/pending] Error fetching teacher classes:", classesError);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch pending reviews."),
        );
      }

      if (!teacherClasses || teacherClasses.length === 0) {
        // Teacher has no classes, return empty result
        return toResponse(
          paginatedResponse([], buildPaginationMeta(pagination.page, pagination.pageSize, 0))
        );
      }

      const classIds = teacherClasses.map((tc) => tc.class_id);

      // Build query for pending reviews (submitted assignment results)
      // Join through: assignment_results → class_enrollments → classes
      // and assignment_results → assignment_publication_classes → assignment_publications → assignment_templates
      let query = supabase
        .from("assignment_results")
        .select(
          `
          *,
          class_enrollments!inner(
            id,
            student_profile_id,
            student_profiles!left(id, display_name, student_login)
          ),
          assignment_publication_classes!inner(
            id,
            class_id,
            classes!left(id, title),
            assignment_publications!inner(
              id,
              assignment_template_id,
              assignment_templates!left(id, title, linked_test_id)
            )
          ),
          submission_reviews!left(id, status, reviewed_by_teacher_id, created_at)
        `,
          { count: "exact" }
        )
        .eq("status", "submitted")
        .in("assignment_publication_classes.class_id", classIds)
        .is("deleted_at", null);

      // Apply class filter if provided
      if (classIdFilter) {
        // Verify teacher has access to this class
        if (!classIds.includes(classIdFilter)) {
          return toResponse(
            errorResponse(ErrorCodes.FORBIDDEN, "You do not have access to this class."),
          );
        }
        query = query.eq("assignment_publication_classes.class_id", classIdFilter);
      }

      const { data: results, error, count } = await query
        .order("test_submitted_at", { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

      if (error) {
        console.error("[teacher/reviews/pending] Supabase error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch pending reviews."),
        );
      }

      // Transform to response format
      const transformed = (results ?? []).map((result: Record<string, unknown>) => {
        const enrollment = result.class_enrollments as Record<string, unknown>;
        const studentProfile = enrollment?.student_profiles as Record<string, unknown>;
        const pubClass = result.assignment_publication_classes as Record<string, unknown>;
        const classData = pubClass?.classes as Record<string, unknown>;
        const publication = pubClass?.assignment_publications as Record<string, unknown>;
        const template = publication?.assignment_templates as Record<string, unknown>;
        const review = result.submission_reviews as Record<string, unknown> | undefined;

        return {
          assignmentResultId: result.id,
          status: result.status,
          practiceSubmittedAt: result.practice_submitted_at,
          testSubmittedAt: result.test_submitted_at,
          hasLinkedTest: !!template?.linked_test_id,
          student: {
            studentProfileId: studentProfile?.id,
            displayName: studentProfile?.display_name,
            studentLogin: studentProfile?.student_login,
          },
          class: {
            classId: classData?.id,
            title: classData?.title,
          },
          assignment: {
            publicationId: publication?.id,
            templateId: template?.id,
            title: template?.title,
          },
          review: review ? {
            reviewId: review.id,
            status: review.status,
            reviewedByTeacherId: review.reviewed_by_teacher_id,
            createdAt: review.created_at,
          } : null,
          isPending: !review || review.status === "draft",
        };
      });

      const total = count ?? 0;
      const paginationMeta = buildPaginationMeta(pagination.page, pagination.pageSize, total);

      return toResponse(paginatedResponse(transformed, paginationMeta));
    } catch (err) {
      console.error("[teacher/reviews/pending] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch pending reviews."),
      );
    }
  },
  { requiredRole: "teacher" },
);
