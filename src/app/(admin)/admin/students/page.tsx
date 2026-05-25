import Link from "next/link";
import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/guards";
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
import { listAdminStudents } from "@/modules/admins/server-data";

// ============================================================================
// Types
// ============================================================================

interface StudentWithStats {
  id: string;
  studentLogin: string;
  displayName: string;
  status: string;
  enrollmentCount: number;
  submissionCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatStatus(status: string): { status: "success" | "warning" | "error" | "info"; label: string } {
  switch (status.toLowerCase()) {
    case "active":
      return { status: "success", label: t.admin.students.active };
    case "pending":
      return { status: "warning", label: t.admin.students.pending };
    case "inactive":
      return { status: "error", label: t.admin.students.inactive };
    default:
      return { status: "info", label: status };
  }
}

// ============================================================================
// Skeleton Components
// ============================================================================

function StudentsPageSkeleton() {
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

function GraduationCapIcon() {
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
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

async function StudentsPageContent() {
  await requireAreaAccess("admin");

  const students: StudentWithStats[] = await listAdminStudents();

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
          {t.admin.students.adminStudents}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">
          {t.admin.students.title}
        </h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          {t.admin.students.description}
        </p>
        <div className="mt-4">
          <Badge variant="default" size="md">
            {t.admin.students.studentProfiles(students.length)}
          </Badge>
        </div>
      </div>

      {/* Students Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.admin.students.studentDirectory}</CardTitle>
              <CardDescription>{t.admin.students.provisionedIdentities}</CardDescription>
            </div>
            <Badge variant="default" size="sm">
              {t.admin.students.studentProfiles(students.length)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <EmptyState
              icon={<GraduationCapIcon />}
              title={t.admin.students.noStudentsFound}
              description={t.admin.students.noStudentProfilesYet}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.students.student}</TableHead>
                  <TableHead>{t.admin.students.login}</TableHead>
                  <TableHead>{t.admin.students.status}</TableHead>
                  <TableHead>{t.admin.students.enrollments}</TableHead>
                  <TableHead>{t.admin.students.submissions}</TableHead>
                  <TableHead className="text-right">{t.admin.students.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const statusConfig = formatStatus(student.status);
                  return (
                    <TableRow key={student.id} interactive>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{student.displayName}</p>
                          <p className="text-xs text-foreground-secondary">{student.id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {student.studentLogin}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={statusConfig.status} size="sm">
                          {statusConfig.label}
                        </StatusChip>
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {student.enrollmentCount}
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {student.submissionCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/students/${student.id}`}>
                            {t.admin.students.viewDetail}
                          </Link>
                        </Button>
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

export default function AdminStudentsPage() {
  return (
    <Suspense fallback={<StudentsPageSkeleton />}>
      <StudentsPageContent />
    </Suspense>
  );
}
