import type { JoinCodesState } from "./types";

export const joinCodesBootstrapState: JoinCodesState = {
  records: [
    {
      id: "71000000-0000-4000-8000-000000000001",
      classId: "60000000-0000-4000-8000-000000000001",
      code: "120800",
      status: "rotated",
      createdAt: "2026-04-10T09:05:00.000Z",
      createdByTeacherId: "20000000-0000-4000-8000-000000000002",
      rotatedAt: "2026-04-10T09:25:00.000Z",
      rotatedByTeacherId: "20000000-0000-4000-8000-000000000002",
    },
    {
      id: "71000000-0000-4000-8000-000000000002",
      classId: "60000000-0000-4000-8000-000000000001",
      code: "120801",
      status: "active",
      createdAt: "2026-04-10T09:25:00.000Z",
      createdByTeacherId: "20000000-0000-4000-8000-000000000002",
      rotatedAt: null,
      rotatedByTeacherId: null,
    },
  ],
};
