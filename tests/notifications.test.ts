import { describe, it, expect, beforeEach } from "bun:test";
import { resetNotificationsState, notificationsService } from "./helpers/notifications-stub";
import { getStudentRecipientNotification } from "./helpers/notifications-stub/access";

describe("Notifications", () => {
  beforeEach(() => {
    resetNotificationsState();
  });

  describe("createNotification", () => {
    it("stores record and returns it", () => {
      const result = notificationsService.createNotification(
        "system",
        null,
        "student",
        "student-test-001",
        "class_joined",
        { message: "Joined Math 101" },
      );

      expect(result.id).toBeTruthy();
      expect(result.actorType).toBe("system");
      expect(result.actorId).toBeNull();
      expect(result.recipientType).toBe("student");
      expect(result.recipientId).toBe("student-test-001");
      expect(result.type).toBe("class_joined");
      expect(result.payload.message).toBe("Joined Math 101");
      expect(result.readAt).toBeNull();
      expect(result.createdAt).toBeTruthy();
    });
  });

  describe("getInboxByRecipient", () => {
    it("returns only that recipient's notifications newest-first", () => {
      notificationsService.createNotification(
        "system", null, "student", "s1", "class_joined", { message: "First" },
      );
      notificationsService.createNotification(
        "system", null, "student", "s2", "class_joined", { message: "Other student" },
      );
      notificationsService.createNotification(
        "teacher", "t1", "student", "s1", "assignment_published", { message: "Second" },
      );

      const inbox = notificationsService.getInboxByRecipient("student", "s1");
      expect(inbox.length).toBe(2);
      // newest first
      expect(inbox[0].type).toBe("assignment_published");
      expect(inbox[1].type).toBe("class_joined");

      // other student should not appear
      const otherInbox = notificationsService.getInboxByRecipient("student", "s2");
      expect(otherInbox.length).toBe(1);
      expect(otherInbox[0].payload.message).toBe("Other student");
    });
  });

  describe("markAsRead", () => {
    it("sets readAt timestamp", () => {
      const created = notificationsService.createNotification(
        "system", null, "student", "s1", "class_joined", { message: "Test" },
      );

      expect(created.readAt).toBeNull();

      const updated = notificationsService.markAsRead(created.id);
      expect(updated.readAt).toBeTruthy();
      expect(typeof updated.readAt).toBe("string");
    });

    it("throws on non-existent id", () => {
      expect(() => {
        notificationsService.markAsRead("non-existent-id");
      }).toThrow("Notification not found: non-existent-id");
    });
  });

  describe("getUnreadCount", () => {
    it("returns correct count", () => {
      notificationsService.createNotification(
        "system", null, "student", "s1", "class_joined", { message: "A" },
      );
      notificationsService.createNotification(
        "system", null, "student", "s1", "assignment_published", { message: "B" },
      );
      notificationsService.createNotification(
        "system", null, "student", "s1", "review_completed", { message: "C" },
      );

      expect(notificationsService.getUnreadCount("student", "s1")).toBe(3);

      // mark one as read
      const inbox = notificationsService.getInboxByRecipient("student", "s1");
      notificationsService.markAsRead(inbox[0].id);

      expect(notificationsService.getUnreadCount("student", "s1")).toBe(2);
    });

    it("returns 0 when all read", () => {
      notificationsService.createNotification(
        "system", null, "student", "s1", "class_joined", { message: "A" },
      );
      notificationsService.createNotification(
        "system", null, "student", "s1", "assignment_published", { message: "B" },
      );

      const inbox = notificationsService.getInboxByRecipient("student", "s1");
      for (const n of inbox) {
        notificationsService.markAsRead(n.id);
      }

      expect(notificationsService.getUnreadCount("student", "s1")).toBe(0);
    });
  });

  describe("student recipient authorization", () => {
    it("does not expose another student's notification for mark-as-read", () => {
      const created = notificationsService.createNotification(
        "system",
        null,
        "student",
        "owner-student",
        "class_joined",
        { message: "Private notification" },
      );

      const unauthorizedView = getStudentRecipientNotification({
        studentId: "other-student",
        notificationId: created.id,
      });

      expect(unauthorizedView).toBeNull();
      expect(
        notificationsService.getInboxByRecipient("student", "owner-student").find((notification) => notification.id === created.id)
          ?.readAt,
      ).toBeNull();
    });
  });
});
