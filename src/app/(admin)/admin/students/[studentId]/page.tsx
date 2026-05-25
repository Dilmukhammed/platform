import Link from "next/link";
import { notFound } from "next/navigation";
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
import { getAdminStudentDetail } from "@/modules/admins/server-data";

// ============================================================================
// Types
// ============================================================================

interface EnrollmentWithDetails {
  id: string;
  studentId: string;
  classId: string;
  enrollmentSource: string;
  joinedAt: string;
  className: string;
  organizationName: string;
}

interface OrganizationMembership {
  id: string;
  studentId: string;
  organizationId: string;
  status: string;
  joinedAt: string;
  organizationName: string;
}

// ============================================================================
// Helper Functions
// ============================================================================


function formatStatus(status: string): { status: "success" | "warning" | "error" | "info"; label: string } {
  switch (status.toLowerCase()) {
    case "active":
      return { status: "success", label: t.admin.studentDetail.active };
    case "pending":
      return { status: "warning", label: t.admin.studentDetail.pending };
    case "inactive":
      return { status: "error", label: t.admin.studentDetail.inactive };
    default:
      return { status: "info", label: status };
  }
}

// ============================================================================
// Skeleton Components
// ============================================================================

function StudentDetailSkeleton() {
  return (
    <section className="space-y-6">
      {/* Breadcrumb Skeleton */}
      <div className="h-4 w-48 animate-pulse rounded bg-surface-muted" />

      {/* Header Skeleton */}
      <div>
        <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-8 w-64 animate-pulse rounded bg-surface-muted" />
        <div className="mt-3 h-4 w-96 animate-pulse rounded bg-surface-muted" />
      </div>

      {/* Grid Skeleton */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded bg-surface-muted" />
        </div>
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded bg-surface-muted" />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Icon Components
// ============================================================================

function ArrowLeftIcon() {
  return (
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
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function BuildingIcon() {
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
      <path d="M6 22V10a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12" />
      <path d="M6 22H4a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2h2" />
      <path d="M18 22h2a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2h-2" />
      <path d="M10 22v-4h4v4" />
      <path d="M10 12h4" />
      <path d="M10 16h4" />
      <path d="M10 8V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
    </svg>
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

// ============================================================================
// Main Page Component
// ============================================================================

async function StudentDetailContent({ studentId }: { studentId: string }) {
  await requireAreaAccess("admin");

  const student = await getAdminStudentDetail(studentId);

  if (!student) {
    notFound();
  }

  const enrollments: EnrollmentWithDetails[] = student.enrollments;
  const memberships: OrganizationMembership[] = student.memberships;
  const submissionCount = student.submissionCount;

  const studentStatus = formatStatus(student.status);

return (
    <section className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" asChild leftIcon={<ArrowLeftIcon />}>
          <Link href="/admin/students">{t.admin.studentDetail.backToStudents}</Link>
        </Button>
        <span className="text-foreground-secondary">/</span>
        <span className="text-foreground-secondary">{student.displayName}</span>
      </div>

      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
          {t.admin.studentDetail.studentDetail}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">{student.displayName}</h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          {t.admin.studentDetail.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="default" size="sm">{t.admin.studentDetail.login(student.studentLogin)}</Badge>
          <StatusChip status={studentStatus.status} size="sm">
            {studentStatus.label}
          </StatusChip>
          <Badge variant="primary" size="sm">{t.admin.studentDetail.submissions(submissionCount)}</Badge>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Organization Memberships Column */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t.admin.studentDetail.organizationRecords}</CardTitle>
                <CardDescription>{t.admin.studentDetail.attachedOrganizations}</CardDescription>
              </div>
              <Badge variant="default" size="sm">{memberships.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {memberships.length === 0 ? (
              <EmptyState
                icon={<BuildingIcon />}
                title={t.admin.studentDetail.noOrganizations}
                description={t.admin.studentDetail.noOrganizationRecords}
              />
            ) : (
              <div className="space-y-3">
                {memberships.map((membership) => {
                  const statusConfig = formatStatus(membership.status);
                  return (
                    <div
                      key={membership.id}
                      className="rounded-lg border border-border bg-surface p-4"
                    >
                      <p className="font-medium text-foreground">{membership.organizationName}</p>
                      <div className="mt-2">
                        <StatusChip status={statusConfig.status} size="sm">
                          {statusConfig.label}
                        </StatusChip>
                      </div>
                      <p className="mt-2 text-xs text-foreground-secondary">
                        {t.admin.studentDetail.joined(formatDate(membership.joinedAt))}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Class Enrollments Column */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t.admin.studentDetail.classEnrollments}</CardTitle>
                <CardDescription>{t.admin.studentDetail.studentScheduleFootprint}</CardDescription>
              </div>
              <Badge variant="default" size="sm">{t.admin.studentDetail.enrollmentsCount(enrollments.length)}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {enrollments.length === 0 ? (
              <EmptyState
                icon={<ClassIcon />}
                title={t.admin.studentDetail.noEnrollments}
                description={t.admin.studentDetail.noEnrollmentsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.admin.studentDetail.class}</TableHead>
                    <TableHead>{t.admin.studentDetail.organization}</TableHead>
                    <TableHead>{t.admin.studentDetail.source}</TableHead>
                    <TableHead className="text-right">{t.admin.studentDetail.joinedLabel}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => (
                    <TableRow key={enrollment.id} interactive>
                      <TableCell className="font-medium text-foreground">
                        {enrollment.className}
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {enrollment.organizationName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" size="sm">
                          {enrollment.enrollmentSource}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-foreground-secondary">
                        {formatDate(enrollment.joinedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  return (
    <Suspense fallback={<StudentDetailSkeleton />}>
      <StudentDetailContent studentId={studentId} />
    </Suspense>
  );
}
