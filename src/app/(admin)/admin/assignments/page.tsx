import Link from "next/link";
import { Suspense } from "react";
import { FileText, ClipboardList } from "lucide-react";

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
import { listAdminAssignments } from "@/modules/admins/server-data";

// ============================================================================
// Types
// ============================================================================

interface AssignmentTemplateWithStats {
  templateId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  title: string;
  description: string | null;
  hasPractice: boolean;
  hasTest: boolean;
  linkedTestId: string | null;
  status: string;
  linkedMaterialCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatStatus(status: string): { status: "success" | "warning" | "error" | "info"; label: string } {
  switch (status.toLowerCase()) {
    case "active":
      return { status: "success", label: t.admin.assignments.activeStatus };
    case "draft":
      return { status: "warning", label: t.admin.assignments.draftStatus };
    case "archived":
      return { status: "info", label: t.admin.assignments.archivedStatus };
    default:
      return { status: "info", label: status };
  }
}

// ============================================================================
// Skeleton Components
// ============================================================================

function AssignmentsPageSkeleton() {
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
// Main Page Component
// ============================================================================

async function AssignmentsPageContent() {
  await requireAreaAccess("admin");

  const templates: AssignmentTemplateWithStats[] = await listAdminAssignments();

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
          {t.admin.assignments.adminAssignments}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">
          {t.admin.assignments.title}
        </h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          {t.admin.assignments.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="default" size="md">
            {t.admin.assignments.templates(templates.length)}
          </Badge>
          <Badge variant="success" size="md">
            {t.admin.assignments.active(templates.filter((t) => t.status === "active").length)}
          </Badge>
          <Badge variant="warning" size="md">
            {t.admin.assignments.drafts(templates.filter((t) => t.status === "draft").length)}
          </Badge>
        </div>
      </div>

      {/* Templates Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t.admin.assignments.templateDirectory}</CardTitle>
              <CardDescription>{t.admin.assignments.allAssignmentTemplates}</CardDescription>
            </div>
            <Badge variant="default" size="sm">
              {t.admin.assignments.templates(templates.length)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title={t.admin.assignments.noAssignmentTemplatesFound}
              description={t.admin.assignments.noAssignmentTemplatesYet}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.assignments.template}</TableHead>
                  <TableHead>{t.admin.assignments.teacher}</TableHead>
                  <TableHead>{t.admin.assignments.status}</TableHead>
                  <TableHead>{t.admin.assignments.practice}</TableHead>
                  <TableHead>{t.admin.assignments.test}</TableHead>
                  <TableHead>{t.admin.assignments.materials}</TableHead>
                  <TableHead>{t.admin.assignments.created}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const statusConfig = formatStatus(template.status);
                  return (
                    <TableRow key={template.templateId} interactive>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{template.title}</p>
                          <p className="text-xs text-foreground-secondary truncate max-w-[200px]">
                            {template.description ?? t.admin.assignments.noDescription}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-foreground">{template.teacherName}</p>
                          <p className="text-xs text-foreground-secondary">{template.teacherEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={statusConfig.status} size="sm">
                          {statusConfig.label}
                        </StatusChip>
                      </TableCell>
                      <TableCell>
                        {template.hasPractice ? (
                          <Badge variant="success" size="sm">{t.admin.assignments.yes}</Badge>
                        ) : (
                          <Badge variant="default" size="sm">{t.admin.assignments.no}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.hasTest ? (
                          <Badge variant="success" size="sm">{t.admin.assignments.yes}</Badge>
                        ) : (
                          <Badge variant="default" size="sm">{t.admin.assignments.no}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {template.linkedMaterialCount}
                      </TableCell>
                      <TableCell className="text-foreground-secondary">
                        {new Date(template.createdAt).toLocaleDateString()}
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

export default function AdminAssignmentsPage() {
  return (
    <Suspense fallback={<AssignmentsPageSkeleton />}>
      <AssignmentsPageContent />
    </Suspense>
  );
}
