import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { authenticateStudent } from "@/modules/auth";
import { createClass, getTeacherClassDetail, resetClassesState } from "./helpers/classes-stub";
import { resetJoinCodesState } from "@/modules/join-codes";
import { resetOrganizationsState } from "./helpers/organizations-stub";
import {
  createStudentForTeacher,
  getLatestBulkImportReport,
  importStudentsFromCsv,
  listTeacherStudents,
  resetStudentsState,
  selfJoinClass,
} from "./helpers/students-stub";

const teacherId = "20000000-0000-4000-8000-000000000002";

describe("student provisioning and attach flow", () => {
  beforeEach(() => {
    resetOrganizationsState();
    resetClassesState();
    resetJoinCodesState();
    resetStudentsState();
  });

  test("manual create generates the next deterministic student_login and enrollment", async () => {
    const created = await createStudentForTeacher({
      teacherId,
      classId: "60000000-0000-4000-8000-000000000001",
      firstName: "Pavel",
      lastName: "Rudnev",
      pin: "3333",
    });

    expect(created.studentLogin).toBe("ST-100003");

    const classDetail = getTeacherClassDetail({ teacherId, classId: "60000000-0000-4000-8000-000000000001" });
    expect(classDetail.roster.some((student) => student.studentLogin === "ST-100003")).toBe(true);

    const authResult = await authenticateStudent({ studentLogin: "ST-100003", pin: "3333" });
    expect(authResult.ok).toBe(true);
  });

  test("self-join attaches existing student and avoids duplicate profile or enrollment", async () => {
    const extraClass = createClass({
      teacherId,
      name: "Engineering Graphics 8B",
      description: "Second deterministic class for attach flow coverage.",
    });

    expect(extraClass.activeJoinCode).toBe("120802");

    const beforeProfiles = listTeacherStudents(teacherId).students.map((student) => student.studentLogin);
    const joinResult = await selfJoinClass({
      joinCode: extraClass.activeJoinCode,
      existingStudentLogin: "ST-100001",
      pin: "1111",
    });

    expect(joinResult.result).toBe("attached_existing");
    expect(listTeacherStudents(teacherId).students.map((student) => student.studentLogin)).toEqual(beforeProfiles);

    const classDetail = getTeacherClassDetail({ teacherId, classId: extraClass.id });
    expect(classDetail.roster).toHaveLength(1);
    expect(classDetail.roster[0]?.studentLogin).toBe("ST-100001");

    const repeatJoin = await selfJoinClass({
      joinCode: extraClass.activeJoinCode,
      existingStudentLogin: "ST-100001",
      pin: "1111",
    });

    expect(repeatJoin.result).toBe("already_enrolled");
    expect(getTeacherClassDetail({ teacherId, classId: extraClass.id }).roster).toHaveLength(1);
  });

  test("bulk import processes fixture CSV and reports duplicate enrollment cleanly", async () => {
    const extraClass = createClass({
      teacherId,
      name: "Engineering Graphics 8B",
      description: "Second deterministic class for CSV fixture coverage.",
    });

    expect(extraClass.activeJoinCode).toBe("120802");

    const csvText = readFileSync(path.join(process.cwd(), "fixtures/students/sample.csv"), "utf8");
    const report = await importStudentsFromCsv({ teacherId, csvText });

    expect(report.totalRows).toBe(2);
    expect(report.createdCount).toBe(0);
    expect(report.attachedExistingCount).toBe(1);
    expect(report.duplicateCount).toBe(1);
    expect(report.errorCount).toBe(0);
    expect(report.rows[0]?.status).toBe("duplicate");
    expect(report.rows[1]?.status).toBe("attached_existing");
    expect(report.rows[0]?.message).toContain("already enrolled");

    const latestReport = getLatestBulkImportReport();
    expect(latestReport?.duplicateCount).toBe(1);

    const classDetail = getTeacherClassDetail({ teacherId, classId: extraClass.id });
    expect(classDetail.roster).toHaveLength(1);
    expect(classDetail.roster[0]?.studentLogin).toBe("ST-100002");
  });
});
