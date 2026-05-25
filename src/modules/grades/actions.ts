"use server";

import { revalidatePath } from "next/cache";

import { requireAreaAccess } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server-client";
import { computeFinalScore, mapToLetterGrade, DEFAULT_FORMULA } from "@/lib/grading/formula";
import { t } from "@/lib/translations";
import type { GradingFormula } from "./types";

type GradeActionContext = {
  publicationId: string;
  studentId: string;
  isAuthorized: boolean;
};

async function getGradeActionContext(
  teacherId: string,
  resultId: string,
): Promise<GradeActionContext> {
  const supabase = createServerClient();
  const { data: result, error } = await supabase
    .from("assignment_results")
    .select(
      `
      id,
      class_enrollment_id,
      class_enrollments!inner(student_profile_id),
      assignment_publication_classes!inner(
        class_id,
        assignment_publications!inner(id, published_by_teacher_id)
      )
    `,
    )
    .eq("id", resultId)
    .is("deleted_at", null)
    .single();

  if (error || !result) {
    throw new Error(t.api.gradeActions.gradeContextNotFound);
  }

  const enrollment = result.class_enrollments as unknown as Record<string, unknown> | null;
  const publicationClass = result.assignment_publication_classes as unknown as Record<string, unknown> | null;
  const publication = publicationClass?.assignment_publications as unknown as Record<string, unknown> | null;
  const classId = publicationClass?.class_id as string | undefined;

  let isClassTeacher = false;
  if (classId) {
    const { data: classTeacher } = await supabase
      .from("class_teachers")
      .select("id")
      .eq("class_id", classId)
      .eq("platform_user_id", teacherId)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle();

    isClassTeacher = Boolean(classTeacher);
  }

  return {
    publicationId: (publication?.id as string | undefined) ?? "",
    studentId: (enrollment?.student_profile_id as string | undefined) ?? "",
    isAuthorized:
      (publication?.published_by_teacher_id as string | undefined) === teacherId ||
      isClassTeacher,
  };
}

