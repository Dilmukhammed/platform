import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/guards";
import {
  getStudentAssignmentDetail,
  type StudentAssignmentDetail as AssignmentDetail,
} from "@/modules/students/server-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StartPracticeButton } from "./StartPracticeButton";
import { t } from "@/lib/translations";

// Status configuration for UI mapping
const statusConfig: Record<
  AssignmentDetail["status"],
  { label: string; statusType: "success" | "warning" | "error" | "info"; description: string }
> = {
  not_started: { label: t.student.dashboard.assignmentStatus.notStarted, statusType: "info", description: t.student.assignments.detail.statusDescription.notStarted },
  in_progress: { label: t.student.dashboard.assignmentStatus.inProgress, statusType: "warning", description: t.student.assignments.detail.statusDescription.inProgress },
  submitted: { label: t.student.dashboard.assignmentStatus.submitted, statusType: "info", description: t.student.assignments.detail.statusDescription.submitted },
  reviewed: { label: t.student.dashboard.assignmentStatus.reviewed, statusType: "success", description: t.student.assignments.detail.statusDescription.reviewed },
  released: { label: t.student.dashboard.assignmentStatus.released, statusType: "success", description: t.student.assignments.detail.statusDescription.released },
};

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Helper to format deadline with countdown
function formatDeadline(deadline: string | null): { text: string; isUrgent: boolean; isOverdue: boolean } {
  if (!deadline) return { text: t.student.assignments.deadline.noDeadline, isUrgent: false, isOverdue: false };

  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    return { text: t.student.assignments.deadline.overdueBy(Math.abs(diffDays)), isUrgent: true, isOverdue: true };
  }

  if (diffDays > 7) {
    return { text: t.student.assignments.deadline.dueDate(deadlineDate.toLocaleDateString()), isUrgent: false, isOverdue: false };
  }

  if (diffDays > 1) {
    return { text: t.student.assignments.deadline.dueInDays(diffDays), isUrgent: diffDays <= 2, isOverdue: false };
  }

  if (diffHours > 1) {
    return { text: t.student.assignments.deadline.dueInHours(diffHours), isUrgent: true, isOverdue: false };
  }

  return { text: t.student.assignments.deadline.dueSoon, isUrgent: true, isOverdue: false };
}

// Get test status from attempts
function getTestStatus(assignment: AssignmentDetail): {
  status: "not_started" | "in_progress" | "completed" | "not_available";
  label: string;
  statusType: "success" | "warning" | "error" | "info";
  ctaText: string;
  ctaHref: string;
  disabled: boolean;
} {
  if (!assignment.hasTest || !assignment.linkedTestId) {
    return {
      status: "not_available",
      label: t.student.assignments.detail.testCard.notAvailable,
      statusType: "info",
      ctaText: "N/A",
      ctaHref: "#",
      disabled: true,
    };
  }

  const currentAttempt = assignment.testAttempts.find((a) => a.isCurrent);

  if (currentAttempt?.submittedAt) {
    return {
      status: "completed",
      label: t.student.assignments.detail.testCard.completed,
      statusType: "success",
      ctaText: t.student.assignments.detail.testCard.viewResult,
      ctaHref: `/student/assignments/${assignment.assignmentResultId}/test`,
      disabled: false,
    };
  }

  if (currentAttempt?.startedAt) {
    return {
      status: "in_progress",
      label: t.student.assignments.detail.testCard.inProgress,
      statusType: "warning",
      ctaText: t.student.assignments.detail.testCard.continueTest,
      ctaHref: `/student/assignments/${assignment.assignmentResultId}/test`,
      disabled: false,
    };
  }

  return {
    status: "not_started",
    label: t.student.assignments.detail.testCard.notStarted,
    statusType: "info",
    ctaText: t.student.assignments.detail.testCard.startTest,
    ctaHref: `/student/assignments/${assignment.assignmentResultId}/test`,
    disabled: false,
  };
}

