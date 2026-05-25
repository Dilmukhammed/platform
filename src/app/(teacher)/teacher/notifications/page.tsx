import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

import { apiGet } from "@/lib/api/server-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import { markTeacherNotificationReadAction } from "@/modules/notifications/actions";
import { t } from "@/lib/translations";

interface NotificationItem {
  notificationId: string;
  type: string;
  payloadJson: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const notificationTypeLabels: Record<string, string> = {
  class_joined: t.teacher.notifications.types.classJoined,
  assignment_published: t.teacher.notifications.types.assignmentPublished,
  assignment_deadline_changed: t.teacher.notifications.types.assignmentDeadlineChanged,
  assignment_review_ready: t.teacher.notifications.types.assignmentReviewReady,
  review_completed: t.teacher.notifications.types.reviewCompleted,
  grade_updated: t.teacher.notifications.types.gradeUpdated,
  material_approved: t.teacher.notifications.types.materialApproved,
  material_rejected: t.teacher.notifications.types.materialRejected,
  test_approved: t.teacher.notifications.types.testApproved,
  test_rejected: t.teacher.notifications.types.testRejected,
  test_deletion_approved: t.teacher.notifications.types.testDeletionApproved,
  test_deletion_rejected: t.teacher.notifications.types.testDeletionRejected,
  org_approved: t.teacher.notifications.types.organizationApproved,
  org_rejected: t.teacher.notifications.types.organizationRejected,
  student_submitted: t.teacher.notifications.types.submissionReceived,
  student_joined_class: t.teacher.notifications.types.studentJoined,
};

const notificationTypeVariants: Record<string, "default" | "primary" | "success" | "warning" | "error" | "info"> = {
  class_joined: "success",
  assignment_published: "primary",
  assignment_deadline_changed: "warning",
  assignment_review_ready: "info",
  review_completed: "success",
  grade_updated: "success",
  material_approved: "success",
  material_rejected: "error",
  test_approved: "success",
  test_rejected: "error",
  test_deletion_approved: "success",
  test_deletion_rejected: "error",
  org_approved: "success",
  org_rejected: "error",
  student_submitted: "info",
  student_joined_class: "info",
};

export default async function TeacherNotificationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const page = typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;

  const response = await apiGet<{ data: NotificationItem[]; meta?: { unreadCount?: number; page?: number; pageSize?: number; total?: number } }>(
    `/api/v1/teacher/notifications?page=${page}`,
    { paginated: true }
  );
  const notifications = response.data;
  const unreadCount = response.meta?.unreadCount ?? notifications.filter((n) => !n.isRead).length;
  const total = response.meta?.total ?? notifications.length;
  const totalPages = response.meta?.pageSize ? Math.ceil(total / response.meta.pageSize) : 1;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.teacher.notifications.title}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {t.teacher.notifications.description}{" "}
          {unreadCount > 0 && (
            <span className="font-medium text-primary">
              {t.teacher.notifications.unread(unreadCount)}
            </span>
          )}
        </p>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title={t.teacher.notifications.emptyTitle}
              description={t.teacher.notifications.emptyDescription}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card
              key={notification.notificationId}
              className={notification.isRead ? "border-border" : "border-primary/30 bg-primary-subtle/30"}
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
                      {!notification.isRead && (
                        <Badge variant="primary" size="sm">
                          {t.teacher.notifications.types.unread}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground">
                      {(notification.payloadJson as { message?: string })?.message ?? notification.type.replace(/_/g, " ")}
                    </p>
                    {(notification.payloadJson as { rejectionReason?: string }).rejectionReason && (
                      <p className="text-sm text-error">
                        {t.teacher.notifications.reason((notification.payloadJson as { rejectionReason?: string }).rejectionReason ?? "")}
                      </p>
                    )}
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
                   {!notification.isRead && (
                     <form action={markTeacherNotificationReadAction}>
                       <input type="hidden" name="notificationId" value={notification.notificationId} />
<Button type="submit" variant="ghost" size="sm">
                          {t.teacher.notifications.markRead}
                        </Button>
                     </form>
                   )}
                 </div>
               </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-foreground-secondary">
            {t.teacher.notifications.pagination.pageOf(page, totalPages, total)}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={`/teacher/notifications?page=${page - 1}`}
                className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {t.teacher.notifications.pagination.previous}
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm text-foreground-muted cursor-not-allowed">
                {t.teacher.notifications.pagination.previous}
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={`/teacher/notifications?page=${page + 1}`}
                className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {t.teacher.notifications.pagination.next}
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm text-foreground-muted cursor-not-allowed">
                {t.teacher.notifications.pagination.next}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
