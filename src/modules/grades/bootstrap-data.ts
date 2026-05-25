import type { GradeRecord } from "./types";
import { DEFAULT_FORMULA } from "@/lib/grading/formula";

export const initialGradesData: GradeRecord[] = [
  {
    id: "grade-0001",
    resultId: "74000000-0000-4000-8000-000000000001",
    publicationId: "pub-seed-001",
    studentId: "student-seed-001",
    practiceScoreRaw: 85,
    testScoreRaw: 78,
    finalScoreRaw: 82.2,
    mappedGrade: "B",
    formulaSnapshot: { ...DEFAULT_FORMULA },
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-01-15T10:00:00.000Z",
  },
  {
    id: "grade-0002",
    resultId: "74000000-0000-4000-8000-000000000002",
    publicationId: "pub-seed-001",
    studentId: "student-seed-002",
    practiceScoreRaw: 92,
    testScoreRaw: 88,
    finalScoreRaw: 90.4,
    mappedGrade: "A",
    formulaSnapshot: { ...DEFAULT_FORMULA },
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
    createdAt: "2025-01-15T10:05:00.000Z",
    updatedAt: "2025-01-15T10:05:00.000Z",
  },
];
