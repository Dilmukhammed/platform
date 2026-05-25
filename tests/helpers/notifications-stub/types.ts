export type NotificationType =
  | "class_joined"
  | "assignment_published"
  | "assignment_deadline_changed"
  | "review_completed"
  | "grade_updated"
  | "material_approved"
  | "material_rejected"
  | "test_approved"
  | "test_rejected"
  | "org_approved"
  | "org_rejected"
  | "student_submitted"
  | "student_joined_class";

export type NotificationRecipientType = "student" | "teacher" | "admin";

export type NotificationRecord = {
  id: string;
  actorType: "system" | "teacher" | "admin" | "student";
  actorId: string | null;
  recipientType: NotificationRecipientType;
  recipientId: string;
  type: NotificationType;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsState = {
  notifications: NotificationRecord[];
};
