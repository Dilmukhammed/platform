import { bootstrapStaffAccounts } from "@/modules/auth/bootstrap-data";
import { getTeacherSelectedOrganization, getOrganizationsState } from "../organizations-stub";

import { getMaterialsState } from "./store";
import type { MaterialRecord, PendingSchoolMaterialApproval, SchoolLibraryMaterial, TeacherMaterialSummary } from "./types";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeDescription(value: string) {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function nextMaterialId(materials: MaterialRecord[]) {
  return `70000000-0000-4000-8000-${String(materials.length + 1).padStart(12, "0")}`;
}

function getTeacherAccount(teacherId: string) {
  const teacher = bootstrapStaffAccounts.find((account) => account.id === teacherId && account.role === "teacher");

  if (!teacher) {
    throw new Error("Teacher account is missing.");
  }

  return teacher;
}

function requireAdminAccount(adminId: string) {
  const admin = bootstrapStaffAccounts.find((account) => account.id === adminId && account.role === "super_admin");

  if (!admin) {
    throw new Error("Only admins can review school material submissions.");
  }

  return admin;
}

function getOrganizationName(organizationId: string) {
  const organization = getOrganizationsState().organizations.find((candidate) => candidate.id === organizationId);

  if (!organization) {
    throw new Error("Organization record is missing for the material.");
  }

  return organization.name;
}

function requireTeacherSelectedOrganization(teacherId: string) {
  const selectedOrganization = getTeacherSelectedOrganization(teacherId);

  if (!selectedOrganization) {
    throw new Error("Select an approved organization before managing materials.");
  }

  return selectedOrganization;
}

function getOwnedMaterial(input: { teacherId: string; materialId: string }) {
  const state = getMaterialsState();
  const material = state.materials.find((candidate) => candidate.id === input.materialId);

  if (!material || material.teacherId !== input.teacherId) {
    throw new Error("Material not found for this teacher.");
  }

  return material;
}

function getPendingMaterial(materialId: string) {
  const material = getMaterialsState().materials.find((candidate) => candidate.id === materialId);

  if (!material) {
    throw new Error("Material approval request not found.");
  }

  if (material.status !== "pending_school") {
    throw new Error("Only pending school submissions can be reviewed.");
  }

  return material;
}

function mapTeacherMaterial(material: MaterialRecord): TeacherMaterialSummary {
  return {
    id: material.id,
    title: material.title,
    description: material.description,
    organizationId: material.organizationId,
    organizationName: getOrganizationName(material.organizationId),
    status: material.status,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    submittedAt: material.submittedAt,
    approvedAt: material.approvedAt,
    rejectedAt: material.rejectedAt,
    rejectionReason: material.rejectionReason,
    canSubmitToSchool: material.status === "personal",
    visibleInSchoolLibrary: material.status === "approved_school",
  };
}

export function listTeacherMaterials(teacherId: string): TeacherMaterialSummary[] {
  const selectedOrganization = requireTeacherSelectedOrganization(teacherId);

  return getMaterialsState().materials
    .filter(
      (material) =>
        material.teacherId === teacherId &&
        material.organizationId === selectedOrganization.organizationId,
    )
    .map(mapTeacherMaterial)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createPersonalMaterial(input: { teacherId: string; title: string; description?: string }) {
  const selectedOrganization = requireTeacherSelectedOrganization(input.teacherId);
  const state = getMaterialsState();
  const title = normalizeText(input.title);
  const description = normalizeDescription(input.description ?? "");

  if (title.length < 3) {
    throw new Error("Material title must be at least 3 characters.");
  }

  const timestamp = new Date().toISOString();
  const material: MaterialRecord = {
    id: nextMaterialId(state.materials),
    teacherId: input.teacherId,
    organizationId: selectedOrganization.organizationId,
    title,
    description,
    status: "personal",
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: null,
    approvedAt: null,
    approvedByAdminId: null,
    rejectedAt: null,
    rejectedByAdminId: null,
    rejectionReason: null,
  };

  state.materials.push(material);
  return mapTeacherMaterial(material);
}

export function submitMaterialToSchool(input: { teacherId: string; materialId: string }) {
  const selectedOrganization = requireTeacherSelectedOrganization(input.teacherId);
  const material = getOwnedMaterial(input);

  if (material.organizationId !== selectedOrganization.organizationId) {
    throw new Error("Material is outside the active organization.");
  }

  if (material.status !== "personal") {
    throw new Error("Only personal materials can be submitted to the school library.");
  }

  const timestamp = new Date().toISOString();
  material.status = "pending_school";
  material.submittedAt = timestamp;
  material.updatedAt = timestamp;
  material.rejectedAt = null;
  material.rejectedByAdminId = null;
  material.rejectionReason = null;

  return mapTeacherMaterial(material);
}

export function listPendingSchoolMaterialApprovals(): PendingSchoolMaterialApproval[] {
  return getMaterialsState().materials
    .filter((material) => material.status === "pending_school" && material.submittedAt)
    .map((material) => {
      const teacher = getTeacherAccount(material.teacherId);

      return {
        materialId: material.id,
        title: material.title,
        description: material.description,
        organizationId: material.organizationId,
        organizationName: getOrganizationName(material.organizationId),
        requestedByTeacherId: teacher.id,
        requestedByTeacherName: teacher.displayName,
        requestedByTeacherEmail: teacher.email,
        submittedAt: material.submittedAt!,
      } satisfies PendingSchoolMaterialApproval;
    })
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export function approveSchoolMaterial(input: { materialId: string; adminId: string }) {
  requireAdminAccount(input.adminId);
  const material = getPendingMaterial(input.materialId);
  const timestamp = new Date().toISOString();

  material.status = "approved_school";
  material.updatedAt = timestamp;
  material.approvedAt = timestamp;
  material.approvedByAdminId = input.adminId;
  material.rejectedAt = null;
  material.rejectedByAdminId = null;
  material.rejectionReason = null;

  return mapTeacherMaterial(material);
}

export function rejectSchoolMaterial(input: { materialId: string; adminId: string; reason: string }) {
  requireAdminAccount(input.adminId);
  const material = getPendingMaterial(input.materialId);
  const reason = normalizeText(input.reason);

  if (reason.length < 3) {
    throw new Error("Rejection reason must be at least 3 characters.");
  }

  const timestamp = new Date().toISOString();
  material.status = "rejected_school";
  material.updatedAt = timestamp;
  material.rejectedAt = timestamp;
  material.rejectedByAdminId = input.adminId;
  material.rejectionReason = reason;
  material.approvedAt = null;
  material.approvedByAdminId = null;

  return mapTeacherMaterial(material);
}

export function listTeacherSchoolLibraryMaterials(teacherId: string): SchoolLibraryMaterial[] {
  const selectedOrganization = requireTeacherSelectedOrganization(teacherId);

  return getMaterialsState().materials
    .filter(
      (material) =>
        material.organizationId === selectedOrganization.organizationId &&
        material.status === "approved_school" &&
        material.approvedAt,
    )
    .map((material) => ({
      materialId: material.id,
      title: material.title,
      description: material.description,
      organizationId: material.organizationId,
      organizationName: selectedOrganization.organizationName,
      ownerTeacherId: material.teacherId,
      ownerTeacherName: getTeacherAccount(material.teacherId).displayName,
      approvedAt: material.approvedAt!,
    }))
    .sort((left, right) => right.approvedAt.localeCompare(left.approvedAt));
}
