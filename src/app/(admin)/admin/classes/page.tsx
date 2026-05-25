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
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { listAdminClasses } from "@/modules/admins/server-data";

// ============================================================================
// Types
// ============================================================================

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
  teacherName: string;
  activeJoinCode: string;
  studentCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================


function formatStatus(status: string): { status: "success" | "warning" | "error" | "info"; label: string } {
  switch (status.toLowerCase()) {
    case "active":
      return { status: "success", label: t.admin.classes.active };
    case "pending":
      return { status: "warning", label: t.admin.classes.pending };
    case "inactive":
      return { status: "error", label: t.admin.classes.inactive };
    default:
      return { status: "info", label: status };
  }
}

// ============================================================================
// Skeleton Components
// ============================================================================

function ClassesPageSkeleton() {
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

async function ClassesPageContent() {
  await requireAreaAccess("admin");

  const classes: ClassWithDetails[] = await listAdminClasses();

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
          {t.admin.classes.adminClasses}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">
          {t.admin.classes.title}
        </h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          {t.admin.classes.description}
        </p>
      </div>

      {/* Classes Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.admin.classes.classList}</CardTitle>
              <CardDescription>{t.admin.classes.organizationScopedClasses}</CardDescription>
            </div>
            <Badge variant="default" size="sm">{t.admin.classes.classesCount(classes.length)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <EmptyState
              icon={<ClassIcon />}
              title={t.admin.classes.noClassesFound}
              description={t.admin.classes.noClassesYet}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.classes.class}</TableHead>
                  <TableHead>{t.admin.classes.organization}</TableHead>
                  <TableHead>{t.admin.classes.teacher}</TableHead>
                  <TableHead>{t.admin.classes.joinCode}</TableHead>
                  <TableHead>{t.admin.classes.students}</TableHead>
                  <TableHead className="text-right">{t.admin.classes.updated}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((classItem) => {
                  const statusConfig = formatStatus(classItem.status);
                  return (
                    <TableRow key={classItem.id} interactive>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{classItem.name}</p>
                          <p className="text-xs text-foreground-secondary">{t.admin.classes.slug(classItem.slug)}</p>
                          <div className="mt-1">
                            <StatusChip status={statusConfig.status} size="sm">
                              {statusConfig.label}
                            </StatusChip>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {classItem.organizationName}
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {classItem.teacherName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="primary" size="sm">
                          {classItem.activeJoinCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {classItem.studentCount}
                      </TableCell>
                      <TableCell className="text-right text-foreground-secondary">
                        {formatDate(classItem.updatedAt)}
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

export default function AdminClassesPage() {
  return (
    <Suspense fallback={<ClassesPageSkeleton />}>
      <ClassesPageContent />
    </Suspense>
  );
}
