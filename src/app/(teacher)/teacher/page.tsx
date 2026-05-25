import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { t } from "@/lib/translations";
import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate, formatRelativeTime } from "@/lib/format-date";
import { DashboardErrorPanel } from "@/components/ui/dashboard-error-panel";
import { RoleAreaLoading } from "@/components/ui/role-area-loading";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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
import {
  getTeacherOnboardingState,
  listTeacherAssignmentPublications,
  listTeacherClasses,
  listTeacherNotifications,
  listTeacherPendingReviews,
  type TeacherAssignmentPublicationSummary,
  type TeacherClassSummary,
  type TeacherNotificationSummary,
  type TeacherPendingReviewSummary,
} from "@/modules/teachers/server-data";

// ============================================================================
// Types
// ============================================================================

type PendingReviewItem = TeacherPendingReviewSummary;
type ClassItem = TeacherClassSummary;
type PublicationItem = TeacherAssignmentPublicationSummary;
type NotificationItem = TeacherNotificationSummary;

// ============================================================================
// Helper Functions
// ============================================================================


// ============================================================================
// Skeleton Components
// ============================================================================

function DashboardSkeleton() {
  return <RoleAreaLoading variant="teacher" />;
}

// ============================================================================
// Section Components
// ============================================================================

function PendingReviewsSection({ reviews }: { reviews: PendingReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.teacher.dashboard.pendingReviews.title}</CardTitle>
          <CardDescription>{t.teacher.dashboard.pendingReviews.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<ClipboardCheckIcon />}
            title={t.teacher.dashboard.pendingReviews.emptyTitle}
            description={t.teacher.dashboard.pendingReviews.emptyDescription}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t.teacher.dashboard.pendingReviews.title}</CardTitle>
            <CardDescription>{t.teacher.dashboard.pendingReviews.description}</CardDescription>
          </div>
          <Badge variant="warning" size="sm">
            {t.teacher.dashboard.pendingReviews.pendingCount(reviews.length)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {reviews.slice(0, 3).map((review) => (
            <div
              key={review.assignmentResultId}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/teacher/reviews/${review.assignmentResultId}`}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {review.assignment.title ?? t.teacher.dashboard.pendingReviews.untitledAssignment}
                </Link>
                <p className="mt-1 text-sm text-foreground-secondary">
                  {(review.student.displayName ?? t.teacher.dashboard.pendingReviews.unknownStudent)} ({review.student.studentLogin ?? t.teacher.dashboard.pendingReviews.noLogin}) • {review.class.title ?? t.teacher.dashboard.pendingReviews.unknownClass}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {review.practiceSubmittedAt && (
                    <Badge variant="default" size="sm">
                      {t.teacher.dashboard.pendingReviews.practical}
                    </Badge>
                  )}
                  {review.testSubmittedAt && (
                    <Badge variant="default" size="sm">
                      {t.teacher.dashboard.pendingReviews.test}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusChip status="warning" size="sm">
                  {t.teacher.dashboard.pendingReviews.needsReview}
                </StatusChip>
                <span className="text-xs text-foreground-secondary">
                  {t.teacher.dashboard.pendingReviews.submitted(formatRelativeTime(review.testSubmittedAt || review.practiceSubmittedAt || new Date().toISOString()))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      {reviews.length > 3 && (
        <CardFooter>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/teacher/reviews">{t.teacher.dashboard.pendingReviews.viewAll}</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function ClipboardCheckIcon() {
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
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function ClassesSummarySection({ classes }: { classes: ClassItem[] }) {
  if (classes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.teacher.dashboard.classes.title}</CardTitle>
          <CardDescription>{t.teacher.dashboard.classes.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<ClassIcon />}
            title={t.teacher.dashboard.classes.emptyTitle}
            description={t.teacher.dashboard.classes.emptyDescription}
            action={
              <Button asChild>
                <Link href="/teacher/classes/new">{t.teacher.dashboard.classes.createClass}</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t.teacher.dashboard.classes.title}</CardTitle>
            <CardDescription>{t.teacher.dashboard.classes.description}</CardDescription>
          </div>
          <Badge variant="primary" size="sm">
            {classes.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {classes.slice(0, 3).map((classItem) => (
            <Link
              key={classItem.classId}
              href={`/teacher/classes/${classItem.classId}`}
              className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{classItem.title}</p>
                {classItem.description && (
                  <p className="truncate text-xs text-foreground-secondary">
                    {classItem.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {classItem.isPrimary && (
                  <Badge variant="default" size="sm">{t.teacher.dashboard.classes.owner}</Badge>
                )}
                <StatusChip
                  status={classItem.status === "active" ? "success" : "warning"}
                  size="sm"
                  showDot={false}
                  label={classItem.status === "active" ? t.teacher.dashboard.classes.active : t.teacher.dashboard.classes.draft}
                />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
      {classes.length > 3 && (
        <CardFooter>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/teacher/classes">{t.teacher.dashboard.classes.viewAll}</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function ClassIcon() {
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
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

function ActivePublicationsSection({ publications }: { publications: PublicationItem[] }) {
  const activePublications = publications.filter((p) => p.status === "active" || p.status === "published");

  if (activePublications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.teacher.dashboard.activeAssignments.title}</CardTitle>
          <CardDescription>{t.teacher.dashboard.activeAssignments.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<AssignmentIcon />}
            title={t.teacher.dashboard.activeAssignments.emptyTitle}
            description={t.teacher.dashboard.activeAssignments.emptyDescription}
            action={
              <Button asChild>
                <Link href="/teacher/assignments">{t.teacher.dashboard.activeAssignments.createAssignment}</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t.teacher.dashboard.activeAssignments.title}</CardTitle>
            <CardDescription>{t.teacher.dashboard.activeAssignments.description}</CardDescription>
          </div>
          <Badge variant="primary" size="sm">
            {t.teacher.dashboard.activeAssignments.activeCount(activePublications.length)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.teacher.dashboard.activeAssignments.assignment}</TableHead>
              <TableHead className="text-right">{t.teacher.dashboard.activeAssignments.classes}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activePublications.slice(0, 3).map((pub) => (
              <TableRow key={pub.publicationId}>
                <TableCell>
                  <Link
                    href={`/teacher/assignments/${pub.templateId}`}
                    className="block hover:text-primary"
                  >
                    <p className="font-medium">{pub.templateTitle}</p>
                    <p className="text-xs text-foreground-secondary">
                      {t.teacher.dashboard.activeAssignments.published(formatDate(pub.publishedAt))}
                    </p>
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="default" size="sm">
                    {t.teacher.dashboard.activeAssignments.classCount(pub.classCount)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {activePublications.length > 3 && (
        <CardFooter>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/teacher/publications">{t.teacher.dashboard.activeAssignments.viewAll}</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function AssignmentIcon() {
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
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function NotificationsPreview({ notifications }: { notifications: NotificationItem[] }) {
  const unreadCount = notifications.length;
  const latestNotification = notifications[0];

  if (unreadCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle text-primary">
        <NotificationIcon />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">
          {t.teacher.dashboard.notifications.unreadCount(unreadCount)}
        </p>
        {latestNotification && (
          <p className="truncate text-sm text-foreground-secondary">
            {t.teacher.dashboard.notifications.latest(getNotificationPreview(latestNotification))}
          </p>
        )}
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/teacher/notifications">{t.teacher.dashboard.notifications.viewAll}</Link>
      </Button>
    </div>
  );
}

function NotificationIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
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

function getNotificationPreview(notification: NotificationItem): string {
  const payload = notification.payloadJson;
  switch (notification.type) {
    case "assignment_submitted":
      return t.teacher.dashboard.notifications.preview.assignmentSubmitted((payload.assignmentTitle as string) || t.teacher.dashboard.notifications.preview.available);
    case "review_released":
      return t.teacher.dashboard.notifications.preview.reviewCompleted((payload.assignmentTitle as string) || t.teacher.dashboard.notifications.preview.assignment);
    case "class_announcement":
      return t.teacher.dashboard.notifications.preview.classAnnouncement((payload.className as string) || t.teacher.dashboard.notifications.preview.yourClass);
    default:
      return t.teacher.dashboard.notifications.preview.newNotification;
  }
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

async function TeacherDashboardContent({
  session,
}: {
  session: Awaited<ReturnType<typeof requireAreaAccess>>;
}) {
  let pendingReviews: PendingReviewItem[] = [];
  let classes: ClassItem[] = [];
  let publications: PublicationItem[] = [];
  let notifications: NotificationItem[] = [];
  let errors: { section: string; error: Error }[] = [];

  // Fetch all data in parallel
  const [reviewsRes, classesRes, publicationsRes, notificationsRes] = await Promise.allSettled([
    listTeacherPendingReviews(session.userId),
    listTeacherClasses(session.userId),
    listTeacherAssignmentPublications(session.userId, { status: "published" }),
    listTeacherNotifications(session.userId, { read: false }),
  ]);

  if (reviewsRes.status === "fulfilled") {
    pendingReviews = reviewsRes.value.reviews;
  } else {
    errors.push({ section: "pending reviews", error: reviewsRes.reason as Error });
  }

  if (classesRes.status === "fulfilled") {
    classes = classesRes.value;
  } else {
    errors.push({ section: "classes", error: classesRes.reason as Error });
  }

  if (publicationsRes.status === "fulfilled") {
    publications = publicationsRes.value;
  } else {
    errors.push({ section: "publications", error: publicationsRes.reason as Error });
  }

  if (notificationsRes.status === "fulfilled") {
    notifications = notificationsRes.value;
  } else {
    errors.push({ section: "notifications", error: notificationsRes.reason as Error });
  }

  return (
    <section className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-h1 font-bold text-foreground">
          {t.teacher.dashboard.welcomeBack(session.displayName)}
        </h1>
        <p className="mt-2 text-body text-foreground-secondary">
          {t.teacher.dashboard.intro}
        </p>
      </div>

      {/* Notifications Preview */}
      <NotificationsPreview notifications={notifications} />

      {/* Error Panel */}
      {errors.length > 0 && (
        <DashboardErrorPanel
          title={t.teacher.dashboard.errors.title}
          message={t.teacher.dashboard.errors.message(errors.map((e) => t.teacher.dashboard.errors.sections[e.section as keyof typeof t.teacher.dashboard.errors.sections]).join(", "))}
        />
      )}

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Reviews - Primary (2 columns) */}
        <div className="lg:col-span-2">
          <PendingReviewsSection reviews={pendingReviews} />
        </div>

        {/* Side Panel - Classes & Publications */}
        <div className="space-y-6">
          {/* Classes Summary - Tertiary */}
          <ClassesSummarySection classes={classes} />

          {/* Active Publications - Secondary */}
          <ActivePublicationsSection publications={publications} />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Page Export with Onboarding Check
// ============================================================================

async function TeacherPageWithOnboardingCheck() {
  const session = await requireAreaAccess("teacher");
  const onboardingState = await getTeacherOnboardingState(session.userId);

  if (onboardingState === "no_org") {
    redirect("/teacher/onboarding");
  }
  
  if (onboardingState === "pending_approval") {
    redirect("/teacher/pending-approval");
  }

  return <TeacherDashboardContent session={session} />;
}

export default function TeacherDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <TeacherPageWithOnboardingCheck />
    </Suspense>
  );
}
