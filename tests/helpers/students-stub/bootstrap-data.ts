import type { StudentsState } from "./types";

export const studentsBootstrapState: StudentsState = {
  profiles: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      studentLogin: "ST-100001",
      firstName: "Alex",
      lastName: "Morozov",
      displayName: "Alex Morozov",
      status: "active",
      createdAt: "2026-04-10T09:10:00.000Z",
      updatedAt: "2026-04-10T09:10:00.000Z",
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      studentLogin: "ST-100002",
      firstName: "Irina",
      lastName: "Sokolova",
      displayName: "Irina Sokolova",
      status: "active",
      createdAt: "2026-04-10T09:12:00.000Z",
      updatedAt: "2026-04-10T09:12:00.000Z",
    },
  ],
  credentials: [
    {
      id: "52000000-0000-4000-8000-000000000001",
      studentId: "50000000-0000-4000-8000-000000000001",
      pinHash: "$2b$10$OHg3xVXNN8PdcXnOVrQ/YuC5F9Tw1ypSMHU2NuT72/JDUQ4Ehj3Ey",
      status: "active",
      lastPinChangedAt: "2026-04-10T09:10:00.000Z",
    },
    {
      id: "52000000-0000-4000-8000-000000000002",
      studentId: "50000000-0000-4000-8000-000000000002",
      pinHash: "$2b$10$OHg3xVXNN8PdcXnOVrQ/YuC5F9Tw1ypSMHU2NuT72/JDUQ4Ehj3Ey",
      status: "active",
      lastPinChangedAt: "2026-04-10T09:12:00.000Z",
    },
  ],
  organizationStudents: [
    {
      id: "53000000-0000-4000-8000-000000000001",
      organizationId: "30000000-0000-4000-8000-000000000001",
      studentId: "50000000-0000-4000-8000-000000000001",
      status: "active",
      joinedAt: "2026-04-10T09:15:00.000Z",
    },
    {
      id: "53000000-0000-4000-8000-000000000002",
      organizationId: "30000000-0000-4000-8000-000000000001",
      studentId: "50000000-0000-4000-8000-000000000002",
      status: "active",
      joinedAt: "2026-04-10T09:16:00.000Z",
    },
  ],
  latestBulkImportReport: null,
};
