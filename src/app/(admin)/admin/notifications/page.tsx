import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
import { t } from "@/lib/translations";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { listAdminNotifications } from "@/modules/admins/server-data";

// ============================================================================
// Types
// ============================================================================

interface NotificationItem {
  id: string;
  actorType: string;
  actorId: string | null;
  recipientType: string;
  recipientId: string;
  type: string;
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================


function getNotificationTypeLabel(type: string): { variant: "default" | "primary" | "success" | "warning" | "error" | "info"; label: string } {
  switch (type) {
    case "org_approved":
    case "material_approved":
    case "test_approved":
      return { variant: "success", label: t.admin.notificationsPage.approved };
    case "org_rejected":
    case "material_rejected":
    case "test_rejected":
      return { variant: "error", label: t.admin.notificationsPage.rejected };
    case "student_submitted":
    case "student_joined_class":
      return { variant: "info", label: t.admin.notificationsPage.student };
    case "assignment_published":
    case "assignment_deadline_changed":
      return { variant: "primary", label: t.admin.notificationsPage.assignment };
    case "review_completed":
    case "grade_updated":
      return { variant: "success", label: t.admin.notificationsPage.review };
    default:
      return { variant: "default", label: type.replace(/_/g, " ") };
  }
}

function getNotificationPreview(notification: NotificationItem): string {
  const payload = notification.payload;
  switch (notification.type) {
    case "org_approved":
      return t.admin.notificationsPage.orgApproved(payload.organizationName || t.admin.notificationsPage.unknown);
    case "org_rejected":
      return t.admin.notificationsPage.orgRejected(payload.organizationName || t.admin.notificationsPage.unknown);
    case "material_approved":
      return t.admin.notificationsPage.materialApproved(payload.materialTitle || t.admin.notificationsPage.unknown);
    case "material_rejected":
      return t.admin.notificationsPage.materialRejected(payload.materialTitle || t.admin.notificationsPage.unknown);
    case "test_approved":
      return t.admin.notificationsPage.testApproved(payload.testTitle || t.admin.notificationsPage.unknown);
    case "test_rejected":
      return t.admin.notificationsPage.testRejected(payload.testTitle || t.admin.notificationsPage.unknown);
    case "student_submitted":
      return t.admin.notificationsPage.newStudentSubmission;
    case "student_joined_class":
      return t.admin.notificationsPage.studentJoinedClass;
    case "assignment_published":
      return t.admin.notificationsPage.assignmentPublished(payload.assignmentTitle || t.admin.notificationsPage.unknown);
    case "review_completed":
      return t.admin.notificationsPage.reviewCompleted;
    default:
      return t.admin.notificationsPage.newNotification;
  }
}

// ============================================================================
// Skeleton Components
// ============================================================================

function NotificationsPageSkeleton() {
  return (
    <section className="space-y-6">
      {/* Header Skeleton */}
      <div>
        <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-8 w-64 animate-pulse rounded bg-surface-muted" />
        <div className="mt-3 h-4 w-96 animate-pulse rounded bg-surface-muted" />
      </div>

      {/* Table Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 w-40 animate-pulse rounded bg-surface-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-surface-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

// ============================================================================
// Icon Components
// ============================================================================

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

async function NotificationsPageContent() {
  await requireAreaAccess("admin");

  const notifications: NotificationItem[] = (await listAdminNotifications())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const unreadCount = notifications.filter((n) => n.readAt === null).length;

return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
          {t.admin.notificationsPage.heading}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">
          {t.admin.notificationsPage.title}
        </h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          {t.admin.notificationsPage.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="default" size="md">
            {t.admin.notificationsPage.total(notifications.length)}
          </Badge>
          {unreadCount > 0 && (
            <Badge variant="warning" size="md">
              {t.admin.notificationsPage.unread(unreadCount)}
            </Badge>
          )}
        </div>
      </div>

      {/* Notifications Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.admin.notificationsPage.notificationInbox}</CardTitle>
              <CardDescription>{t.admin.notificationsPage.allSystemNotifications}</CardDescription>
            </div>
            <Badge variant="default" size="sm">{t.admin.notificationsPage.notificationsCount(notifications.length)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <EmptyState
              icon={<BellIcon />}
              title={t.admin.notificationsPage.noNotifications}
              description={t.admin.notificationsPage.noNotificationsYet}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.notificationsPage.status}</TableHead>
                  <TableHead>{t.admin.notificationsPage.type}</TableHead>
                  <TableHead>{t.admin.notificationsPage.message}</TableHead>
                  <TableHead>{t.admin.notificationsPage.recipient}</TableHead>
                  <TableHead className="text-right">{t.admin.notificationsPage.date}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => {
                  const typeConfig = getNotificationTypeLabel(notification.type);
                  const isUnread = notification.readAt === null;
                  
                  return (
                    <TableRow 
                      key={notification.id} 
                      interactive
                      className={isUnread ? "bg-admin-subtle/5" : ""}
                    >
                      <TableCell>
                        {isUnread ? (
                          <StatusChip status="warning" size="sm">{t.admin.notificationsPage.unreadStatus}</StatusChip>
                        ) : (
                          <StatusChip status="success" size="sm">{t.admin.notificationsPage.readStatus}</StatusChip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={typeConfig.variant} size="sm">
                          {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {getNotificationPreview(notification)}
                        </p>
                        <p className="text-xs text-foreground-secondary">
                          {t.admin.notificationsPage.notificationId(notification.id.slice(0, 8))}
                        </p>
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        <Badge variant="default" size="sm">
                          {notification.recipientType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-foreground-secondary">
                        {formatDate(notification.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default function AdminNotificationsPage() {
  return (
    <Suspense fallback={<NotificationsPageSkeleton />}>
      <NotificationsPageContent />
    </Suspense>
  );
}
