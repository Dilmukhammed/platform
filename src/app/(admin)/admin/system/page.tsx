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

interface ModuleStatus {
  name: string;
  status: string;
  count: number;
  detail: string;
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

function SystemPageSkeleton() {
  return (
    <section className="space-y-6">
      {/* Header Skeleton */}
      <div>
        <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-8 w-64 animate-pulse rounded bg-surface-muted" />
        <div className="mt-3 h-4 w-96 animate-pulse rounded bg-surface-muted" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded bg-surface-muted" />
        ))}
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

function ServerIcon() {
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
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

function ActivityIcon() {
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function DatabaseIcon() {
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
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  );
}

function ShieldIcon() {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

async function SystemPageContent() {
  await requireAreaAccess("admin");

  const health: HealthResponse = await getAdminSystemHealth();

  const overallHealthy = health.status === "healthy";
  const dbHealthy = health.database.status === "healthy";

  // Build module statuses from API response
  const modules: ModuleStatus[] = [
    {
      name: t.admin.system.organizations,
      status: dbHealthy ? "healthy" : "degraded",
      count: health.stats.organizations,
      detail: `${health.stats.organizations} ${t.admin.system.organizations} ro'yxatdan o'tgan`,
    },
    {
      name: t.admin.system.classes,
      status: dbHealthy ? "healthy" : "degraded",
      count: health.stats.classes,
      detail: `${health.stats.classes} ${t.admin.system.classes} yaratilgan`,
    },
    {
      name: t.admin.system.students,
      status: dbHealthy ? "healthy" : "degraded",
      count: health.stats.students,
      detail: `${health.stats.students} ${t.admin.system.students} profiling`,
    },
    {
      name: t.admin.system.teachers,
      status: dbHealthy ? "healthy" : "degraded",
      count: health.stats.teachers,
      detail: `${health.stats.teachers} ${t.admin.system.teachers} hisoblari`,
    },
    {
      name: t.admin.system.database,
      status: health.database.status,
      count: 0,
      detail: `${t.admin.system.latency}: ${health.database.latency}ms`,
    },
  ];

  const totalRecords = modules.reduce((sum, m) => sum + m.count, 0);
  const healthyModules = modules.filter((m) => m.status === "healthy").length;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
          {t.admin.system.heading}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">
          {t.admin.system.title}
        </h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          {t.admin.system.description}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card elevation="sm" className="bg-admin-subtle/10 border-admin-subtle">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground-secondary">{t.admin.system.systemHealth}</p>
              <div className="text-admin">
                <ShieldIcon />
              </div>
            </div>
            <div className="mt-2">
              <StatusChip status={overallHealthy ? "success" : "warning"} size="md">
                {overallHealthy ? t.admin.system.healthy : t.admin.system.attentionNeeded}
              </StatusChip>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground-secondary">{t.admin.system.totalModules}</p>
              <div className="text-foreground-secondary">
                <ServerIcon />
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{modules.length}</p>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground-secondary">{t.admin.system.healthyModules}</p>
              <div className="text-success">
                <ActivityIcon />
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{healthyModules}</p>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground-secondary">{t.admin.system.totalRecords}</p>
              <div className="text-foreground-secondary">
                <DatabaseIcon />
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold text-foreground">{totalRecords}</p>
          </CardContent>
        </Card>
      </div>

      {/* Module Status Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.admin.system.moduleStatus}</CardTitle>
              <CardDescription>{t.admin.system.systemComponentHealth}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/system/health">{t.admin.system.viewDetailedHealth} &rarr;</Link>
            </Button>
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
              {modules.map((module) => {
                const statusConfig = formatModuleStatus(module.status);
                return (
                  <TableRow key={module.name} interactive>
                    <TableCell className="font-medium text-foreground">
                      {module.name}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={statusConfig.status} size="sm">
                        {statusConfig.label}
                      </StatusChip>
                    </TableCell>
                    <TableCell className="text-foreground-secondary">
                      {module.count}
                    </TableCell>
                    <TableCell className="text-foreground-secondary">
                      {module.detail}
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

export default function AdminSystemPage() {
  return (
    <Suspense fallback={<SystemPageSkeleton />}>
      <SystemPageContent />
    </Suspense>
  );
}
