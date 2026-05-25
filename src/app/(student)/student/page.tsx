import Link from "next/link";
import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
import { t } from "@/lib/translations";
import { DashboardErrorPanel } from "@/components/ui/dashboard-error-panel";
import { RoleAreaLoading } from "@/components/ui/role-area-loading";
import {
  listStudentAssignments,
  listStudentClasses,
  listStudentNotifications,
  listStudentResults,
  type StudentAssignmentSummary as AssignmentItem,
  type StudentClassSummary as ClassItem,
  type StudentNotificationSummary as NotificationItem,
  type StudentPaginatedResult as PaginatedResponse,
  type StudentResultSummary as ResultItem,
} from "@/modules/students/server-data";
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

// ============================================================================
// API Functions
// ============================================================================

async function fetchClasses(userId: string): Promise<PaginatedResponse<ClassItem>> {
  return listStudentClasses(userId);
}

async function fetchAssignments(userId: string): Promise<PaginatedResponse<AssignmentItem>> {
  return listStudentAssignments(userId);
}

async function fetchResults(userId: string): Promise<PaginatedResponse<ResultItem>> {
  return listStudentResults(userId);
}

async function fetchNotifications(userId: string): Promise<PaginatedResponse<NotificationItem>> {
  return listStudentNotifications(userId, { read: "false" });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAssignmentStatusChip(status: string): { status: "info" | "warning" | "success" | "error"; label: string } {
  switch (status) {
    case "not_started":
      return { status: "info", label: t.student.dashboard.assignmentStatus.notStarted };
    case "in_progress":
      return { status: "warning", label: t.student.dashboard.assignmentStatus.inProgress };
    case "submitted":
      return { status: "success", label: t.student.dashboard.assignmentStatus.submitted };
    case "reviewed":
      return { status: "info", label: t.student.dashboard.assignmentStatus.reviewed };
    case "released":
      return { status: "success", label: t.student.dashboard.assignmentStatus.released };
    default:
      return { status: "info", label: status };
  }
}

function isAssignmentActive(assignment: AssignmentItem): boolean {
  if (assignment.status === "submitted" || assignment.status === "released") {
    return false;
  }
  if (assignment.deadline) {
    return new Date(assignment.deadline) >= new Date();
  }
  return true;
}

function getGradeBadgeVariant(score: number | null): "default" | "primary" | "success" | "warning" | "error" {
  if (score === null) return "default";
  if (score >= 90) return "success";
  if (score >= 70) return "primary";
  if (score >= 50) return "warning";
  return "error";
}

// ============================================================================
// Skeleton Components
// ============================================================================

function DashboardSkeleton() {
  return <RoleAreaLoading variant="student" />;
}

// ============================================================================
// Section Components
// ============================================================================

function ActiveAssignmentsSection({ assignments }: { assignments: AssignmentItem[] }) {
  const activeAssignments = assignments.filter(isAssignmentActive);

if (activeAssignments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.student.dashboard.activeAssignments.title}</CardTitle>
          <CardDescription>{t.student.dashboard.activeAssignments.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<AssignmentIcon />}
            title={t.student.dashboard.activeAssignments.emptyTitle}
            description={t.student.dashboard.activeAssignments.emptyDescription}
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
            <CardTitle>{t.student.dashboard.activeAssignments.title}</CardTitle>
            <CardDescription>{t.student.dashboard.activeAssignments.description}</CardDescription>
          </div>
          <Badge variant="primary" size="sm">
            {t.student.dashboard.activeAssignments.pendingCount(activeAssignments.length)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeAssignments.map((assignment) => {
            const statusChip = getAssignmentStatusChip(assignment.status);
            return (
              <div
                key={assignment.assignmentResultId}
                className="flex items-start justify-between gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/student/assignments/${assignment.assignmentResultId}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {assignment.assignmentTitle}
                  </Link>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    {assignment.classTitle}
                  </p>
<div className="mt-2 flex flex-wrap items-center gap-2">
                    {assignment.hasPractice && (
                      <Badge variant="default" size="sm">
                        {t.student.dashboard.activeAssignments.practice}
                      </Badge>
                    )}
                    {assignment.hasTest && (
                      <Badge variant="default" size="sm">
                        {t.student.dashboard.activeAssignments.test}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusChip status={statusChip.status} size="sm">
                    {statusChip.label}
                  </StatusChip>
<span className="text-xs text-foreground-secondary">
                    {t.student.dashboard.activeAssignments.due(formatDate(assignment.deadline))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/student/assignments">{t.student.dashboard.activeAssignments.viewAll}</Link>
        </Button>
      </CardFooter>
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

function ClassesSummarySection({ classes }: { classes: ClassItem[] }) {
  if (classes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.student.dashboard.classes.title}</CardTitle>
          <CardDescription>{t.student.dashboard.classes.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<ClassIcon />}
            title={t.student.dashboard.classes.emptyTitle}
            description={t.student.dashboard.classes.emptyDescription}
            action={
              <Button asChild>
                <Link href="/join">{t.student.dashboard.classes.enterClassCode}</Link>
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
            <CardTitle>{t.student.dashboard.classes.title}</CardTitle>
            <CardDescription>{t.student.dashboard.classes.description}</CardDescription>
          </div>
          <Badge variant="primary" size="sm">
            {classes.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {classes.slice(0, 5).map((classItem) => (
            <Link
              key={classItem.classId}
              href={`/student/classes/${classItem.classId}`}
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
              <StatusChip
                status={classItem.status === "active" ? "success" : "warning"}
                size="sm"
                showDot={false}
                label={classItem.status === "active" ? t.student.dashboard.classes.active : t.student.dashboard.classes.inactive}
              />
            </Link>
          ))}
        </div>
      </CardContent>
      {classes.length > 5 && (
        <CardFooter>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/student/classes">{t.student.dashboard.classes.viewAll}</Link>
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

function RecentResultsSection({ results }: { results: ResultItem[] }) {
  const recentResults = results.slice(0, 5);

  if (recentResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.student.dashboard.results.title}</CardTitle>
          <CardDescription>{t.student.dashboard.results.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<GradeIcon />}
            title={t.student.dashboard.results.emptyTitle}
            description={t.student.dashboard.results.emptyDescription}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.student.dashboard.results.title}</CardTitle>
        <CardDescription>{t.student.dashboard.results.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.student.results.table.headers.assignment}</TableHead>
              <TableHead className="text-right">{t.student.results.table.headers.grade}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentResults.map((result) => (
              <TableRow key={result.assignmentResultId} interactive>
                <TableCell>
                  <Link
                    href={`/student/results/${result.assignmentResultId}`}
                    className="block hover:text-primary"
                  >
                    <p className="font-medium">{result.assignmentTitle}</p>
                    <p className="text-xs text-foreground-secondary">{result.classTitle}</p>
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  {result.grade ? (
                    <Badge
                      variant={getGradeBadgeVariant(result.grade.finalScore)}
                      size="sm"
                    >
                      {result.grade.mappedGrade}
                      {result.grade.finalScore !== null && ` (${result.grade.finalScore}%)`}
                    </Badge>
                  ) : (
                    <Badge variant="default" size="sm">
                      {t.student.dashboard.results.noGrade}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      {results.length > 5 && (
        <CardFooter>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/student/results">{t.student.dashboard.results.viewAll}</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function GradeIcon() {
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
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
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
          {t.student.dashboard.notifications.unreadCount(unreadCount)}
        </p>
        {latestNotification && (
          <p className="truncate text-sm text-foreground-secondary">
            {t.student.dashboard.notifications.latest(getNotificationPreview(latestNotification))}
          </p>
        )}
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/student/notifications">{t.student.dashboard.notifications.viewAll}</Link>
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
  const payload = notification.payload;
  switch (notification.type) {
    case "assignment_published":
      return t.student.dashboard.notifications.preview.assignmentPublished((payload.assignmentTitle as string) || t.student.dashboard.notifications.preview.available);
    case "grade_released":
      return t.student.dashboard.notifications.preview.gradeReleased((payload.assignmentTitle as string) || t.student.dashboard.notifications.preview.assignment);
    case "review_released":
      return (typeof payload.message === "string" ? payload.message : null)
        || t.student.dashboard.notifications.preview.reviewReleased((payload.assignmentTitle as string) || t.student.dashboard.notifications.preview.assignment);
    case "class_announcement":
      return t.student.dashboard.notifications.preview.classAnnouncement((payload.className as string) || t.student.dashboard.notifications.preview.yourClass);
    default:
      return t.student.dashboard.notifications.preview.newNotification;
  }
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

async function StudentDashboardContent() {
  const session = await requireAreaAccess("student");
  let classes: ClassItem[] = [];
  let assignments: AssignmentItem[] = [];
  let results: ResultItem[] = [];
  let notifications: NotificationItem[] = [];
  let errors: { section: string; error: Error }[] = [];

  const [classesRes, assignmentsRes, resultsRes, notificationsRes] = await Promise.allSettled([
    fetchClasses(session.userId),
    fetchAssignments(session.userId),
    fetchResults(session.userId),
    fetchNotifications(session.userId),
  ]);

  if (classesRes.status === "fulfilled") {
    classes = classesRes.value.data;
  } else {
    errors.push({ section: "classes", error: classesRes.reason as Error });
  }

  if (assignmentsRes.status === "fulfilled") {
    assignments = assignmentsRes.value.data;
  } else {
    errors.push({ section: "assignments", error: assignmentsRes.reason as Error });
  }

  if (resultsRes.status === "fulfilled") {
    results = resultsRes.value.data;
  } else {
    errors.push({ section: "results", error: resultsRes.reason as Error });
  }

  if (notificationsRes.status === "fulfilled") {
    notifications = notificationsRes.value.data;
  } else {
    errors.push({ section: "notifications", error: notificationsRes.reason as Error });
  }

  return (
    <section className="space-y-8">
{/* Header */}
      <div>
        <h1 className="text-h1 font-bold text-foreground">
          {t.student.dashboard.welcomeBack(session.displayName)}
        </h1>
        <p className="mt-2 text-body text-foreground-secondary">
          {t.student.dashboard.intro}
        </p>
      </div>

      {/* Notifications Preview */}
      <NotificationsPreview notifications={notifications} />

{/* Error Panel */}
      {errors.length > 0 && (
        <DashboardErrorPanel
          title={t.student.dashboard.errors.title}
          message={t.student.dashboard.errors.message(errors.map((e) => e.section).join(", "))}
        />
      )}

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Assignments - Primary (2 columns) */}
        <div className="lg:col-span-2">
          <ActiveAssignmentsSection assignments={assignments} />
        </div>

        {/* Side Panel - Classes & Results */}
        <div className="space-y-6">
          {/* Classes Summary - Tertiary */}
          <ClassesSummarySection classes={classes} />

          {/* Recent Results - Secondary */}
          <RecentResultsSection results={results} />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <StudentDashboardContent />
    </Suspense>
  );
}
