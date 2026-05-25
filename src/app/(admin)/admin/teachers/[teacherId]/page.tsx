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
import { getAdminTeacherDetail } from "@/modules/admins/server-data";

// ============================================================================
// Types
// ============================================================================

interface MembershipWithOrg {
  id: string;
  teacherId: string;
  organizationId: string;
  role: string;
  status: string;
  joinedAt: string;
  organizationName: string;
  organizationSlug: string;
  organizationStatus: string;
}

interface ClassWithDetails {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  organizationId: string;
  teacherId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  organizationName: string;
  activeJoinCode: string;
  rosterCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatStatus(status: string): { status: "success" | "warning" | "error" | "info"; label: string } {
  switch (status.toLowerCase()) {
    case "active":
      return { status: "success", label: t.admin.teacherDetail.active };
    case "pending":
      return { status: "warning", label: t.admin.teacherDetail.pending };
    case "inactive":
      return { status: "error", label: t.admin.teacherDetail.inactive };
    default:
      return { status: "info", label: status };
  }
}

// ============================================================================
// Skeleton Components
// ============================================================================

function TeacherDetailSkeleton() {
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
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
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

async function TeacherDetailContent({ teacherId }: { teacherId: string }) {
  await requireAreaAccess("admin");

  const teacher = await getAdminTeacherDetail(teacherId);

  if (!teacher || teacher.role !== "teacher") {
    notFound();
  }

  const memberships: MembershipWithOrg[] = teacher.memberships;
  const ownedClasses = teacher.classes;

  const teacherStatus = formatStatus(teacher.status);

  return (
    <section className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" asChild leftIcon={<ArrowLeftIcon />}>
          <Link href="/admin/teachers">{t.admin.teacherDetail.backToTeachers}</Link>
        </Button>
        <span className="text-foreground-secondary">/</span>
        <span className="text-foreground-secondary">{teacher.displayName}</span>
      </div>

      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
          {t.admin.teacherDetail.teacherDetail}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">{teacher.displayName}</h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          {t.admin.teacherDetail.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="default" size="sm">{t.admin.teacherDetail.email(teacher.email)}</Badge>
          <StatusChip status={teacherStatus.status} size="sm">
            {teacherStatus.label}
          </StatusChip>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Memberships Column */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t.admin.teacherDetail.organizationMemberships}</CardTitle>
                <CardDescription>{t.admin.teacherDetail.ownershipFootprint}</CardDescription>
              </div>
              <Badge variant="default" size="sm">{memberships.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {memberships.length === 0 ? (
              <EmptyState
                icon={<BuildingIcon />}
                title={t.admin.teacherDetail.noMemberships}
                description={t.admin.teacherDetail.noMembershipsDescription}
              />
            ) : (
              <div className="space-y-3">
                {memberships.map((membership) => {
                  const orgStatus = formatStatus(membership.organizationStatus);
                  const membershipStatus = formatStatus(membership.status);
                  return (
                    <div
                      key={membership.id}
                      className="rounded-lg border border-border bg-surface p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground">{membership.organizationName}</p>
                        <StatusChip status={membershipStatus.status} size="sm">
                          {membershipStatus.label}
                        </StatusChip>
                      </div>
                      <p className="mt-1 text-sm text-foreground-secondary">
                        {t.admin.teacherDetail.slug(membership.organizationSlug)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="default" size="sm">
                          {t.admin.teacherDetail.organizationStatus(orgStatus.label)}
                        </Badge>
                        <Badge variant="info" size="sm">
                          {t.admin.teacherDetail.role(membership.role)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-foreground-secondary">
                        {t.admin.teacherDetail.joined(formatDate(membership.joinedAt))}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Classes Column */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t.admin.teacherDetail.ownedClasses}</CardTitle>
                <CardDescription>{t.admin.teacherDetail.teacherCreatedRosterSpaces}</CardDescription>
              </div>
              <Badge variant="default" size="sm">{ownedClasses.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {ownedClasses.length === 0 ? (
              <EmptyState
                icon={<ClassIcon />}
                title={t.admin.teacherDetail.noClasses}
                description={t.admin.teacherDetail.noClassesDescription}
              />
            ) : (
              <div className="space-y-4">
                {ownedClasses.map((classItem) => (
                  <div
                    key={classItem.classId}
                    className="rounded-lg border border-border bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{classItem.title}</h3>
                        <p className="text-sm text-foreground-secondary">{classItem.organizationName}</p>
                      </div>
                      <StatusChip status={classItem.status === "active" ? "success" : "warning"} size="sm">
                        {classItem.status}
                      </StatusChip>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-foreground-secondary">
                      <Badge variant="default" size="sm">
                        {t.admin.teacherDetail.students(classItem.studentCount)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
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

export default async function AdminTeacherDetailPage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  const { teacherId } = await params;

  return (
    <Suspense fallback={<TeacherDetailSkeleton />}>
      <TeacherDetailContent teacherId={teacherId} />
    </Suspense>
  );
}