export async function computeAndSaveGradeAction(
  resultId: string,
  publicationId: string,
  studentId: string,
  practiceScoreRaw: number | null,
  testScoreRaw: number | null,
  formula?: GradingFormula
) {
  const session = await requireAreaAccess("teacher");
  const context = await getGradeActionContext(session.userId, resultId);
  if (!context.isAuthorized || context.publicationId !== publicationId || context.studentId !== studentId) {
    throw new Error(t.api.gradeActions.gradeRecordNotFoundForTeacher);
  }

  const supabase = createServerClient();
  const usedFormula = formula ?? DEFAULT_FORMULA;
  const finalScoreRaw = computeFinalScore(practiceScoreRaw, testScoreRaw, usedFormula);
  const mappedGrade = mapToLetterGrade(finalScoreRaw);
  const now = new Date().toISOString();

  const { data: existingGrade } = await supabase
    .from("grade_records")
    .select("id, override_reason, created_at")
    .eq("assignment_result_id", resultId)
    .is("deleted_at", null)
    .maybeSingle();

  let persistedGrade: Record<string, unknown> | null = null;

  if (existingGrade) {
    const { data, error } = await supabase
      .from("grade_records")
      .update({
        mapped_grade: mappedGrade,
        practice_score_raw: practiceScoreRaw,
        test_score_raw: testScoreRaw,
        final_score_raw: finalScoreRaw,
        formula_snapshot_json: usedFormula,
        updated_at: now,
      })
      .eq("id", existingGrade.id)
      .select("id, practice_score_raw, test_score_raw, final_score_raw, mapped_grade, override_reason, formula_snapshot_json, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    persistedGrade = data as unknown as Record<string, unknown>;
  } else {
    const { data, error } = await supabase
      .from("grade_records")
      .insert({
        assignment_result_id: resultId,
        mapped_grade: mappedGrade,
        practice_score_raw: practiceScoreRaw,
        test_score_raw: testScoreRaw,
        final_score_raw: finalScoreRaw,
        formula_snapshot_json: usedFormula,
        is_overridden: false,
        created_at: now,
        updated_at: now,
      })
      .select("id, practice_score_raw, test_score_raw, final_score_raw, mapped_grade, override_reason, formula_snapshot_json, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    persistedGrade = data as unknown as Record<string, unknown>;
  }

  revalidatePath(`/teacher/publications/${publicationId}/gradebook`);
  revalidatePath(`/teacher/publications/${publicationId}`);
  revalidatePath("/teacher/gradebook");
  revalidatePath(`/teacher/reviews/${resultId}`);

  return {
    id: persistedGrade.id as string,
    resultId,
    publicationId,
    studentId,
    practiceScoreRaw: (persistedGrade.practice_score_raw as number | null | undefined) ?? null,
    testScoreRaw: (persistedGrade.test_score_raw as number | null | undefined) ?? null,
    finalScoreRaw: (persistedGrade.final_score_raw as number | null | undefined) ?? 0,
    mappedGrade: (persistedGrade.mapped_grade as string | undefined) ?? "F",
    formulaSnapshot: ((persistedGrade.formula_snapshot_json as GradingFormula | null | undefined) ?? usedFormula),
    overrideReason: (persistedGrade.override_reason as string | null | undefined) ?? null,
    overriddenBy: null,
    overriddenAt: null,
    createdAt: (persistedGrade.created_at as string | undefined) ?? now,
    updatedAt: (persistedGrade.updated_at as string | undefined) ?? now,
  };
}

export async function overrideGradeAction(
  resultId: string,
  _teacherId: string,
  newFinalScore: number,
  reason: string
) {
  const session = await requireAreaAccess("teacher");
  const context = await getGradeActionContext(session.userId, resultId);
  if (!context.isAuthorized) {
    throw new Error(t.api.gradeActions.gradeRecordNotFoundForTeacher);
  }

  const supabase = createServerClient();
  const now = new Date().toISOString();
  const roundedScore = Math.round(newFinalScore * 10) / 10;
  const mappedGrade = mapToLetterGrade(roundedScore);

  const { data: existingGrade } = await supabase
    .from("grade_records")
    .select("id, practice_score_raw, test_score_raw, formula_snapshot_json, created_at")
    .eq("assignment_result_id", resultId)
    .is("deleted_at", null)
    .maybeSingle();

  let persistedGrade: Record<string, unknown> | null = null;

  if (existingGrade) {
    const { data, error } = await supabase
      .from("grade_records")
      .update({
        final_score_raw: roundedScore,
        mapped_grade: mappedGrade,
        override_reason: reason,
        is_overridden: true,
        updated_at: now,
      })
      .eq("id", existingGrade.id)
      .select("id, practice_score_raw, test_score_raw, final_score_raw, mapped_grade, override_reason, formula_snapshot_json, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    persistedGrade = data as unknown as Record<string, unknown>;
  } else {
    const { data, error } = await supabase
      .from("grade_records")
      .insert({
        assignment_result_id: resultId,
        mapped_grade: mappedGrade,
        practice_score_raw: null,
        test_score_raw: null,
        final_score_raw: roundedScore,
        override_reason: reason,
        formula_snapshot_json: DEFAULT_FORMULA,
        is_overridden: true,
        created_at: now,
        updated_at: now,
      })
      .select("id, practice_score_raw, test_score_raw, final_score_raw, mapped_grade, override_reason, formula_snapshot_json, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    persistedGrade = data as unknown as Record<string, unknown>;
  }

  revalidatePath(`/teacher/publications/${context.publicationId}/gradebook`);
  revalidatePath(`/teacher/publications/${context.publicationId}`);
  revalidatePath("/teacher/gradebook");
  revalidatePath(`/teacher/reviews/${resultId}`);

  return {
    id: persistedGrade.id as string,
    resultId,
    publicationId: context.publicationId,
    studentId: context.studentId,
    practiceScoreRaw: (persistedGrade.practice_score_raw as number | null | undefined) ?? null,
    testScoreRaw: (persistedGrade.test_score_raw as number | null | undefined) ?? null,
    finalScoreRaw: (persistedGrade.final_score_raw as number | null | undefined) ?? roundedScore,
    mappedGrade: (persistedGrade.mapped_grade as string | undefined) ?? mappedGrade,
    formulaSnapshot: ((persistedGrade.formula_snapshot_json as GradingFormula | null | undefined) ?? DEFAULT_FORMULA),
    overrideReason: (persistedGrade.override_reason as string | null | undefined) ?? reason,
    overriddenBy: session.userId,
    overriddenAt: now,
    createdAt: (persistedGrade.created_at as string | undefined) ?? now,
    updatedAt: (persistedGrade.updated_at as string | undefined) ?? now,
  };
}
