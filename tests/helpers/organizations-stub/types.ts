export type OrganizationStatus = "pending" | "active";

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdByTeacherId: string;
  approvedByAdminId: string | null;
  createdAt: string;
  approvedAt: string | null;
};

export type OrganizationMembershipStatus = "pending" | "active";

export type OrganizationMembershipRecord = {
  id: string;
  organizationId: string;
  teacherId: string;
  role: "owner";
  status: OrganizationMembershipStatus;
  joinedAt: string;
};

export type TeacherOrganizationMembership = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationStatus: OrganizationStatus;
  membershipStatus: OrganizationMembershipStatus;
  membershipRole: "owner";
  canSelect: boolean;
  isSelected: boolean;
  joinedAt: string;
};

export type PendingOrganizationApproval = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  requestedByTeacherId: string;
  requestedByTeacherName: string;
  requestedByTeacherEmail: string;
  requestedAt: string;
};

export type OrganizationsState = {
  organizations: OrganizationRecord[];
  memberships: OrganizationMembershipRecord[];
  teacherSelections: Record<string, string>;
};
