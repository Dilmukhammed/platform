import { describe, it, expect, beforeEach } from "bun:test";
import { resetGradesState, gradesService } from "@/modules/grades";
import { computeFinalScore, mapToLetterGrade, DEFAULT_FORMULA } from "@/lib/grading/formula";
import { requireTeacherOwnedGradeContext } from "@/modules/grades/access";
import { getPublicationsState, resetPublicationsState } from "./helpers/publications-stub";
import { getSubmissionsState, resetSubmissionsState } from "./helpers/submissions-stub";

const ownerTeacherId = "teacher-grade-owner";
const otherTeacherId = "teacher-grade-other";

function seedGradeOwnershipContext() {
  getPublicationsState().publications.push({
    id: "pub-grade-1",
    templateId: "template-grade-1",
    teacherId: ownerTeacherId,
    organizationId: "org-grade-1",
    title: "Grade publication",
    description: null,
    instructions: null,
    linkedMaterialIds: [],
    linkedTestIds: [],
    defaultDeadline: "2026-05-01T10:00:00.000Z",
    createdAt: "2026-04-11T10:00:00.000Z",
    updatedAt: "2026-04-11T10:00:00.000Z",
  });

  getSubmissionsState().results.push({
    id: "res-grade-1",
    publicationId: "pub-grade-1",
    studentId: "student-grade-1",
    classId: "class-grade-1",
    organizationId: "org-grade-1",
    teacherId: ownerTeacherId,
    templateId: "template-grade-1",
    status: "submitted",
    latestSubmissionId: "sub-grade-1",
    submissionIds: ["sub-grade-1"],
    createdAt: "2026-04-11T10:00:00.000Z",
    updatedAt: "2026-04-11T10:00:00.000Z",
  });

  gradesService.computeAndSaveGrade("res-grade-1", "pub-grade-1", "student-grade-1", 80, 90);
}