// Get practical upload status
function getPracticalStatus(assignment: AssignmentDetail): {
  status: "needs_start" | "not_started" | "uploaded" | "not_available";
  label: string;
  statusType: "success" | "warning" | "error" | "info";
  ctaText: string;
  ctaHref: string;
  disabled: boolean;
  files: AssignmentDetail["submissionFiles"];
  needsStart: boolean;
} {
  if (!assignment.hasPractice) {
    return {
      status: "not_available",
      label: t.student.assignments.detail.practicalCard.noPracticalWork,
      statusType: "info",
      ctaText: "N/A",
      ctaHref: "#",
      disabled: true,
      files: [],
      needsStart: false,
    };
  }

  // Check if practice needs to be started first
  if (!assignment.practiceStartedAt && !assignment.practiceSubmittedAt) {
    return {
      status: "needs_start",
      label: t.student.assignments.detail.practicalCard.needsStart,
      statusType: "info",
      ctaText: t.student.assignments.detail.practicalCard.startPractice,
      ctaHref: `/student/assignments/${assignment.assignmentResultId}/submit`,
      disabled: false,
      files: [],
      needsStart: true,
    };
  }

  const files = assignment.submissionFiles.filter((f) => f.fileRole === "main");

  if (files.length > 0) {
    return {
      status: "uploaded",
      label: t.student.assignments.detail.practicalCard.workUploaded,
      statusType: "success",
      ctaText: t.student.assignments.detail.practicalCard.viewUpdate,
      ctaHref: `/student/assignments/${assignment.assignmentResultId}/submit`,
      disabled: false,
      files,
      needsStart: false,
    };
  }

  return {
    status: "not_started",
    label: t.student.assignments.detail.practicalCard.inProgress,
    statusType: "warning",
    ctaText: t.student.assignments.detail.practicalCard.continuePractice,
    ctaHref: `/student/assignments/${assignment.assignmentResultId}/submit`,
    disabled: false,
    files: [],
    needsStart: false,
  };
}

// Loading skeleton component
function AssignmentDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-muted" />
      <Card>
        <CardHeader>
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded-lg bg-surface-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-20 animate-pulse rounded-lg bg-surface-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-32 animate-pulse rounded-lg bg-surface-muted" />
            <div className="h-32 animate-pulse rounded-lg bg-surface-muted" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Error state component
