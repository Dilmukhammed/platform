import { bootstrapStaffAccounts } from "@/modules/auth/bootstrap-data";

import { getOrganizationsState } from "./store";
import type {
  OrganizationMembershipRecord,
  OrganizationRecord,
  PendingOrganizationApproval,
  TeacherOrganizationMembership,
} from "./types";

function normalizeOrganizationName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildUniqueSlug(baseSlug: string, existingSlugs: Set<string>) {
  const fallbackBase = baseSlug || "organization";

  if (!existingSlugs.has(fallbackBase)) {
    return fallbackBase;
  }

  let suffix = 2;
  while (existingSlugs.has(`${fallbackBase}-${suffix}`)) {
    suffix += 1;
  }

  return `${fallbackBase}-${suffix}`;
}

function nextOrganizationId(organizations: OrganizationRecord[]) {
  return `30000000-0000-4000-8000-${String(organizations.length + 1).padStart(12, "0")}`;
}

function nextMembershipId(memberships: OrganizationMembershipRecord[]) {
  return `31000000-0000-4000-8000-${String(memberships.length + 1).padStart(12, "0")}`;
}

function compareNewestFirst(left: string, right: string) {
  return right.localeCompare(left);
}

export function listTeacherOrganizationMemberships(teacherId: string): TeacherOrganizationMembership[] {
  const state = getOrganizationsState();
  const selectedOrganizationId = state.teacherSelections[teacherId] ?? null;

  return state.memberships
    .filter((membership) => membership.teacherId === teacherId)
    .map((membership) => {
      const organization = state.organizations.find((candidate) => candidate.id === membership.organizationId);

      if (!organization) {
        throw new Error(`Organization ${membership.organizationId} is missing for membership ${membership.id}.`);
      }

      const canSelect = organization.status === "active" && membership.status === "active";

      return {
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        organizationStatus: organization.status,
        membershipStatus: membership.status,
        membershipRole: membership.role,
        canSelect,
        isSelected: canSelect && selectedOrganizationId === organization.id,
        joinedAt: membership.joinedAt,
      } satisfies TeacherOrganizationMembership;
    })
    .sort((left, right) => compareNewestFirst(left.joinedAt, right.joinedAt));
}

export function getTeacherSelectedOrganization(teacherId: string) {
  return listTeacherOrganizationMemberships(teacherId).find((membership) => membership.isSelected) ?? null;
}

export function listPendingOrganizationApprovals(): PendingOrganizationApproval[] {
  const state = getOrganizationsState();

  return state.organizations
    .filter((organization) => organization.status === "pending")
    .map((organization) => {
      const teacher = bootstrapStaffAccounts.find((account) => account.id === organization.createdByTeacherId);

      if (!teacher) {
        throw new Error(`Teacher ${organization.createdByTeacherId} is missing for organization ${organization.id}.`);
      }

      return {
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        requestedByTeacherId: teacher.id,
        requestedByTeacherName: teacher.displayName,
        requestedByTeacherEmail: teacher.email,
        requestedAt: organization.createdAt,
      } satisfies PendingOrganizationApproval;
    })
    .sort((left, right) => compareNewestFirst(left.requestedAt, right.requestedAt));
}

export function listOrganizationsForAdmin() {
  const state = getOrganizationsState();

  return state.organizations
    .map((organization) => ({
      ...organization,
      membershipsCount: state.memberships.filter((membership) => membership.organizationId === organization.id).length,
    }))
    .sort((left, right) => compareNewestFirst(left.createdAt, right.createdAt));
}

export function createOrganizationRequest(input: { teacherId: string; name: string }) {
  const state = getOrganizationsState();
  const name = normalizeOrganizationName(input.name);

  if (name.length < 3) {
    throw new Error("Organization name must be at least 3 characters.");
  }

  const slug = buildUniqueSlug(
    slugify(name),
    new Set(state.organizations.map((organization) => organization.slug)),
  );
  const timestamp = new Date().toISOString();
  const organization: OrganizationRecord = {
    id: nextOrganizationId(state.organizations),
    name,
    slug,
    status: "pending",
    createdByTeacherId: input.teacherId,
    approvedByAdminId: null,
    createdAt: timestamp,
    approvedAt: null,
  };
  const membership: OrganizationMembershipRecord = {
    id: nextMembershipId(state.memberships),
    organizationId: organization.id,
    teacherId: input.teacherId,
    role: "owner",
    status: "pending",
    joinedAt: timestamp,
  };

  state.organizations.push(organization);
  state.memberships.push(membership);

  return organization;
}

export function approveOrganization(input: { organizationId: string; adminId: string }) {
  const state = getOrganizationsState();
  const organization = state.organizations.find((candidate) => candidate.id === input.organizationId);

  if (!organization) {
    throw new Error("Organization request not found.");
  }

  if (organization.status === "active") {
    return organization;
  }

  const approvedAt = new Date().toISOString();
  organization.status = "active";
  organization.approvedByAdminId = input.adminId;
  organization.approvedAt = approvedAt;

  for (const membership of state.memberships) {
    if (membership.organizationId === organization.id) {
      membership.status = "active";
    }
  }

  const existingSelection = state.teacherSelections[organization.createdByTeacherId];
  if (!existingSelection) {
    state.teacherSelections[organization.createdByTeacherId] = organization.id;
  }

  return organization;
}

export function selectTeacherOrganization(input: { teacherId: string; organizationId: string }) {
  const state = getOrganizationsState();
  const membership = state.memberships.find(
    (candidate) =>
      candidate.teacherId === input.teacherId &&
      candidate.organizationId === input.organizationId &&
      candidate.status === "active",
  );
  const organization = state.organizations.find(
    (candidate) => candidate.id === input.organizationId && candidate.status === "active",
  );

  if (!membership || !organization) {
    throw new Error("Only active teacher memberships can be selected.");
  }

  state.teacherSelections[input.teacherId] = organization.id;
  return organization;
}
