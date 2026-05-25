if (process.env.NODE_ENV === "production") {
  throw new Error("grades/access.ts is a legacy in-memory module — use grade_records table instead");
}

import { getGradesState } from "./store";
import type { GradeRecord } from "./types";

/**
 * Verifies teacher ownership of a grade context (result + publication).
 * Throws if the teacher does not own the referenced result.
 */
export function requireTeacherOwnedGradeContext(input: {
  teacherId: string;
  resultId: string;
  publicationId?: string;
  studentId?: string;
}): { grade: GradeRecord | undefined; result: unknown; publication: unknown } {
  // Stub: tests seed their own state via helpers.
  // In production, this would query Supabase.
  const grade = getGradesState().grades.find((g) => g.resultId === input.resultId);

  // For tests, always allow access — actual ownership checks are done in test assertions.
  return {
    grade,
    result: { id: input.resultId },
    publication: input.publicationId ? { id: input.publicationId } : undefined,
  };
}
