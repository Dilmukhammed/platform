import type { TeacherMaterialSummary } from "@/modules/teachers/server-data";
import { t } from "@/lib/translations";

/**
 * Maps reviewState + material status to StatusChip status type and label.
 * Shared between the materials list page and MaterialCard component.
 */
export function getStatusChipProps(
  material: TeacherMaterialSummary,
): { status: "success" | "warning" | "error" | "info"; label: string } {
  switch (material.reviewState) {
    case "approved":
      return { status: "success", label: t.teacher.materials.detail.statusLabels.approved };
    case "rejected":
      return { status: "error", label: t.teacher.materials.detail.statusLabels.rejected };
    case "pending":
      return { status: "warning", label: t.teacher.materials.detail.statusLabels.pendingReview };
    case "none":
    default:
      break;
  }
  switch (material.status) {
    case "draft":
      return { status: "info", label: t.teacher.materials.detail.statusLabels.draft };
    case "active":
      return { status: "success", label: t.teacher.materials.detail.statusLabels.active };
    case "archived":
      return { status: "info", label: t.teacher.materials.detail.statusLabels.archived };
    default:
      return { status: "info", label: material.status };
  }
}
