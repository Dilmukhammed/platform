import type { ClassesState } from "./types";

export const classesBootstrapState: ClassesState = {
  classes: [
    {
      id: "60000000-0000-4000-8000-000000000001",
      organizationId: "30000000-0000-4000-8000-000000000001",
      teacherId: "20000000-0000-4000-8000-000000000002",
      name: "Orthographic Projection Basics",
      slug: "orthographic-projection-basics",
      description: "Seeded baseline class for teacher classes and roster workflows.",
      status: "active",
      createdAt: "2026-04-10T09:05:00.000Z",
      updatedAt: "2026-04-10T09:25:00.000Z",
    },
  ],
  enrollments: [
    {
      id: "61000000-0000-4000-8000-000000000001",
      classId: "60000000-0000-4000-8000-000000000001",
      studentId: "50000000-0000-4000-8000-000000000001",
      studentDisplayName: "Alex Morozov",
      studentLogin: "ST-100001",
      joinedAt: "2026-04-10T09:20:00.000Z",
      enrollmentSource: "seeded",
    },
    {
      id: "61000000-0000-4000-8000-000000000002",
      classId: "60000000-0000-4000-8000-000000000001",
      studentId: "50000000-0000-4000-8000-000000000002",
      studentDisplayName: "Irina Sokolova",
      studentLogin: "ST-100002",
      joinedAt: "2026-04-10T09:22:00.000Z",
      enrollmentSource: "seeded",
    },
  ],
};
