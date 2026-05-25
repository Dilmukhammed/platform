import { bootstrapStaffAccounts } from "@/modules/auth/bootstrap-data";
import { getMaterialsState } from "../materials-stub";
import { getTeacherSelectedOrganization, getOrganizationsState } from "../organizations-stub";
import { getTestsState } from "@/modules/tests";

import { getAssignmentsState } from "./store";
import type {
  AssignmentMaterialOption,
  AssignmentTemplateCreateOptions,
  AssignmentTemplateDetail,
  AssignmentTemplateRecord,
  AssignmentTemplateSummary,
  AssignmentTestOption,
} from "./types";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeParagraphText(value: string) {
  const normalized = value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n\n");

  return normalized.length > 0 ? normalized : null;
}

function nextTemplateId(templates: AssignmentTemplateRecord[]) {
  return `72000000-0000-4000-8000-${String(templates.length + 1).padStart(12, "0")}`;
}

function requireTeacherSelectedOrganization(teacherId: string) {
  const selectedOrganization = getTeacherSelectedOrganization(teacherId);

  if (!selectedOrganization) {
    throw new Error("Select an approved organization before managing assignment templates.");
  }

  return selectedOrganization;
}

function getOrganizationName(organizationId: string) {
  const organization = getOrganizationsState().organizations.find((candidate) => candidate.id === organizationId);

  if (!organization) {
    throw new Error("Organization record is missing for the assignment template.");
  }

  return organization.name;
}

function getTeacherName(teacherId: string) {
  const teacher = bootstrapStaffAccounts.find((account) => account.id === teacherId && account.role === "teacher");

  if (!teacher) {
    throw new Error("Teacher account is missing.");
  }

  return teacher.displayName;
}

function listAssignableMaterialOptions(teacherId: string): AssignmentMaterialOption[] {
  const selectedOrganization = requireTeacherSelectedOrganization(teacherId);

  const personalOptions = getMaterialsState().materials
    .filter(
      (material) =>
        material.teacherId === teacherId &&
        material.organizationId === selectedOrganization.organizationId &&
        (material.status === "personal" || material.status === "approved_school"),
    )
    .map((material) => ({
      id: material.id,
      title: material.title,
      description: material.description,
      organizationId: material.organizationId,
      organizationName: selectedOrganization.organizationName,
      source: material.status === "approved_school" ? "school" : "personal",
      ownerTeacherName: getTeacherName(material.teacherId),
    }) satisfies AssignmentMaterialOption);

  const schoolOptions = getMaterialsState().materials
    .filter(
      (material) =>
        material.organizationId === selectedOrganization.organizationId &&
        material.status === "approved_school" &&
        material.teacherId !== teacherId,
    )
    .map((material) => ({
      id: material.id,
      title: material.title,
      description: material.description,
      organizationId: material.organizationId,
      organizationName: selectedOrganization.organizationName,
      source: "school",
      ownerTeacherName: getTeacherName(material.teacherId),
    }) satisfies AssignmentMaterialOption);

  return [...personalOptions, ...schoolOptions].sort((left, right) => left.title.localeCompare(right.title));
}

function listAssignableTestOptions(teacherId: string): AssignmentTestOption[] {
  const selectedOrganization = requireTeacherSelectedOrganization(teacherId);

  const personalOptions = getTestsState().tests
    .filter(
      (testRecord) =>
        testRecord.teacherId === teacherId &&
        testRecord.organizationId === selectedOrganization.organizationId,
    )
    .map((testRecord) => ({
      id: testRecord.id,
      title: testRecord.title,
      description: testRecord.description,
      organizationId: testRecord.organizationId,
      organizationName: selectedOrganization.organizationName,
      source: testRecord.status === "approved_school" ? "school" : "personal",
      ownerTeacherName: getTeacherName(testRecord.teacherId),
      questionCount: testRecord.questions.length,
    }) satisfies AssignmentTestOption);

  const schoolOptions = getTestsState().tests
    .filter(
      (testRecord) =>
        testRecord.organizationId === selectedOrganization.organizationId &&
        testRecord.status === "approved_school" &&
        testRecord.teacherId !== teacherId,
    )
    .map((testRecord) => ({
      id: testRecord.id,
      title: testRecord.title,
      description: testRecord.description,
      organizationId: testRecord.organizationId,
      organizationName: selectedOrganization.organizationName,
      source: "school",
      ownerTeacherName: getTeacherName(testRecord.teacherId),
      questionCount: testRecord.questions.length,
    }) satisfies AssignmentTestOption)

  return [...personalOptions, ...schoolOptions].sort((left, right) => left.title.localeCompare(right.title));
}

