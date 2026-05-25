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
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { getAdminSystemHealth } from "@/modules/admins/server-data";

// ============================================================================
// Types
// ============================================================================

interface HealthStats {
  organizations: number;
  teachers: number;
  students: number;
  classes: number;
}

interface DatabaseHealth {
  status: string;
  latency: number;
}

interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  database: DatabaseHealth;
  stats: HealthStats;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatModuleStatus(status: string): { status: "success" | "warning" | "error" | "info"; label: string } {
  switch (status) {
    case "healthy":
      return { status: "success", label: t.admin.system.healthy };
    case "degraded":
      return { status: "warning", label: t.admin.system.degraded };
    case "error":
      return { status: "error", label: t.admin.system.error };
    default:
      return { status: "info", label: status };
  }
}

// ============================================================================
// Skeleton Components
// ============================================================================

function HealthPageSkeleton() {
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

// ============================================================================
// Main Page Component
// ============================================================================

async function HealthPageContent() {
  await requireAreaAccess("admin");

  const health: HealthResponse = await getAdminSystemHealth();

  const overallHealthy = health.status === "healthy";
  const dbHealthy = health.database.status === "healthy";

  // Build health rows from API response
  const rows = [
    {
      name: t.admin.system.database,
      status: health.database.status,
      count: health.stats.organizations + health.stats.teachers + health.stats.students + health.stats.classes,
      detail: `${t.admin.system.latency}: ${health.database.latency}ms`,
    },
    {
      name: t.admin.system.organizations,
      status: dbHealthy ? "healthy" : "degraded",
      count: health.stats.organizations,
      detail: `${health.stats.organizations} ${t.admin.system.organizations} ro'yxatdan o'tgan`,
    },
    {
      name: t.admin.system.teachers,
      status: dbHealthy ? "healthy" : "degraded",
      count: health.stats.teachers,
      detail: `${health.stats.teachers} ${t.admin.system.teachers} hisoblari`,
    },
    {
      name: t.admin.system.students,
      status: dbHealthy ? "healthy" : "degraded",
      count: health.stats.students,
      detail: `${health.stats.students} ${t.admin.system.students} profiling`,
    },
    {
      name: t.admin.system.classes,
      status: dbHealthy ? "healthy" : "degraded",
      count: health.stats.classes,
      detail: `${health.stats.classes} ${t.admin.system.classes} yaratilgan`,
    },
  ];

  const totalRecords = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" asChild leftIcon={<ArrowLeftIcon />}>
          <Link href="/admin/system">{t.admin.system.heading}</Link>
        </Button>
        <span className="text-foreground-secondary">/</span>
        <span className="text-foreground-secondary">{t.admin.system.systemHealth}</span>
      </div>

      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
          {t.admin.system.systemHealth}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">
          {t.admin.system.title}
        </h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          {t.admin.system.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusChip status={overallHealthy ? "success" : "warning"} size="md">
            {t.admin.system.summary}: {overallHealthy ? t.admin.system.healthy : t.admin.system.attentionNeeded}
          </StatusChip>
          <Badge variant="default" size="md">
            {t.admin.system.platformVersion}: {health.version}
          </Badge>
          <Badge variant="primary" size="md">
            {t.admin.system.totalRecords}: {totalRecords}
          </Badge>
        </div>
      </div>

      {/* Health Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.admin.system.moduleStatus}</CardTitle>
              <CardDescription>{t.admin.system.systemComponentHealth}</CardDescription>
            </div>
            <Badge variant="default" size="sm">{rows.length} {t.admin.system.module}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.admin.system.module}</TableHead>
                <TableHead>{t.admin.system.status}</TableHead>
                <TableHead>{t.admin.system.records}</TableHead>
                <TableHead>{t.admin.system.summary}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const statusConfig = formatModuleStatus(row.status);
                return (
                  <TableRow key={row.name} interactive>
                    <TableCell className="font-medium text-foreground">
                      {row.name}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={statusConfig.status} size="sm">
                        {statusConfig.label}
                      </StatusChip>
                    </TableCell>
                    <TableCell className="text-foreground-secondary">
                      {row.count}
                    </TableCell>
                    <TableCell className="text-foreground-secondary">
                      {row.detail}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default function AdminSystemHealthPage() {
  return (
    <Suspense fallback={<HealthPageSkeleton />}>
      <HealthPageContent />
    </Suspense>
  );
}
