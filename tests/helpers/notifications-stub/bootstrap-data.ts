import type { NotificationRecord } from "./types";

export const initialNotificationsData: NotificationRecord[] = [
  {
    id: "notif-0001",
    actorType: "system",
    actorId: null,
    recipientType: "student",
    recipientId: "50000000-0000-4000-8000-000000000001",
    type: "class_joined",
    payload: {
      message: "You joined Orthographic Projection Basics.",
      className: "Orthographic Projection Basics",
      classId: "60000000-0000-4000-8000-000000000001",
    },
    readAt: "2026-04-10T10:00:00.000Z",
    createdAt: "2026-04-10T09:20:00.000Z",
  },
  {
    id: "notif-0002",
    actorType: "teacher",
    actorId: "20000000-0000-4000-8000-000000000002",
    recipientType: "student",
    recipientId: "50000000-0000-4000-8000-000000000001",
    type: "assignment_published",
    payload: {
      message: "A new assignment has been published in Orthographic Projection Basics.",
      publicationTitle: "Orthographic Projection Basics",
      className: "Orthographic Projection Basics",
    },
    readAt: "2026-04-10T11:00:00.000Z",
    createdAt: "2026-04-10T10:30:00.000Z",
  },
  {
    id: "notif-0003",
    actorType: "teacher",
    actorId: "20000000-0000-4000-8000-000000000002",
    recipientType: "student",
    recipientId: "50000000-0000-4000-8000-000000000001",
    type: "review_completed",
    payload: {
      message: "Your submission has been reviewed. Check your results.",
      publicationTitle: "Orthographic Projection Basics",
    },
    readAt: null,
    createdAt: "2026-04-10T14:00:00.000Z",
  },
];
