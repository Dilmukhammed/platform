if (process.env.NODE_ENV === "production") {
  throw new Error("grades/service.ts is a legacy in-memory module — use grades/actions.ts instead");
}

import { getGradesState } from "./store";
import type { GradeRecord, GradingFormula } from "./types";
import { computeFinalScore, mapToLetterGrade, DEFAULT_FORMULA } from "@/lib/grading/formula";

function generateId() {
  return `grade-${crypto.randomUUID()}`;
}

export const gradesService = {
  getAllGrades(): GradeRecord[] {
    return getGradesState().grades;
  },

  getGradeByResultId(resultId: string): GradeRecord | undefined {
    return getGradesState().grades.find((g) => g.resultId === resultId);
  },

  getGradesByStudentId(studentId: string): GradeRecord[] {
    return getGradesState().grades.filter((g) => g.studentId === studentId);
  },

  getGradebookByPublicationId(publicationId: string): GradeRecord[] {
    return getGradesState().grades.filter((g) => g.publicationId === publicationId);
  },

  computeAndSaveGrade(
    resultId: string,
    publicationId: string,
    studentId: string,
    practiceScoreRaw: number | null,
    testScoreRaw: number | null,
    formula?: GradingFormula
  ): GradeRecord {
    const state = getGradesState();
    const usedFormula = formula ?? DEFAULT_FORMULA;
    const finalScoreRaw = computeFinalScore(practiceScoreRaw, testScoreRaw, usedFormula);
    const mappedGrade = mapToLetterGrade(finalScoreRaw);
    const now = new Date().toISOString();

    const existing = state.grades.find((g) => g.resultId === resultId);

    if (existing) {
      const updated: GradeRecord = {
        ...existing,
        publicationId,
        studentId,
        practiceScoreRaw,
        testScoreRaw,
        finalScoreRaw,
        mappedGrade,
        formulaSnapshot: { ...usedFormula },
        updatedAt: now,
      };

      state.grades = state.grades.map((g) => (g.id === existing.id ? updated : g));
      return updated;
    }

    const newGrade: GradeRecord = {
      id: generateId(),
      resultId,
      publicationId,
      studentId,
      practiceScoreRaw,
      testScoreRaw,
      finalScoreRaw,
      mappedGrade,
      formulaSnapshot: { ...usedFormula },
      overrideReason: null,
      overriddenBy: null,
      overriddenAt: null,
      createdAt: now,
      updatedAt: now,
    };

    state.grades.push(newGrade);
    return newGrade;
  },

  overrideGrade(
    resultId: string,
    teacherId: string,
    newFinalScore: number,
    reason: string
  ): GradeRecord {
    const state = getGradesState();
    const existing = state.grades.find((g) => g.resultId === resultId);

    if (!existing) {
      throw new Error(`Grade record not found for resultId: ${resultId}`);
    }

    const now = new Date().toISOString();
    const roundedScore = Math.round(newFinalScore * 10) / 10;

    const updated: GradeRecord = {
      ...existing,
      finalScoreRaw: roundedScore,
      mappedGrade: mapToLetterGrade(roundedScore),
      overrideReason: reason,
      overriddenBy: teacherId,
      overriddenAt: now,
      updatedAt: now,
    };

    state.grades = state.grades.map((g) => (g.id === existing.id ? updated : g));
    return updated;
  },
};
