import { describe, expect, test } from "bun:test";

import {
  approveOrganization,
  createOrganizationRequest,
  getTeacherSelectedOrganization,
  listPendingOrganizationApprovals,
  listTeacherOrganizationMemberships,
  resetOrganizationsState,
  selectTeacherOrganization,
} from "./helpers/organizations-stub";

const teacherId = "20000000-0000-4000-8000-000000000002";
const adminId = "20000000-0000-4000-8000-000000000001";

describe("organization approval flow", () => {
  test("teacher request creates a pending organization and membership", () => {
    resetOrganizationsState();

    const organization = createOrganizationRequest({
      teacherId,
      name: "East Technical School",
    });

    const memberships = listTeacherOrganizationMemberships(teacherId);
    const createdMembership = memberships.find((membership) => membership.organizationId === organization.id);

    expect(organization.status).toBe("pending");
    expect(createdMembership).toBeDefined();
    expect(createdMembership?.membershipStatus).toBe("pending");
    expect(createdMembership?.canSelect).toBe(false);
  });

  test("admin approval activates the organization and membership for teacher workflows", () => {
    resetOrganizationsState();

    const organization = createOrganizationRequest({
      teacherId,
      name: "South Engineering Lyceum",
    });

    approveOrganization({
      organizationId: organization.id,
      adminId,
    });

    const memberships = listTeacherOrganizationMemberships(teacherId);
    const approvedMembership = memberships.find((membership) => membership.organizationId === organization.id);

    expect(approvedMembership?.organizationStatus).toBe("active");
    expect(approvedMembership?.membershipStatus).toBe("active");
    expect(approvedMembership?.canSelect).toBe(true);
  });

  test("teacher can only select organizations after admin approval", () => {
    resetOrganizationsState();

    const organization = createOrganizationRequest({
      teacherId,
      name: "Central Design School",
    });

    expect(() =>
      selectTeacherOrganization({
        teacherId,
        organizationId: organization.id,
      }),
    ).toThrow("Only active teacher memberships can be selected.");

    approveOrganization({ organizationId: organization.id, adminId });
    selectTeacherOrganization({ teacherId, organizationId: organization.id });

    expect(getTeacherSelectedOrganization(teacherId)?.organizationId).toBe(organization.id);
  });

  test("admin queue lists seeded pending request until approved", () => {
    resetOrganizationsState();

    const pendingBefore = listPendingOrganizationApprovals();
    expect(pendingBefore.some((organization) => organization.organizationSlug === "north-drafting-academy")).toBe(true);

    const seededPending = pendingBefore.find((organization) => organization.organizationSlug === "north-drafting-academy");
    if (!seededPending) {
      throw new Error("Expected seeded pending organization.");
    }

    approveOrganization({ organizationId: seededPending.organizationId, adminId });

    const pendingAfter = listPendingOrganizationApprovals();
    expect(pendingAfter.some((organization) => organization.organizationId === seededPending.organizationId)).toBe(false);
  });
});
