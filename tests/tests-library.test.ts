import { beforeEach, describe, expect, test } from "bun:test";

import { resetOrganizationsState } from "./helpers/organizations-stub";
import {
  approveSchoolTest,
  createAiDraftTest,
  getTeacherTestDetail,
  listPendingSchoolTestApprovals,
  listTeacherSchoolLibraryTests,
  listTeacherTests,
  resetTestsState,
  submitTestToSchool,
  updateTeacherDraftTest,
} from "@/modules/tests";

const teacherId = "20000000-0000-4000-8000-000000000002";
const adminId = "20000000-0000-4000-8000-000000000001";

describe("test library AI draft and approval flow", () => {
  beforeEach(() => {
    resetOrganizationsState();
    resetTestsState();
  });

  test("AI draft creation appears in personal tests only until approval", () => {
    const draft = createAiDraftTest({
      teacherId,
      prompt: "Create an orthographic projection fundamentals quiz for beginner students.",
      questionCount: 3,
    });

    expect(draft.status).toBe("personal_draft");
    expect(draft.source).toBe("ai_stub");
    expect(draft.aiProvider).toBe("deterministic-local-stub");

    const personalTests = listTeacherTests(teacherId);
    const personalEntry = personalTests.find((entry) => entry.id === draft.id);
    expect(personalEntry?.status).toBe("personal_draft");
    expect(personalEntry?.visibleInSchoolLibrary).toBe(false);

    expect(listPendingSchoolTestApprovals()).toHaveLength(0);
    expect(listTeacherSchoolLibraryTests(teacherId).some((entry) => entry.testId === draft.id)).toBe(false);
  });

  test("submit plus approve moves a test into school-visible scope", () => {
    const draft = createAiDraftTest({
      teacherId,
      prompt: "Build a section line and dimensioning checkpoint for intermediate students.",
      questionCount: 4,
    });

    updateTeacherDraftTest({
      teacherId,
      testId: draft.id,
      title: "Section line readiness check",
      description: "Teacher-edited draft before school submission.",
      questions: draft.questions.map((question, index) => ({
        prompt: `${question.prompt} Edited ${index + 1}`,
        answer: `${question.answer} Reviewed`,
        explanation: question.explanation ?? "",
      })),
    });

    submitTestToSchool({ teacherId, testId: draft.id });

    const pending = listPendingSchoolTestApprovals();
    expect(pending.some((approval) => approval.testId === draft.id)).toBe(true);
    expect(listTeacherSchoolLibraryTests(teacherId).some((entry) => entry.testId === draft.id)).toBe(false);

    approveSchoolTest({ testId: draft.id, adminId });

    const schoolLibrary = listTeacherSchoolLibraryTests(teacherId);
    const approvedEntry = schoolLibrary.find((entry) => entry.testId === draft.id);
    expect(approvedEntry?.title).toBe("Section line readiness check");

    const teacherView = getTeacherTestDetail({ teacherId, testId: draft.id });
    expect(teacherView.status).toBe("approved_school");
    expect(teacherView.visibleInSchoolLibrary).toBe(true);
    expect(teacherView.questions[0]?.prompt).toContain("Edited 1");
  });
});
