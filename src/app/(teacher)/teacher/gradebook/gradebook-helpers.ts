/**
 * Shared gradebook helper functions.
 * Used by both the main gradebook and publication-specific gradebook pages.
 */

import { t } from "@/lib/translations";

// Get grade badge variant based on score
export function getGradeBadgeVariant(score: number | null): "default" | "primary" | "success" | "warning" | "error" {
  if (score === null) return "default";
  if (score >= 90) return "success";
  if (score >= 70) return "primary";
  if (score >= 50) return "warning";
  return "error";
}

// Get status chip for grade state
export function getGradeStatusChip(grade: {
  practiceScoreRaw: number | null;
  testScoreRaw: number | null;
  overrideReason: string | null;
}): { status: "info" | "warning" | "success" | "error"; label: string } {
  if (grade.overrideReason) {
    return { status: "warning", label: t.teacher.gradebook.table.overridden };
  }
  if (grade.practiceScoreRaw !== null && grade.testScoreRaw !== null) {
    return { status: "success", label: t.teacher.gradebook.stats.graded };
  }
  if (grade.practiceScoreRaw !== null || grade.testScoreRaw !== null) {
    return { status: "warning", label: "Qisman" };
  }
  return { status: "info", label: t.teacher.gradebook.stats.pending };
}
