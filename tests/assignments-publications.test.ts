import { beforeEach, describe, expect, test } from "bun:test";

import { createAssignmentTemplate, resetAssignmentsState } from "./helpers/assignments-stub";
import { createClass, getClassesState, resetClassesState } from "./helpers/classes-stub";
import { createPersonalMaterial, resetMaterialsState, submitMaterialToSchool, approveSchoolMaterial } from "./helpers/materials-stub";
import { resetJoinCodesState } from "@/modules/join-codes";
import { resetOrganizationsState } from "./helpers/organizations-stub";
import {
  getTeacherOwnedPublication,
  getTeacherPublicationDetail,
  listTeacherPublications,
  publishAssignmentTemplate,
  resetPublicationsState,
} from "./helpers/publications-stub";
import { approveSchoolTest, createAiDraftTest, resetTestsState, submitTestToSchool } from "@/modules/tests";

const teacherId = "20000000-0000-4000-8000-000000000002";
const adminId = "20000000-0000-4000-8000-000000000001";
const otherTeacherId = "20000000-0000-4000-8000-000000009999";

describe("assignment templates and publications", () => {
  beforeEach(() => {
    resetOrganizationsState();
    resetClassesState();
    resetJoinCodesState();
    resetMaterialsState();
    resetTestsState();
    resetAssignmentsState();
    resetPublicationsState();
  });

  test("multi-class publish creates one target row per selected class", () => {
    const material = createPersonalMaterial({
      teacherId,
      title: "Projection reference sheets",
      description: "Reusable worksheet set.",
    });

    submitMaterialToSchool({ teacherId, materialId: material.id });
    approveSchoolMaterial({ materialId: material.id, adminId });

    const draftTest = createAiDraftTest({
      teacherId,
      prompt: "Create a concise orthographic projection checkpoint.",
      questionCount: 3,
    });

    submitTestToSchool({ teacherId, testId: draftTest.id });
    approveSchoolTest({ testId: draftTest.id, adminId });

    const secondClass = createClass({
      teacherId,
      name: "Section drawing studio",
      description: "Second teacher-owned class for publication flow coverage.",
    });

    const template = createAssignmentTemplate({
      teacherId,
      title: "Orthographic projection packet",
      description: "Template for linked library content.",
      instructions: "Complete the practice sheet and pass the approved test.",
      linkedMaterialIds: [material.id],
      linkedTestIds: [draftTest.id],
    });

    const publication = publishAssignmentTemplate({
      teacherId,
      templateId: template.id,
      defaultDeadline: "2026-05-12T12:00",
      classIds: ["60000000-0000-4000-8000-000000000001", secondClass.id],
    });

    expect(publication.classTargets).toHaveLength(2);
    expect(publication.classTargets.map((target) => target.classId).sort()).toEqual([
      "60000000-0000-4000-8000-000000000001",
      secondClass.id,
    ]);
    expect(listTeacherPublications(teacherId)).toHaveLength(1);
  });

  test("class-specific deadline override persists alongside the default deadline", () => {
    const template = createAssignmentTemplate({
      teacherId,
      title: "Deadline override template",
      instructions: "Use the class-specific deadline when present.",
    });

    const secondClass = createClass({
      teacherId,
      name: "Perspective drafting lab",
      description: "Override coverage class.",
    });

    const publication = publishAssignmentTemplate({
      teacherId,
      templateId: template.id,
      defaultDeadline: "2026-05-15T09:00",
      classIds: ["60000000-0000-4000-8000-000000000001", secondClass.id],
      deadlineOverrides: {
        [secondClass.id]: "2026-05-20T10:30",
      },
    });

    const firstTarget = publication.classTargets.find((target) => target.classId === "60000000-0000-4000-8000-000000000001");
    const secondTarget = publication.classTargets.find((target) => target.classId === secondClass.id);

    expect(firstTarget?.deadlineOverride).toBeNull();
    expect(firstTarget?.effectiveDeadline).toBe(publication.defaultDeadline);
    expect(secondTarget?.deadlineOverride).toBe("2026-05-20T10:30:00.000Z");
    expect(secondTarget?.effectiveDeadline).toBe("2026-05-20T10:30:00.000Z");

    const detail = getTeacherPublicationDetail({ teacherId, publicationId: publication.id });
    expect(detail.classTargets.find((target) => target.classId === secondClass.id)?.deadlineOverride).toBe("2026-05-20T10:30:00.000Z");
  });

  test("publication detail includes linked materials and linked tests", () => {
    const material = createPersonalMaterial({
      teacherId,
      title: "Dimensioning rubric",
      description: "Teacher-owned linked material.",
    });
    const draftTest = createAiDraftTest({
      teacherId,
      prompt: "Create a dimensioning validation quiz.",
      questionCount: 2,
    });

    submitTestToSchool({ teacherId, testId: draftTest.id });
    approveSchoolTest({ testId: draftTest.id, adminId });

    const template = createAssignmentTemplate({
      teacherId,
      title: "Dimensioning mastery",
      linkedMaterialIds: [material.id],
      linkedTestIds: [draftTest.id],
    });

    const publication = publishAssignmentTemplate({
      teacherId,
      templateId: template.id,
      defaultDeadline: "2026-05-18T14:00",
      classIds: ["60000000-0000-4000-8000-000000000001"],
    });

    expect(publication.linkedMaterials.map((entry) => entry.id)).toEqual([material.id]);
    expect(publication.linkedTests.map((entry) => entry.id)).toEqual([draftTest.id]);
  });

  test("teacher can link a personal draft test to an assignment template without school approval", () => {
    const personalDraftTest = createAiDraftTest({
      teacherId,
      prompt: "Create a private sketching readiness quiz.",
      questionCount: 2,
    });

    const template = createAssignmentTemplate({
      teacherId,
      title: "Private teacher test linkage",
      linkedTestIds: [personalDraftTest.id],
    });

    expect(template.linkedTests).toHaveLength(1);
    expect(template.linkedTests[0]?.id).toBe(personalDraftTest.id);
    expect(template.linkedTests[0]?.source).toBe("personal");
  });

  test("teacher cannot publish to a class outside active ownership scope", () => {
    const template = createAssignmentTemplate({
      teacherId,
      title: "Guarded publication template",
    });

    getClassesState().classes.push({
      id: "60000000-0000-4000-8000-000000000999",
      organizationId: "30000000-0000-4000-8000-000000000001",
      teacherId: "20000000-0000-4000-8000-000000009999",
      name: "Foreign owner class",
      slug: "foreign-owner-class",
      description: null,
      status: "active",
      createdAt: "2026-04-12T09:00:00.000Z",
      updatedAt: "2026-04-12T09:00:00.000Z",
    });

    expect(() =>
      publishAssignmentTemplate({
        teacherId,
        templateId: template.id,
        defaultDeadline: "2026-05-19T08:00",
        classIds: ["60000000-0000-4000-8000-000000000999"],
      }),
    ).toThrow("One or more selected classes are unavailable in the active organization ownership scope.");
  });

  test("teacher cannot access another teacher's publication ownership scope", () => {
    const template = createAssignmentTemplate({
      teacherId,
      title: "Owned publication",
    });

    const publication = publishAssignmentTemplate({
      teacherId,
      templateId: template.id,
      defaultDeadline: "2026-05-19T08:00",
      classIds: ["60000000-0000-4000-8000-000000000001"],
    });

    expect(() =>
      getTeacherOwnedPublication({
        teacherId: otherTeacherId,
        publicationId: publication.id,
      }),
    ).toThrow("Publication not found for this teacher.");
  });
});
