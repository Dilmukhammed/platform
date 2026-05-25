export type GradingFormula = {
  practiceWeight: number; // 0.0–1.0
  testWeight: number; // 0.0–1.0
};

export type GradeRecord = {
  id: string;
  resultId: string;
  publicationId: string;
  studentId: string;
  practiceScoreRaw: number | null;
  testScoreRaw: number | null;
  finalScoreRaw: number;
  mappedGrade: string;
  formulaSnapshot: GradingFormula;
  overrideReason: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OverrideRecord = {
  resultId: string;
  teacherId: string;
  newFinalScore: number;
  reason: string;
};

export type GradesState = {
  grades: GradeRecord[];
};
