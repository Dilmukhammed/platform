import { beforeEach, describe, expect, test } from "bun:test";

import {
  createClass,
  getTeacherClassDetail,
  listTeacherClassJoinCodeHistory,
  resetClassesState,
  rotateTeacherClassJoinCode,
} from "./helpers/classes-stub";
import { getActiveJoinCodeForClass, isValidJoinCodeFormat, resetJoinCodesState } from "@/modules/join-codes";
import { resetOrganizationsState } from "./helpers/organizations-stub";

const teacherId = "20000000-0000-4000-8000-000000000002";

describe("teacher class and join code flow", () => {
  beforeEach(() => {
    resetOrganizationsState();
    resetClassesState();
    resetJoinCodesState();
  });

  test("teacher can create a class inside the selected active organization with an active 6-digit code", () => {
    const createdClass = createClass({
      teacherId,
      name: "Descriptive Geometry Group B",
      description: "Evening drafting cohort.",
    });

    expect(createdClass.organizationId).toBe("30000000-0000-4000-8000-000000000001");
    expect(createdClass.organizationName).toBe("Demo School");
    expect(createdClass.activeJoinCode).toMatch(/^\d{6}$/);
    expect(isValidJoinCodeFormat(createdClass.activeJoinCode)).toBe(true);

    const activeCode = getActiveJoinCodeForClass(createdClass.id);
    expect(activeCode?.code).toBe(createdClass.activeJoinCode);

    const history = listTeacherClassJoinCodeHistory({ teacherId, classId: createdClass.id });
    expect(history).toHaveLength(1);
    expect(history[0]?.status).toBe("active");
  });

  test("rotating a class join code preserves history and keeps exactly one active code", () => {
    const seededClassId = "60000000-0000-4000-8000-000000000001";
    const beforeRotation = getTeacherClassDetail({ teacherId, classId: seededClassId });

    expect(beforeRotation.activeJoinCode).toBe("120801");

    const rotation = rotateTeacherClassJoinCode({ teacherId, classId: seededClassId });
    const afterRotation = rotation.classDetail;
    const history = listTeacherClassJoinCodeHistory({ teacherId, classId: seededClassId });
    const activeEntries = history.filter((entry) => entry.status === "active");
    const rotatedEntries = history.filter((entry) => entry.status === "rotated");

    expect(afterRotation.activeJoinCode).toMatch(/^\d{6}$/);
    expect(afterRotation.activeJoinCode).not.toBe(beforeRotation.activeJoinCode);
    expect(activeEntries).toHaveLength(1);
    expect(activeEntries[0]?.code).toBe(afterRotation.activeJoinCode);
    expect(rotatedEntries.length).toBeGreaterThanOrEqual(2);
    expect(history.some((entry) => entry.code === beforeRotation.activeJoinCode && entry.status === "rotated")).toBe(true);
    expect(history.find((entry) => entry.code === beforeRotation.activeJoinCode)?.rotatedAt).toBeTruthy();
  });
});
