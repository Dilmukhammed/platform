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
import { listAdminTeachers } from "@/modules/admins/server-data";

// ============================================================================
// Types
// ============================================================================

interface TeacherWithStats {
  id: string;
  email: string;
  displayName: string;
  status: string;
  role: string;
  membershipsCount: number;
  ownedClassesCount: number;
  selectedOrganizationId: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatStatus(status: string): { status: "success" | "warning" | "error" | "info"; label: string } {
  switch (status.toLowerCase()) {
    case "active":
      return { status: "success", label: t.admin.teachers.active };
    case "pending":
      return { status: "warning", label: t.admin.teachers.pending };
    case "inactive":
      return { status: "error", label: t.admin.teachers.inactive };
    default:
      return { status: "info", label: status };
  }
}

// ============================================================================
// Skeleton Components
// ============================================================================

function TeachersPageSkeleton() {
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

function UsersIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

async function TeachersPageContent() {
  await requireAreaAccess("admin");

  const teachers: TeacherWithStats[] = await listAdminTeachers();

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
          Admin teachers
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">
          Teacher accounts and organization ownership
        </h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          Review bootstrap teacher accounts, inspect organization memberships, and jump into each teacher&apos;s owned classes.
        </p>
        <div className="mt-4">
          <Badge variant="default" size="md">
            Teacher accounts: {teachers.length}
          </Badge>
        </div>
      </div>

      {/* Teachers Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Teacher directory</CardTitle>
              <CardDescription>All teacher identities</CardDescription>
            </div>
            <Badge variant="default" size="sm">
              {teachers.length} entries
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {teachers.length === 0 ? (
            <EmptyState
              icon={<UsersIcon />}
              title="No teachers found"
              description="No teacher accounts have been created yet."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Memberships</TableHead>
                  <TableHead>Classes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => {
                  const statusConfig = formatStatus(teacher.status);
                  return (
                    <TableRow key={teacher.id} interactive>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{teacher.displayName}</p>
                          <p className="text-xs text-foreground-secondary">{teacher.id}</p>
                          {teacher.selectedOrganizationId && (
                            <p className="text-xs text-foreground-secondary">
                              Selected org: {teacher.selectedOrganizationId}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {teacher.email}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={statusConfig.status} size="sm">
                          {statusConfig.label}
                        </StatusChip>
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {teacher.membershipsCount}
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {teacher.ownedClassesCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/teachers/${teacher.id}`}>
                            View detail
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

export default function AdminTeachersPage() {
  return (
    <Suspense fallback={<TeachersPageSkeleton />}>
      <TeachersPageContent />
    </Suspense>
  );
}
