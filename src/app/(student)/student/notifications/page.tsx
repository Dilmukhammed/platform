import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
import {
  listStudentNotifications,
  type StudentNotificationSummary as NotificationItem,
} from "@/modules/students/server-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import { MarkReadButton } from "./MarkReadButton";

const notificationTypeLabels: Record<string, string> = {
  class_joined: t.student.notifications.types.classJoined,
  assignment_published: t.student.notifications.types.assignmentPublished,
  assignment_deadline_changed: t.student.notifications.types.assignmentDeadlineChanged,
  review_completed: t.student.notifications.types.reviewCompleted,
  grade_updated: t.student.notifications.types.gradeUpdated,
  material_approved: t.student.notifications.types.materialApproved,
  material_rejected: t.student.notifications.types.materialRejected,
  test_approved: t.student.notifications.types.testApproved,
  test_rejected: t.student.notifications.types.testRejected,
  org_approved: t.student.notifications.types.organizationApproved,
  org_rejected: t.student.notifications.types.organizationRejected,
  student_submitted: t.student.notifications.types.submissionReceived,
  student_joined_class: t.student.notifications.types.studentJoined,
};

const notificationTypeVariants: Record<string, "default" | "primary" | "success" | "warning" | "error" | "info"> = {
  class_joined: "success",
  assignment_published: "primary",
  assignment_deadline_changed: "warning",
  review_completed: "success",
  grade_updated: "success",
  material_approved: "success",
  material_rejected: "error",
  test_approved: "success",
  test_rejected: "error",
  org_approved: "success",
  org_rejected: "error",
  student_submitted: "info",
  student_joined_class: "info",
};

export default async function StudentNotificationsPage() {
  const session = await requireAreaAccess("student");
  let notifications: NotificationItem[] = [];
  let error: string | null = null;

  try {
    const result = await listStudentNotifications(session.userId);
    notifications = result.data;
  } catch (err) {
    error = err instanceof Error ? err.message : t.student.notifications.description;
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.student.notifications.title}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {t.student.notifications.description}{" "}
          {unreadCount > 0 && (
            <span className="font-medium text-primary">
              {t.student.notifications.unread(unreadCount)}
            </span>
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          {error}
        </div>
      )}

      {!error && (
        notifications.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={<Inbox className="h-6 w-6" />}
                title={t.student.notifications.emptyTitle}
                description={t.student.notifications.emptyDescription}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={notification.readAt ? "border-border" : "border-primary/30 bg-primary-subtle/30"}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={notificationTypeVariants[notification.type] ?? "default"}
                          size="sm"
                        >
                          {notificationTypeLabels[notification.type] ?? notification.type.replace(/_/g, " ")}
                        </Badge>
                        {!notification.readAt && (
                          <Badge variant="primary" size="sm">
                            {t.student.notifications.types.unread}
                          </Badge>
                        )}
                      </div>
<p className="text-sm text-foreground">
                        {typeof notification.payload.message === "string" && notification.payload.message
                          ? notification.payload.message
                          : notificationTypeLabels[notification.type] ?? notification.type}
                        </p>
                      <p className="text-xs text-foreground-secondary">
                        {new Date(notification.createdAt).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!notification.readAt && (
                      <MarkReadButton notificationId={notification.id} />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </section>
  );
}
