import { createInitialJoinCodeForClass, getActiveJoinCodeForClass, listJoinCodeHistoryForClass, rotateJoinCode } from "@/modules/join-codes";
import { getTeacherSelectedOrganization, listTeacherOrganizationMemberships } from "../organizations-stub";

import { getClassesState } from "./store";
import type { ClassEnrollmentRecord, ClassRecord, TeacherClassDetail, TeacherClassSummary } from "./types";

function normalizeClassName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeDescription(description: string) {
  const normalized = description.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildUniqueSlug(baseSlug: string, existingSlugs: Set<string>) {
  const fallbackBase = baseSlug || "class";

  if (!existingSlugs.has(fallbackBase)) {
    return fallbackBase;
  }

  let suffix = 2;
  while (existingSlugs.has(`${fallbackBase}-${suffix}`)) {
    suffix += 1;
  }

  return `${fallbackBase}-${suffix}`;
}

function nextClassId(classes: ClassRecord[]) {
  return `60000000-0000-4000-8000-${String(classes.length + 1).padStart(12, "0")}`;
}

function mapRosterForClass(enrollments: ClassEnrollmentRecord[], classId: string) {
  return enrollments
    .filter((record) => record.classId === classId)
    .map((record) => ({ ...record }))
    .sort((left, right) => left.studentDisplayName.localeCompare(right.studentDisplayName));
}

function requireTeacherActiveOrganization(teacherId: string) {
  const selectedOrganization = getTeacherSelectedOrganization(teacherId);

  if (!selectedOrganization) {
    throw new Error("Select an approved organization before managing classes.");
  }

  const membership = listTeacherOrganizationMemberships(teacherId).find(
    (candidate) => candidate.organizationId === selectedOrganization.organizationId,
  );

  if (!membership || membership.membershipStatus !== "active" || membership.membershipRole !== "owner") {
    throw new Error("Only teachers with an active owner membership can manage classes.");
  }

  return selectedOrganization;
}

function mapSummary(classRecord: ClassRecord, teacherId: string): TeacherClassSummary {
  const selectedOrganization = requireTeacherActiveOrganization(teacherId);

  if (classRecord.teacherId !== teacherId || classRecord.organizationId !== selectedOrganization.organizationId) {
    throw new Error("Class is not available in the selected organization.");
  }

  const state = getClassesState();
  const activeJoinCode = getActiveJoinCodeForClass(classRecord.id);

  if (!activeJoinCode) {
    throw new Error(`Class ${classRecord.id} is missing an active join code.`);
  }

  return {
    id: classRecord.id,
    organizationId: classRecord.organizationId,
    organizationName: selectedOrganization.organizationName,
    name: classRecord.name,
    slug: classRecord.slug,
    description: classRecord.description,
    status: classRecord.status,
    rosterCount: state.enrollments.filter((record) => record.classId === classRecord.id).length,
    activeJoinCode: activeJoinCode.code,
    updatedAt: classRecord.updatedAt,
  };
}

export function listTeacherClasses(teacherId: string) {
  const selectedOrganization = requireTeacherActiveOrganization(teacherId);
  const state = getClassesState();

  return state.classes
    .filter(
      (classRecord) =>
        classRecord.teacherId === teacherId &&
        classRecord.organizationId === selectedOrganization.organizationId &&
        classRecord.status === "active",
    )
    .map((classRecord) => mapSummary(classRecord, teacherId))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getTeacherClassDetail(input: { teacherId: string; classId: string }): TeacherClassDetail {
  const state = getClassesState();
  const classRecord = state.classes.find((candidate) => candidate.id === input.classId && candidate.status === "active");

  if (!classRecord || classRecord.teacherId !== input.teacherId) {
    throw new Error("Class not found for this teacher.");
  }

  const summary = mapSummary(classRecord, input.teacherId);

  return {
    ...summary,
    createdAt: classRecord.createdAt,
    roster: mapRosterForClass(state.enrollments, classRecord.id),
  };
}

export function createClass(input: { teacherId: string; name: string; description?: string }) {
  const selectedOrganization = requireTeacherActiveOrganization(input.teacherId);
  const state = getClassesState();
  const name = normalizeClassName(input.name);
  const description = normalizeDescription(input.description ?? "");

  if (name.length < 3) {
    throw new Error("Class name must be at least 3 characters.");
  }

  const timestamp = new Date().toISOString();
  const classRecord: ClassRecord = {
    id: nextClassId(state.classes),
    organizationId: selectedOrganization.organizationId,
    teacherId: input.teacherId,
    name,
    slug: buildUniqueSlug(slugify(name), new Set(state.classes.map((record) => record.slug))),
    description,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  state.classes.push(classRecord);
  createInitialJoinCodeForClass({
    classId: classRecord.id,
    teacherId: input.teacherId,
    createdAt: timestamp,
  });

  return getTeacherClassDetail({ teacherId: input.teacherId, classId: classRecord.id });
}

export function rotateTeacherClassJoinCode(input: { teacherId: string; classId: string }) {
  const state = getClassesState();
  const classRecord = state.classes.find((candidate) => candidate.id === input.classId && candidate.status === "active");

  if (!classRecord || classRecord.teacherId !== input.teacherId) {
    throw new Error("Class not found for this teacher.");
  }

  requireTeacherActiveOrganization(input.teacherId);

  const rotation = rotateJoinCode({
    classId: input.classId,
    teacherId: input.teacherId,
  });

  classRecord.updatedAt = rotation.activeCode.createdAt;

  return {
    classDetail: getTeacherClassDetail(input),
    joinCodeHistory: listJoinCodeHistoryForClass(input.classId),
  };
}

export function listTeacherClassJoinCodeHistory(input: { teacherId: string; classId: string }) {
  getTeacherClassDetail(input);
  return listJoinCodeHistoryForClass(input.classId);
}
