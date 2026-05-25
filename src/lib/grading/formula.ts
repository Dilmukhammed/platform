import type { GradingFormula } from "@/modules/grades/types";

export const DEFAULT_FORMULA: GradingFormula = {
  practiceWeight: 0.6,
  testWeight: 0.4,
};

export function computeFinalScore(
  practiceScore: number | null,
  testScore: number | null,
  formula: GradingFormula
): number {
  if (practiceScore !== null && testScore !== null) {
    const raw = practiceScore * formula.practiceWeight + testScore * formula.testWeight;
    return Math.round(raw * 10) / 10;
  }

  if (practiceScore !== null) {
    return Math.round(practiceScore * 10) / 10;
  }

  if (testScore !== null) {
    return Math.round(testScore * 10) / 10;
  }

  return 0;
}

export function mapToLetterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
