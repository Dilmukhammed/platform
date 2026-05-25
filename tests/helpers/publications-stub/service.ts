import { getTeacherAssignmentTemplateDetail } from "../assignments-stub";
import { getClassesState } from "../classes-stub";
import { getTeacherSelectedOrganization, getOrganizationsState } from "../organizations-stub";

import { getPublicationsState } from "./store";
import type {
  PublicationClassRecord,
  PublicationClassSummary,
  PublicationRecord,
  TeacherPublicationDetail,
  TeacherPublicationSummary,
} from "./types";

function nextPublicationId(publications: PublicationRecord[]) {
  return `73000000-0000-4000-8000-${String(publications.length + 1).padStart(12, "0")}`;
}

function nextPublicationClassId(publicationClasses: PublicationClassRecord[]) {
  return `73100000-0000-4000-8000-${String(publicationClasses.length + 1).padStart(12, "0")}`;
}

function normalizeDeadline(value: string, label: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }

  return date.toISOString();
}

function requireTeacherSelectedOrganization(teacherId: string) {
  const selectedOrganization = getTeacherSelectedOrganization(teacherId);

  if (!selectedOrganization) {
    throw new Error("Select an approved organization before publishing assignments.");
  }

  return selectedOrganization;
}

function getOrganizationName(organizationId: string) {
  const organization = getOrganizationsState().organizations.find((candidate) => candidate.id === organizationId);

  if (!organization) {
    throw new Error("Organization record is missing for the publication.");
  }

  return organization.name;
}

export function getTeacherOwnedPublication(input: { teacherId: string; publicationId: string }) {
  const publication = getPublicationsState().publications.find((candidate) => candidate.id === input.publicationId);

  if (!publication || publication.teacherId !== input.teacherId) {
    throw new Error("Publication not found for this teacher.");
  }

  return publication;
}

function mapClassTargets(publication: PublicationRecord): PublicationClassSummary[] {
  const state = getPublicationsState();
  const classesState = getClassesState();

  return state.publicationClasses
    .filter((record) => record.publicationId === publication.id)
    .map((record) => {
      const classRecord = classesState.classes.find((candidate) => candidate.id === record.classId && candidate.status === "active");

      if (!classRecord) {
        throw new Error("Publication target class is missing.");
      }

      return {
        classId: classRecord.id,
        className: classRecord.name,
        classSlug: classRecord.slug,
        rosterCount: classesState.enrollments.filter((candidate) => candidate.classId === classRecord.id).length,
        defaultDeadline: publication.defaultDeadline,
        deadlineOverride: record.deadlineOverride,
        effectiveDeadline: record.deadlineOverride ?? publication.defaultDeadline,
      } satisfies PublicationClassSummary;
    })
    .sort((left, right) => left.className.localeCompare(right.className));
}

function mapPublicationSummary(publication: PublicationRecord): TeacherPublicationSummary {
  return {
    id: publication.id,
    templateId: publication.templateId,
    title: publication.title,
    organizationId: publication.organizationId,
    organizationName: getOrganizationName(publication.organizationId),
    defaultDeadline: publication.defaultDeadline,
    classCount: getPublicationsState().publicationClasses.filter((candidate) => candidate.publicationId === publication.id).length,
    linkedMaterialCount: publication.linkedMaterialIds.length,
    linkedTestCount: publication.linkedTestIds.length,
    createdAt: publication.createdAt,
    updatedAt: publication.updatedAt,
  };
}

export function listTeacherPublications(teacherId: string): TeacherPublicationSummary[] {
  const selectedOrganization = requireTeacherSelectedOrganization(teacherId);

  return getPublicationsState().publications
    .filter(
      (publication) =>
        publication.teacherId === teacherId && publication.organizationId === selectedOrganization.organizationId,
    )
    .map(mapPublicationSummary)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getTeacherPublicationDetail(input: { teacherId: string; publicationId: string }): TeacherPublicationDetail {
  const selectedOrganization = requireTeacherSelectedOrganization(input.teacherId);
  const publication = getTeacherOwnedPublication(input);

  if (publication.organizationId !== selectedOrganization.organizationId) {
    throw new Error("Publication is outside the active organization.");
  }

  const templateDetail = getTeacherAssignmentTemplateDetail({ teacherId: input.teacherId, templateId: publication.templateId });

  return {
    ...mapPublicationSummary(publication),
    description: publication.description,
    instructions: publication.instructions,
    linkedMaterials: templateDetail.linkedMaterials.filter((material) => publication.linkedMaterialIds.includes(material.id)),
    linkedTests: templateDetail.linkedTests.filter((testRecord) => publication.linkedTestIds.includes(testRecord.id)),
    classTargets: mapClassTargets(publication),
  };
}

export function publishAssignmentTemplate(input: {
  teacherId: string;
  templateId: string;
  defaultDeadline: string;
  classIds: string[];
  deadlineOverrides?: Record<string, string | undefined>;
}) {
  const selectedOrganization = requireTeacherSelectedOrganization(input.teacherId);
  const template = getTeacherAssignmentTemplateDetail({ teacherId: input.teacherId, templateId: input.templateId });

  if (template.organizationId !== selectedOrganization.organizationId) {
    throw new Error("Assignment template is outside the active organization.");
  }

  const classIds = [...new Set(input.classIds.filter(Boolean))];

  if (classIds.length === 0) {
    throw new Error("Select at least one class before publishing.");
  }

  const classesState = getClassesState();
  const availableClasses = classesState.classes.filter(
    (classRecord) =>
      classRecord.teacherId === input.teacherId &&
      classRecord.organizationId === selectedOrganization.organizationId &&
      classRecord.status === "active",
  );

  for (const classId of classIds) {
    if (!availableClasses.some((candidate) => candidate.id === classId)) {
      throw new Error("One or more selected classes are unavailable in the active organization ownership scope.");
    }
  }

  const defaultDeadline = normalizeDeadline(input.defaultDeadline, "Default deadline");
  const timestamp = new Date().toISOString();
  const state = getPublicationsState();
  const publication: PublicationRecord = {
    id: nextPublicationId(state.publications),
    templateId: template.id,
    teacherId: input.teacherId,
    organizationId: selectedOrganization.organizationId,
    title: template.title,
    description: template.description,
    instructions: template.instructions,
    linkedMaterialIds: template.linkedMaterials.map((material) => material.id),
    linkedTestIds: template.linkedTests.map((testRecord) => testRecord.id),
    defaultDeadline,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  state.publications.push(publication);

  for (const classId of classIds) {
    const overrideValue = input.deadlineOverrides?.[classId]?.trim();

    state.publicationClasses.push({
      id: nextPublicationClassId(state.publicationClasses),
      publicationId: publication.id,
      classId,
      deadlineOverride: overrideValue ? normalizeDeadline(overrideValue, "Class deadline override") : null,
      createdAt: timestamp,
    });
  }

  return getTeacherPublicationDetail({ teacherId: input.teacherId, publicationId: publication.id });
}
