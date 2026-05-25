import Link from "next/link";
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
import { getAdminDashboardSummary } from "@/modules/admins/server-data";

// ============================================================================
// Types
// ============================================================================

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// Skeleton Components
// ============================================================================

function DashboardSkeleton() {
  return (
    <section className="space-y-8">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 w-64 animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-surface-muted" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-card border border-border bg-surface-raised p-5">
            <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-surface-muted" />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Approvals - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="h-6 w-40 animate-pulse rounded bg-surface-muted" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-surface-muted" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="h-6 w-32 animate-pulse rounded bg-surface-muted" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-surface-muted" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Section Components
// ============================================================================

function StatsCards({
  totalStudents,
  totalTeachers,
  totalClasses,
  totalOrganizations,
}: {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalOrganizations: number;
}) {
  const stats = [
    {
      label: t.admin.dashboard.students,
      value: totalStudents,
      href: "/admin/students",
      icon: <UsersIcon />,
      color: "admin",
    },
    {
      label: t.admin.dashboard.teachers,
      value: totalTeachers,
      href: "/admin/teachers",
      icon: <UsersIcon />,
      color: "admin",
    },
    {
      label: t.admin.dashboard.classes,
      value: totalClasses,
      href: "/admin/classes",
      icon: <ClassIcon />,
      color: "admin",
    },
    {
      label: t.admin.dashboard.organizations,
      value: totalOrganizations,
      href: "/admin/organizations",
      icon: <BuildingIcon />,
      color: "admin",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          className="group rounded-card border border-border bg-surface-raised p-5 transition-all hover:border-admin-subtle hover:bg-admin-subtle/10"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground-secondary">{stat.label}</p>
            <div className="text-admin">{stat.icon}</div>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
        </Link>
      ))}
    </div>
  );
}

function PendingApprovalsSection({
  pendingOrgs,
  pendingMaterials,
  pendingTests,
}: {
  pendingOrgs: number;
  pendingMaterials: number;
  pendingTests: number;
}) {
  const totalPending = pendingOrgs + pendingMaterials + pendingTests;

  if (totalPending === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.admin.dashboard.pendingApprovals}</CardTitle>
          <CardDescription>{t.admin.dashboard.itemsAwaitingReview}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<CheckCircleIcon />}
            title={t.admin.dashboard.allCaughtUp}
            description={t.admin.dashboard.noPendingApprovals}
          />
        </CardContent>
      </Card>
    );
  }

  const pendingItems = [
    {
      label: t.admin.dashboard.organizationApprovals,
      count: pendingOrgs,
      href: "/admin/organization-approvals",
      status: "warning" as const,
    },
    {
      label: t.admin.dashboard.materialApprovals,
      count: pendingMaterials,
      href: "/admin/material-approvals",
      status: "warning" as const,
    },
    {
      label: t.admin.dashboard.testApprovals,
      count: pendingTests,
      href: "/admin/test-approvals",
      status: "warning" as const,
    },
  ].filter((item) => item.count > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t.admin.dashboard.pendingApprovals}</CardTitle>
            <CardDescription>{t.admin.dashboard.itemsAwaitingReview}</CardDescription>
          </div>
          <Badge variant="warning" size="sm">
            {totalPending} {t.admin.dashboard.pending}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-surface-muted"
            >
              <div className="flex items-center gap-3">
                <StatusChip status={item.status} size="sm">
                  {t.admin.dashboard.needsReview}
                </StatusChip>
                <span className="font-medium text-foreground">{item.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="warning" size="sm">
                  {item.count}
                </Badge>
                <span className="text-admin">&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/organization-approvals">{t.admin.dashboard.viewAllApprovals}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function QuickLinksSection() {
  const links = [
    { href: "/admin/organization-approvals", label: t.admin.dashboard.organizationApprovals, description: t.admin.dashboard.reviewPendingOrganizations },
    { href: "/admin/material-approvals", label: t.admin.dashboard.materialApprovals, description: t.admin.dashboard.reviewPendingMaterials },
    { href: "/admin/test-approvals", label: t.admin.dashboard.testApprovals, description: t.admin.dashboard.reviewPendingTests },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.admin.dashboard.approvalQueues}</CardTitle>
        <CardDescription>{t.admin.dashboard.navigateToPendingItems}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-surface-muted"
            >
              <div>
                <p className="font-medium text-foreground">{link.label}</p>
                <p className="text-xs text-foreground-secondary">{link.description}</p>
              </div>
              <span className="text-admin">&rarr;</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Icon Components
// ============================================================================

function UsersIcon({ className }: { className?: string }) {
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
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
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
      className={className}
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

function ClassIcon({ className }: { className?: string }) {
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
      className={className}
    >
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

function CheckCircleIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
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
      className={className}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

async function AdminDashboardContent() {
  const summary = await getAdminDashboardSummary();

  // Get session for display name
  const session = await requireAreaAccess("admin");

  return (
    <section className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-h1 font-bold text-foreground">
          {t.admin.dashboard.pendingApprovals}
        </h1>
        <p className="mt-2 text-body text-foreground-secondary">
          {t.admin.dashboard.itemsAwaitingReview}
        </p>
      </div>

      {/* Stats Cards */}
      <StatsCards
        totalStudents={summary.totalStudents}
        totalTeachers={summary.totalTeachers}
        totalClasses={summary.totalClasses}
        totalOrganizations={summary.totalOrganizations}
      />

      {/* Main Grid Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending Approvals - Primary (2 columns) */}
        <div className="lg:col-span-2">
          <PendingApprovalsSection
            pendingOrgs={summary.pendingOrganizations}
            pendingMaterials={summary.pendingMaterials}
            pendingTests={summary.pendingTests}
          />
        </div>

        {/* Side Panel - Quick Links */}
        <div className="space-y-6">
          <QuickLinksSection />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminDashboardContent />
    </Suspense>
  );
}