function mapTemplateSummary(template: AssignmentTemplateRecord): AssignmentTemplateSummary {
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    instructions: template.instructions,
    organizationId: template.organizationId,
    organizationName: getOrganizationName(template.organizationId),
    linkedMaterialCount: template.linkedMaterialIds.length,
    linkedTestCount: template.linkedTestIds.length,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function getOwnedTemplate(input: { teacherId: string; templateId: string }) {
  const template = getAssignmentsState().templates.find((candidate) => candidate.id === input.templateId);

  if (!template || template.teacherId !== input.teacherId) {
    throw new Error("Assignment template not found for this teacher.");
  }

  return template;
}

export function listTeacherAssignmentTemplates(teacherId: string): AssignmentTemplateSummary[] {
  const selectedOrganization = requireTeacherSelectedOrganization(teacherId);

  return getAssignmentsState().templates
    .filter(
      (template) =>
        template.teacherId === teacherId && template.organizationId === selectedOrganization.organizationId,
    )
    .map(mapTemplateSummary)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getTeacherAssignmentTemplateDetail(input: { teacherId: string; templateId: string }): AssignmentTemplateDetail {
  const selectedOrganization = requireTeacherSelectedOrganization(input.teacherId);
  const template = getOwnedTemplate(input);

  if (template.organizationId !== selectedOrganization.organizationId) {
    throw new Error("Assignment template is outside the active organization.");
  }

  const materialOptions = listAssignableMaterialOptions(input.teacherId);
  const testOptions = listAssignableTestOptions(input.teacherId);

  return {
    ...mapTemplateSummary(template),
    linkedMaterials: template.linkedMaterialIds.map((materialId) => {
      const material = materialOptions.find((candidate) => candidate.id === materialId);

      if (!material) {
        throw new Error("Linked material is no longer available in the active organization scope.");
      }

      return material;
    }),
    linkedTests: template.linkedTestIds.map((testId) => {
      const testRecord = testOptions.find((candidate) => candidate.id === testId);

      if (!testRecord) {
        throw new Error("Linked test is no longer available in the active organization scope.");
      }

      return testRecord;
    }),
  };
}

export function getAssignmentTemplateCreateOptions(teacherId: string): AssignmentTemplateCreateOptions {
  const selectedOrganization = requireTeacherSelectedOrganization(teacherId);

  return {
    organizationId: selectedOrganization.organizationId,
    organizationName: selectedOrganization.organizationName,
    materials: listAssignableMaterialOptions(teacherId),
    tests: listAssignableTestOptions(teacherId),
  };
}

export function createAssignmentTemplate(input: {
  teacherId: string;
  title: string;
  description?: string;
  instructions?: string;
  linkedMaterialIds?: string[];
  linkedTestIds?: string[];
}) {
  const selectedOrganization = requireTeacherSelectedOrganization(input.teacherId);
  const state = getAssignmentsState();
  const title = normalizeText(input.title);
  const description = normalizeParagraphText(input.description ?? "");
  const instructions = normalizeParagraphText(input.instructions ?? "");

  if (title.length < 3) {
    throw new Error("Assignment template title must be at least 3 characters.");
  }

  const materialOptions = listAssignableMaterialOptions(input.teacherId);
  const testOptions = listAssignableTestOptions(input.teacherId);
  const linkedMaterialIds = [...new Set(input.linkedMaterialIds ?? [])].filter(Boolean);
  const linkedTestIds = [...new Set(input.linkedTestIds ?? [])].filter(Boolean);

  for (const materialId of linkedMaterialIds) {
    if (!materialOptions.some((candidate) => candidate.id === materialId)) {
      throw new Error("One or more linked materials are unavailable in the active organization scope.");
    }
  }

  for (const testId of linkedTestIds) {
    if (!testOptions.some((candidate) => candidate.id === testId)) {
      throw new Error("One or more linked tests are unavailable in the active organization scope.");
    }
  }

  const timestamp = new Date().toISOString();
  const template: AssignmentTemplateRecord = {
    id: nextTemplateId(state.templates),
    teacherId: input.teacherId,
    organizationId: selectedOrganization.organizationId,
    title,
    description,
    instructions,
    linkedMaterialIds,
    linkedTestIds,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  state.templates.push(template);
  return getTeacherAssignmentTemplateDetail({ teacherId: input.teacherId, templateId: template.id });
}