function AssignmentDetailError({ error }: { error: string }) {
  return (
    <Card>
      <CardContent className="p-8">
        <EmptyState
          title={t.student.assignments.detail.errors.loadFailed}
          description={error}
          icon={
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          action={
            <Button asChild variant="secondary">
              <Link href="/student/assignments">{t.student.assignments.detail.back}</Link>
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

// Main assignment detail content component
async function AssignmentDetailContent({ assignmentResultId }: { assignmentResultId: string }) {
  const session = await requireAreaAccess("student");
  let assignment: AssignmentDetail | null = null;
  let error: string | null = null;

  try {
    assignment = await getStudentAssignmentDetail(session.userId, assignmentResultId);
  } catch (err) {
    if (err instanceof Error) {
      error = err.message;
    } else {
      error = t.student.assignments.detail.errors.unexpected;
    }
  }

  if (error) {
    return <AssignmentDetailError error={error} />;
  }

  if (!assignment) {
    notFound();
  }

  const status = statusConfig[assignment.status];
  const deadline = formatDeadline(assignment.deadline);
  const testStatus = getTestStatus(assignment);
  const practicalStatus = getPracticalStatus(assignment);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button asChild variant="ghost" size="sm">
        <Link href="/student/assignments">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t.student.assignments.detail.back}
        </Link>
      </Button>

      {/* Assignment Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{assignment.assignmentTitle}</CardTitle>
              <CardDescription className="mt-2">
                {assignment.classTitle}
              </CardDescription>
            </div>
            <StatusChip status={status.statusType} size="md">
              {status.label}
            </StatusChip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignment.assignmentDescription && (
            <p className="text-foreground-secondary">{assignment.assignmentDescription}</p>
          )}

          {/* Deadline */}
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={deadline.isUrgent ? "text-error" : "text-foreground-secondary"}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className={deadline.isUrgent ? "text-error font-medium" : "text-foreground-secondary"}>
              {deadline.text}
            </span>
            {deadline.isOverdue && (
              <Badge variant="error" size="sm">{t.student.assignments.detail.overdue}</Badge>
            )}
          </div>

          {/* Status description */}
          <p className="text-sm text-foreground-secondary">{status.description}</p>
        </CardContent>
      </Card>

      {/* Test and Practical Status Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Test Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t.student.assignments.detail.testCard.title}</CardTitle>
              <StatusChip status={testStatus.statusType} size="sm">
                {testStatus.label}
              </StatusChip>
            </div>
          </CardHeader>
          <CardContent>
            {assignment.hasTest && assignment.linkedTestId ? (
              <div className="space-y-4">
                {assignment.testAttempts.length > 0 && (
                  <div className="text-sm text-foreground-secondary">
                    <p>{t.student.assignments.detail.testCard.attempts(assignment.testAttempts.length)}</p>
                    {assignment.testAttempts[0]?.scoreRaw !== null && (
                      <p>{t.student.assignments.detail.testCard.latestScore(assignment.testAttempts[0].scoreRaw)}</p>
                    )}
                  </div>
                )}
                <Button
                  asChild
                  variant={testStatus.status === "not_started" ? "primary" : "secondary"}
                  disabled={testStatus.disabled}
                >
                  <Link href={testStatus.ctaHref}>{testStatus.ctaText}</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-foreground-secondary">
                {t.student.assignments.detail.testCard.unavailableDescription}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Practical Upload Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t.student.assignments.detail.practicalCard.title}</CardTitle>
              <StatusChip status={practicalStatus.statusType} size="sm">
                {practicalStatus.label}
              </StatusChip>
            </div>
          </CardHeader>
          <CardContent>
            {assignment.hasPractice ? (
              <div className="space-y-4">
                {practicalStatus.files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t.student.assignments.detail.practicalCard.uploadedFiles}</p>
                    {practicalStatus.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 text-sm text-foreground-secondary"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>{file.originalFilename}</span>
                        <span className="text-xs">({formatFileSize(file.fileSizeBytes)})</span>
                      </div>
                    ))}
                  </div>
                )}
                {practicalStatus.needsStart ? (
                  <StartPracticeButton
                    assignmentResultId={assignment.assignmentResultId}
                    variant="primary"
                  />
                ) : (
                  <Button
                    asChild
                    variant={practicalStatus.status === "needs_start" ? "primary" : "secondary"}
                    disabled={practicalStatus.disabled}
                  >
                    <Link href={practicalStatus.ctaHref}>{practicalStatus.ctaText}</Link>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-foreground-secondary">
                {t.student.assignments.detail.practicalCard.unavailableDescription}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Materials Section */}
      {assignment.linkedMaterials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.student.assignments.detail.materials.title}</CardTitle>
            <CardDescription>
              {t.student.assignments.detail.materials.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignment.linkedMaterials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-surface-muted"
                >
                  <div className="flex-shrink-0 mt-0.5">
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
                      className="text-foreground-secondary"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{material.title}</p>
                    {material.description && (
                      <p className="text-sm text-foreground-secondary mt-1">
                        {material.description}
                      </p>
                    )}
                    <a
                      href={`/api/v1/student/materials/${material.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {t.student.assignments.detail.materials.download}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result Summary (if reviewed/released) */}
      {(assignment.status === "reviewed" || assignment.status === "released") && assignment.gradeRecord && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t.student.assignments.detail.resultSummary.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-surface-muted p-4">
                <p className="text-sm text-foreground-secondary">{t.student.assignments.detail.resultSummary.finalGrade}</p>
                <p className="text-2xl font-bold text-foreground">
                  {assignment.gradeRecord.mappedGrade}
                </p>
              </div>
              {assignment.gradeRecord.practiceScore !== null && (
                <div className="rounded-lg bg-surface-muted p-4">
                  <p className="text-sm text-foreground-secondary">{t.student.assignments.detail.resultSummary.practicalScore}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {assignment.gradeRecord.practiceScore}
                  </p>
                </div>
              )}
              {assignment.gradeRecord.testScore !== null && (
                <div className="rounded-lg bg-surface-muted p-4">
                  <p className="text-sm text-foreground-secondary">{t.student.assignments.detail.resultSummary.testScore}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {assignment.gradeRecord.testScore}
                  </p>
                </div>
              )}
              {assignment.gradeRecord.finalScore !== null && (
                <div className="rounded-lg bg-surface-muted p-4">
                  <p className="text-sm text-foreground-secondary">{t.student.assignments.detail.resultSummary.finalScore}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {assignment.gradeRecord.finalScore}
                  </p>
                  {assignment.gradeRecord.isOverridden && (
                    <Badge variant="warning" size="sm" className="mt-2">
                      {t.student.assignments.detail.resultSummary.overridden}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button asChild variant="secondary">
              <Link href={`/student/results/${assignment.assignmentResultId}`}>
                {t.student.assignments.detail.resultSummary.viewFullResult}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-2"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

// Page component
export default async function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ assignmentResultId: string }>;
}) {
  const { assignmentResultId } = await params;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      <Suspense fallback={<AssignmentDetailLoading />}>
        <AssignmentDetailContent assignmentResultId={assignmentResultId} />
      </Suspense>
    </section>
  );
}
