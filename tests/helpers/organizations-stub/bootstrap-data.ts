import type { OrganizationsState } from "./types";

export const organizationsBootstrapState: OrganizationsState = {
  organizations: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      name: "Demo School",
      slug: "demo-school",
      status: "active",
      createdByTeacherId: "20000000-0000-4000-8000-000000000002",
      approvedByAdminId: "20000000-0000-4000-8000-000000000001",
      createdAt: "2026-04-10T09:00:00.000Z",
      approvedAt: "2026-04-10T09:15:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      name: "North Drafting Academy",
      slug: "north-drafting-academy",
      status: "pending",
      createdByTeacherId: "20000000-0000-4000-8000-000000000002",
      approvedByAdminId: null,
      createdAt: "2026-04-10T10:00:00.000Z",
      approvedAt: null,
    },
    {
      id: "accd528a-08b6-4da8-82dc-f01e1a643735",
      name: "Test Academy",
      slug: "test-academy",
      status: "active",
      createdByTeacherId: "27a9365d-e4fc-4477-acc4-faeba45576ad",
      approvedByAdminId: "20000000-0000-4000-8000-000000000001",
      createdAt: "2026-04-17T09:00:00.000Z",
      approvedAt: "2026-04-17T09:15:00.000Z",
    },
  ],
  memberships: [
    {
      id: "31000000-0000-4000-8000-000000000001",
      organizationId: "30000000-0000-4000-8000-000000000001",
      teacherId: "20000000-0000-4000-8000-000000000002",
      role: "owner",
      status: "active",
      joinedAt: "2026-04-10T09:15:00.000Z",
    },
    {
      id: "31000000-0000-4000-8000-000000000002",
      organizationId: "30000000-0000-4000-8000-000000000002",
      teacherId: "20000000-0000-4000-8000-000000000002",
      role: "owner",
      status: "pending",
      joinedAt: "2026-04-10T10:00:00.000Z",
    },
    {
      id: "31000000-0000-4000-8000-000000000003",
      organizationId: "accd528a-08b6-4da8-82dc-f01e1a643735",
      teacherId: "27a9365d-e4fc-4477-acc4-faeba45576ad",
      role: "owner",
      status: "active",
      joinedAt: "2026-04-17T09:15:00.000Z",
    },
  ],
  teacherSelections: {
    "20000000-0000-4000-8000-000000000002": "30000000-0000-4000-8000-000000000001",
    "27a9365d-e4fc-4477-acc4-faeba45576ad": "accd528a-08b6-4da8-82dc-f01e1a643735",
  },
};