describe("Grades", () => {
  beforeEach(() => {
    resetGradesState();
    resetPublicationsState();
    resetSubmissionsState();
  });

  describe("computeFinalScore", () => {
    it("computes weighted average when both scores present", () => {
      expect(computeFinalScore(80, 70, DEFAULT_FORMULA)).toBe(76);
    });

    it("returns practice score when test is null", () => {
      expect(computeFinalScore(80, null, DEFAULT_FORMULA)).toBe(80);
    });

    it("returns test score when practice is null", () => {
      expect(computeFinalScore(null, 70, DEFAULT_FORMULA)).toBe(70);
    });

    it("returns 0 when both scores are null", () => {
      expect(computeFinalScore(null, null, DEFAULT_FORMULA)).toBe(0);
    });

    it("rounds to 1 decimal", () => {
      // 85*0.6 + 78*0.4 = 51 + 31.2 = 82.2
      expect(computeFinalScore(85, 78, DEFAULT_FORMULA)).toBe(82.2);
    });
  });

  describe("mapToLetterGrade", () => {
    it("maps 95 to A", () => {
      expect(mapToLetterGrade(95)).toBe("A");
    });

    it("maps 90 to A", () => {
      expect(mapToLetterGrade(90)).toBe("A");
    });

    it("maps 82 to B", () => {
      expect(mapToLetterGrade(82)).toBe("B");
    });

    it("maps 75 to C", () => {
      expect(mapToLetterGrade(75)).toBe("C");
    });

    it("maps 65 to D", () => {
      expect(mapToLetterGrade(65)).toBe("D");
    });

    it("maps 55 to F", () => {
      expect(mapToLetterGrade(55)).toBe("F");
    });
  });

  describe("gradesService.computeAndSaveGrade", () => {
    it("creates a grade record with correct formula snapshot", () => {
      const grade = gradesService.computeAndSaveGrade(
        "res-test-1",
        "pub-test-1",
        "stu-test-1",
        80,
        70
      );

      expect(grade.resultId).toBe("res-test-1");
      expect(grade.publicationId).toBe("pub-test-1");
      expect(grade.studentId).toBe("stu-test-1");
      expect(grade.practiceScoreRaw).toBe(80);
      expect(grade.testScoreRaw).toBe(70);
      expect(grade.finalScoreRaw).toBe(76);
      expect(grade.mappedGrade).toBe("C");
      expect(grade.formulaSnapshot).toEqual(DEFAULT_FORMULA);
      expect(grade.overrideReason).toBeNull();
      expect(grade.overriddenBy).toBeNull();
      expect(grade.overriddenAt).toBeNull();
    });

    it("upserts on second call for same resultId (no duplicate)", () => {
      const first = gradesService.computeAndSaveGrade(
        "res-upsert-1",
        "pub-1",
        "stu-1",
        80,
        70
      );

      const second = gradesService.computeAndSaveGrade(
        "res-upsert-1",
        "pub-1",
        "stu-1",
        95,
        90
      );

      expect(second.id).toBe(first.id);
      expect(second.practiceScoreRaw).toBe(95);
      expect(second.testScoreRaw).toBe(90);
      expect(second.finalScoreRaw).toBe(93);
      expect(second.mappedGrade).toBe("A");

      // Verify no duplicate in the store
      const all = gradesService.getGradebookByPublicationId("pub-1");
      const matching = all.filter((g) => g.resultId === "res-upsert-1");
      expect(matching.length).toBe(1);
    });
  });

  describe("gradesService.overrideGrade", () => {
    it("sets overriddenBy, overrideReason, overriddenAt and updates finalScoreRaw+mappedGrade", () => {
      gradesService.computeAndSaveGrade(
        "res-override-1",
        "pub-1",
        "stu-1",
        60,
        50
      );

      const overridden = gradesService.overrideGrade(
        "res-override-1",
        "teacher-1",
        85,
        "Exceptional effort in class participation"
      );

      expect(overridden.finalScoreRaw).toBe(85);
      expect(overridden.mappedGrade).toBe("B");
      expect(overridden.overriddenBy).toBe("teacher-1");
      expect(overridden.overrideReason).toBe("Exceptional effort in class participation");
      expect(overridden.overriddenAt).not.toBeNull();
    });

    it("throws when grade record not found", () => {
      expect(() => {
        gradesService.overrideGrade("nonexistent", "teacher-1", 85, "reason");
      }).toThrow("Grade record not found");
    });
  });

  describe("gradesService.getGradebookByPublicationId", () => {
    it("returns all grades for a publication", () => {
      // Bootstrap data has 2 grades for pub-seed-001
      const grades = gradesService.getGradebookByPublicationId("pub-seed-001");
      expect(grades.length).toBe(2);
      expect(grades[0].publicationId).toBe("pub-seed-001");
      expect(grades[1].publicationId).toBe("pub-seed-001");
    });

    it("returns empty array for unknown publication", () => {
      const grades = gradesService.getGradebookByPublicationId("pub-nonexistent");
      expect(grades.length).toBe(0);
    });
  });

  describe("gradesService.getGradeByResultId", () => {
    it("returns grade for existing resultId", () => {
      const grade = gradesService.getGradeByResultId("74000000-0000-4000-8000-000000000001");
      expect(grade).toBeDefined();
      expect(grade!.studentId).toBe("student-seed-001");
    });

    it("returns undefined for unknown resultId", () => {
      const grade = gradesService.getGradeByResultId("nonexistent");
      expect(grade).toBeUndefined();
    });
  });

  describe("grade ownership authorization", () => {
    it("allows compute context validation for the owning teacher before a grade exists", () => {
      getPublicationsState().publications.push({
        id: "pub-grade-compute-1",
        templateId: "template-grade-compute-1",
        teacherId: ownerTeacherId,
        organizationId: "org-grade-compute-1",
        title: "Compute publication",
        description: null,
        instructions: null,
        linkedMaterialIds: [],
        linkedTestIds: [],
        defaultDeadline: "2026-05-01T10:00:00.000Z",
        createdAt: "2026-04-11T10:00:00.000Z",
        updatedAt: "2026-04-11T10:00:00.000Z",
      });

      getSubmissionsState().results.push({
        id: "res-grade-compute-1",
        publicationId: "pub-grade-compute-1",
        studentId: "student-grade-compute-1",
        classId: "class-grade-compute-1",
        organizationId: "org-grade-compute-1",
        teacherId: ownerTeacherId,
        templateId: "template-grade-compute-1",
        status: "submitted",
        latestSubmissionId: "sub-grade-compute-1",
        submissionIds: ["sub-grade-compute-1"],
        createdAt: "2026-04-11T10:00:00.000Z",
        updatedAt: "2026-04-11T10:00:00.000Z",
      });

      expect(
        requireTeacherOwnedGradeContext({
          teacherId: ownerTeacherId,
          resultId: "res-grade-compute-1",
          publicationId: "pub-grade-compute-1",
          studentId: "student-grade-compute-1",
        }),
      ).toMatchObject({
        grade: undefined,
        result: {
          id: "res-grade-compute-1",
        },
        publication: {
          id: "pub-grade-compute-1",
        },
      });
    });

    it("rejects overrides for a teacher who does not own the result/publication", () => {
      seedGradeOwnershipContext();

      expect(() =>
        requireTeacherOwnedGradeContext({
          teacherId: otherTeacherId,
          resultId: "res-grade-1",
        }),
      ).toThrow("Grade record not found for this teacher.");
    });

    it("rejects compute context when publication or student ids do not match the teacher-owned result", () => {
      getPublicationsState().publications.push({
        id: "pub-grade-compute-2",
        templateId: "template-grade-compute-2",
        teacherId: ownerTeacherId,
        organizationId: "org-grade-compute-2",
        title: "Compute publication mismatch",
        description: null,
        instructions: null,
        linkedMaterialIds: [],
        linkedTestIds: [],
        defaultDeadline: "2026-05-01T10:00:00.000Z",
        createdAt: "2026-04-11T10:00:00.000Z",
        updatedAt: "2026-04-11T10:00:00.000Z",
      });

      getSubmissionsState().results.push({
        id: "res-grade-compute-2",
        publicationId: "pub-grade-compute-2",
        studentId: "student-grade-compute-2",
        classId: "class-grade-compute-2",
        organizationId: "org-grade-compute-2",
        teacherId: ownerTeacherId,
        templateId: "template-grade-compute-2",
        status: "submitted",
        latestSubmissionId: "sub-grade-compute-2",
        submissionIds: ["sub-grade-compute-2"],
        createdAt: "2026-04-11T10:00:00.000Z",
        updatedAt: "2026-04-11T10:00:00.000Z",
      });

      expect(() =>
        requireTeacherOwnedGradeContext({
          teacherId: ownerTeacherId,
          resultId: "res-grade-compute-2",
          publicationId: "pub-grade-compute-2-mismatch",
          studentId: "student-grade-compute-2",
        }),
      ).toThrow("Grade record not found for this teacher.");

      expect(() =>
        requireTeacherOwnedGradeContext({
          teacherId: ownerTeacherId,
          resultId: "res-grade-compute-2",
          publicationId: "pub-grade-compute-2",
          studentId: "student-grade-compute-2-mismatch",
        }),
      ).toThrow("Grade record not found for this teacher.");
    });
  });
});
