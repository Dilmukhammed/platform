import { beforeEach, describe, expect, test } from "bun:test";

import { resetOrganizationsState } from "./helpers/organizations-stub";
import {
  approveSchoolMaterial,
  createPersonalMaterial,
  listPendingSchoolMaterialApprovals,
  listTeacherMaterials,
  listTeacherSchoolLibraryMaterials,
  rejectSchoolMaterial,
  resetMaterialsState,
  submitMaterialToSchool,
} from "./helpers/materials-stub";

const teacherId = "20000000-0000-4000-8000-000000000002";
const adminId = "20000000-0000-4000-8000-000000000001";

describe("material library approval flow", () => {
  beforeEach(() => {
    resetOrganizationsState();
    resetMaterialsState();
  });

  test("submit plus approve makes a material visible in the school library", () => {
    const material = createPersonalMaterial({
      teacherId,
      title: "Section view reference pack",
      description: "Teacher-owned reference set for projection exercises.",
    });

    submitMaterialToSchool({ teacherId, materialId: material.id });

    const pending = listPendingSchoolMaterialApprovals();
    expect(pending.some((approval) => approval.materialId === material.id)).toBe(true);

    approveSchoolMaterial({ materialId: material.id, adminId });

    const schoolLibrary = listTeacherSchoolLibraryMaterials(teacherId);
    const approvedMaterial = schoolLibrary.find((entry) => entry.materialId === material.id);
    expect(approvedMaterial?.title).toBe("Section view reference pack");

    const teacherMaterial = listTeacherMaterials(teacherId).find((entry) => entry.id === material.id);
    expect(teacherMaterial?.status).toBe("approved_school");
    expect(teacherMaterial?.visibleInSchoolLibrary).toBe(true);
  });

  test("submit plus reject keeps a material hidden and persists the rejection reason", () => {
    const material = createPersonalMaterial({
      teacherId,
      title: "Dimensioning draft v1",
      description: "Needs admin review before sharing school-wide.",
    });

    submitMaterialToSchool({ teacherId, materialId: material.id });
    rejectSchoolMaterial({
      materialId: material.id,
      adminId,
      reason: "Add a clearer example page before publishing to the school library.",
    });

    expect(listTeacherSchoolLibraryMaterials(teacherId).some((entry) => entry.materialId === material.id)).toBe(false);
    expect(listPendingSchoolMaterialApprovals().some((approval) => approval.materialId === material.id)).toBe(false);

    const rejectedMaterial = listTeacherMaterials(teacherId).find((entry) => entry.id === material.id);
    expect(rejectedMaterial?.status).toBe("rejected_school");
    expect(rejectedMaterial?.visibleInSchoolLibrary).toBe(false);
    expect(rejectedMaterial?.rejectionReason).toBe("Add a clearer example page before publishing to the school library.");
  });
});
