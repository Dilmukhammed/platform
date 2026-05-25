import { getNotificationsState } from "./store";
import type { NotificationRecord, NotificationRecipientType, NotificationType } from "./types";

function generateId() {
  return `notif-${crypto.randomUUID()}`;
}

export const notificationsService = {
  createNotification(
    actorType: NotificationRecord["actorType"],
    actorId: string | null,
    recipientType: NotificationRecipientType,
    recipientId: string,
    type: NotificationType,
    payload: Record<string, string>,
  ): NotificationRecord {
    const state = getNotificationsState();
    const record: NotificationRecord = {
      id: generateId(),
      actorType,
      actorId,
      recipientType,
      recipientId,
      type,
      payload: { ...payload },
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    state.notifications.push(record);
    return record;
  },

  getInboxByRecipient(recipientType: NotificationRecipientType, recipientId: string): NotificationRecord[] {
    const all = getNotificationsState().notifications;
    return all
      .map((n, index) => ({ n, index }))
      .filter(({ n }) => n.recipientType === recipientType && n.recipientId === recipientId)
      .sort((a, b) => b.n.createdAt.localeCompare(a.n.createdAt) || b.index - a.index)
      .map(({ n }) => n);
  },

  markAsRead(notificationId: string): NotificationRecord {
    const state = getNotificationsState();
    const notification = state.notifications.find((n) => n.id === notificationId);

    if (!notification) {
      throw new Error(`Notification not found: ${notificationId}`);
    }

    notification.readAt = new Date().toISOString();
    return notification;
  },

  getUnreadCount(recipientType: NotificationRecipientType, recipientId: string): number {
    return getNotificationsState().notifications.filter(
      (n) => n.recipientType === recipientType && n.recipientId === recipientId && n.readAt === null,
    ).length;
  },
};
