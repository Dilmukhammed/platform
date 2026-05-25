import { getNotificationsState } from "./store";

export function getStudentRecipientNotification(input: { studentId: string; notificationId: string }) {
  const notification = getNotificationsState().notifications.find((candidate) => candidate.id === input.notificationId) ?? null;

  if (!notification || notification.recipientType !== "student" || notification.recipientId !== input.studentId) {
    return null;
  }

  return notification;
}

export function getTeacherRecipientNotification(input: { teacherId: string; notificationId: string }) {
  const notification = getNotificationsState().notifications.find((candidate) => candidate.id === input.notificationId) ?? null;

  if (!notification || notification.recipientType !== "teacher" || notification.recipientId !== input.teacherId) {
    return null;
  }

  return notification;
}
