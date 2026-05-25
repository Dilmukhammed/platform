/**
 * GET /api/v1/teacher/submissions/[submissionId]/grade — Get grade for a submission.
 * POST /api/v1/teacher/submissions/[submissionId]/grade — Create or update grade.
 */

import { withAuth } from "@/lib/api/with-auth";
import { successResponse, errorResponse, toResponse } from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { createServerClient } from "@/lib/supabase/server-client";
import { mapToLetterGrade } from "@/lib/grading/formula";

async function hasTeacherSubmissionAccess(
  supabase: ReturnType<typeof createServerClient>,
  teacherId: string,
  submissionId: string,
) {
  const { data: submission, error: subError } = await supabase
    .from("assignment_results")
    .select(
      `
      id,
      assignment_publication_classes!inner(
        class_id,
        assignment_publications!inner(id, published_by_teacher_id)
      )
    `,
    )
    .eq("id", submissionId)
    .is("deleted_at", null)
    .single();

  if (subError || !submission) {
    return { allowed: false, publicationId: null as string | null };
  }

  const pubClass = submission.assignment_publication_classes as unknown as Record<string, unknown> | null;
  const publication = pubClass?.assignment_publications as unknown as Record<string, unknown> | null;
  const publicationId = (publication?.id as string | undefined) ?? null;

  if ((publication?.published_by_teacher_id as string | undefined) === teacherId) {
    return { allowed: true, publicationId };
  }

  const classId = pubClass?.class_id as string | undefined;
  if (!classId) {
    return { allowed: false, publicationId };
  }

  const { data: classTeacher } = await supabase
    .from("class_teachers")
    .select("id")
    .eq("class_id", classId)
    .eq("platform_user_id", teacherId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  return { allowed: Boolean(classTeacher), publicationId };
}

// GET — Get grade for submission
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

      const access = await hasTeacherSubmissionAccess(supabase, session.userId, submissionId);
      if (!access.allowed) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Submission not found."),
        );
      }

      // Get grade
      const { data: grade, error } = await supabase
        .from("grade_records")
        .select("id, mapped_grade, practice_score_raw, test_score_raw, final_score_raw, override_reason, formula_snapshot_json, created_at, updated_at")
        .eq("assignment_result_id", submissionId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        console.error("[teacher/grade] Error:", error);
        return toResponse(
          errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch grade."),
        );
      }

      if (!grade) {
        return toResponse(successResponse(null));
      }

      const data = {
        id: grade.id,
        gradeId: grade.id,
        resultId: submissionId,
        mappedGrade: grade.mapped_grade,
        practiceScoreRaw: grade.practice_score_raw,
        testScoreRaw: grade.test_score_raw,
        finalScoreRaw: grade.final_score_raw,
        overrideReason: grade.override_reason,
        formulaSnapshot: grade.formula_snapshot_json,
        createdAt: grade.created_at,
        updatedAt: grade.updated_at,
      };

      return toResponse(successResponse(data));
    } catch (err) {
      console.error("[teacher/grade] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch grade."),
      );
    }
  },
  { requiredRole: "teacher" },
);

// POST — Create or update grade
export const POST = withAuth(
  async (request, context, { session }) => {
    try {
      const params = await context.params;
      const submissionId = params?.submissionId as string;
      const body = await request.json();

      if (!submissionId) {
        return toResponse(
          errorResponse(ErrorCodes.VALIDATION_ERROR, "Submission ID is required."),
        );
      }

      const supabase = createServerClient();

      const access = await hasTeacherSubmissionAccess(supabase, session.userId, submissionId);
      if (!access.allowed) {
        return toResponse(
          errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, "Submission not found."),
        );
      }

      const now = new Date().toISOString();
      const finalScoreRaw = typeof body.finalScoreRaw === "number" ? body.finalScoreRaw : 0;
      const mappedGrade = typeof body.mappedGrade === "string" && body.mappedGrade.length > 0
        ? body.mappedGrade
        : mapToLetterGrade(finalScoreRaw);

      // Check if grade exists
      const { data: existingGrade } = await supabase
        .from("grade_records")
        .select("id")
        .eq("assignment_result_id", submissionId)
        .is("deleted_at", null)
        .maybeSingle();

      let grade;
      
      if (existingGrade) {
        // Update existing grade
        const { data: updated, error } = await supabase
          .from("grade_records")
          .update({
            mapped_grade: mappedGrade,
            practice_score_raw: body.practiceScoreRaw,
            test_score_raw: body.testScoreRaw,
            final_score_raw: finalScoreRaw,
            override_reason: body.overrideReason,
            is_overridden: Boolean(body.overrideReason),
            formula_snapshot_json: body.formulaSnapshot,
            updated_at: now,
          })
          .eq("id", existingGrade.id)
          .select()
          .single();
        
        if (error) throw error;
        grade = updated;
      } else {
        // Create new grade
        const { data: created, error } = await supabase
          .from("grade_records")
          .insert({
            assignment_result_id: submissionId,
            mapped_grade: mappedGrade,
            practice_score_raw: body.practiceScoreRaw,
            test_score_raw: body.testScoreRaw,
            final_score_raw: finalScoreRaw,
            override_reason: body.overrideReason,
            is_overridden: Boolean(body.overrideReason),
            formula_snapshot_json: body.formulaSnapshot,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();
        
        if (error) throw error;
        grade = created;
      }

      const data = {
        id: grade.id,
        gradeId: grade.id,
        resultId: submissionId,
        mappedGrade: grade.mapped_grade,
        practiceScoreRaw: grade.practice_score_raw,
        testScoreRaw: grade.test_score_raw,
        finalScoreRaw: grade.final_score_raw,
        overrideReason: grade.override_reason,
        formulaSnapshot: grade.formula_snapshot_json,
        createdAt: grade.created_at,
        updatedAt: grade.updated_at,
      };

      return toResponse(successResponse(data));
    } catch (err) {
      console.error("[teacher/grade] Unexpected error:", err);
      return toResponse(
        errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to save grade."),
      );
    }
  },
  { requiredRole: "teacher" },
);
