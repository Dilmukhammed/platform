import Link from "next/link";
import { Suspense } from "react";
import { requireAreaAccess } from "@/lib/auth/guards";
import { AssignmentsListLoading } from "@/components/ui/assignments-list-loading";
import {
  DocumentStateIcon,
  EmptyStateCard,
} from "@/components/ui/empty-state-card";
import { StatusAlert } from "@/components/ui/status-alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTeacherAssignmentTemplateCreateOptions,
  getTeacherSelectedOrganization,
  listTeacherAssignmentTemplates,
  type TeacherAssignmentTemplateCreateOptions,
  type TeacherSelectedOrganization,
} from "@/modules/teachers/server-data";
import { t } from "@/lib/translations";

// Types
interface AssignmentTemplate {
  templateId: string;
  title: string;
  description: string | null;
  hasPractice: boolean;
  hasTest: boolean;
  materialIds: string[];
  linkedTestId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const filterTabs = [
  { key: "all", label: t.teacher.tests.filters.all },
  { key: "draft", label: t.teacher.tests.filters.draft },
  { key: "active", label: t.teacher.tests.filters.active },
  { key: "archived", label: t.teacher.tests.filters.archived },
] as const;

type FilterTab = (typeof filterTabs)[number]["key"];

const ASSIGNMENTS_PAGE_SIZE = 20;

// Loading skeleton component
function AssignmentsLoading() {
  return <AssignmentsListLoading variant="teacher" />;
}

// Empty state component
function AssignmentsEmpty() {
  return (
    <EmptyStateCard
      title={t.teacher.tests.empty.title}
      description={t.teacher.tests.empty.description}
      icon={<DocumentStateIcon />}
      action={
        <Button asChild>
          <Link href="/teacher/assignments/new">{t.teacher.tests.empty.createTemplate}</Link>
        </Button>
      }
    />
  );
}

// Template row component
function TemplateRow({ template }: { template: AssignmentTemplate }) {
  const statusProps =
    template.status === "active"
      ? { status: "success" as const, label: t.teacher.tests.detail.status.active }
      : template.status === "archived"
        ? { status: "info" as const, label: t.teacher.tests.detail.status.archived }
        : { status: "warning" as const, label: t.teacher.tests.detail.status.draft };

  return (
    <TableRow interactive>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Link
            href={`/teacher/assignments/${template.templateId}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {template.title}
          </Link>
        </div>
      </TableCell>
      <TableCell>
        <StatusChip status={statusProps.status} label={statusProps.label} size="sm" />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {template.materialIds.length > 0 && (
            <Badge variant="info" size="sm">
              {t.teacher.tests.table.materialCount(template.materialIds.length)}
            </Badge>
          )}
          {template.linkedTestId && (
            <Badge variant="primary" size="sm">
              {t.teacher.tests.table.oneTest}
            </Badge>
          )}
          {template.materialIds.length === 0 && !template.linkedTestId && (
            <Badge variant="default" size="sm">
              {t.teacher.tests.table.noContent}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-foreground-secondary">
          {new Date(template.updatedAt).toLocaleDateString()}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/teacher/assignments/${template.templateId}`}>
              {t.teacher.tests.table.view}
            </Link>
          </Button>
          <Button asChild size="sm" variant="primary">
            <Link href={`/teacher/assignments/${template.templateId}/publish`}>
              {t.teacher.tests.table.publish}
            </Link>
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Main assignments content component
async function AssignmentsContent({ 
  templates,
  selectedOrganization,
  createOptions 
}: { 
  templates: AssignmentTemplate[];
  selectedOrganization: TeacherSelectedOrganization;
  createOptions: TeacherAssignmentTemplateCreateOptions | null;
}) {
  if (!selectedOrganization.organizationId || !createOptions) {
    return (
      <Card>
        <CardContent className="p-8">
          <EmptyState
            title={t.teacher.tests.noOrganization.title}
            description={t.teacher.tests.noOrganization.description}
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            action={
              <Button asChild variant="secondary">
                <Link href="/teacher/organizations">{t.teacher.tests.noOrganization.action}</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  if (templates.length === 0) {
    return <AssignmentsEmpty />;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow noHover>
              <TableHead>{t.teacher.tests.table.headers.template}</TableHead>
              <TableHead>{t.teacher.tests.table.headers.status}</TableHead>
              <TableHead>{t.teacher.tests.table.headers.content}</TableHead>
              <TableHead>{t.teacher.tests.table.headers.updated}</TableHead>
              <TableHead>{t.teacher.tests.table.headers.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TemplateRow key={template.templateId} template={template} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Page component
export default async function TeacherAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAreaAccess("teacher");
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  
  const message = typeof params.created === "string" ? t.teacher.tests.alerts.created
    : typeof params.archived === "string" ? t.teacher.tests.alerts.archived
    : null;
  const error = typeof params.error === "string" ? params.error : null;

  // Filter logic
  const filterParam = typeof params.filter === "string" ? params.filter : "all";
  const activeFilter: FilterTab = filterTabs.some(t => t.key === filterParam) ? (filterParam as FilterTab) : "all";
  const page = typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;

  // Fetch data directly on the server to avoid internal HTTP round-trips during navigation.
  let selectedOrganization: TeacherSelectedOrganization = {
    organizationId: null,
    organizationName: null,
    organizationSlug: null,
  };
  let templates: AssignmentTemplate[] = [];
  let total = 0;
  let createOptions: TeacherAssignmentTemplateCreateOptions | null = null;
  
  try {
    selectedOrganization = await getTeacherSelectedOrganization(session.userId);
  } catch {
    selectedOrganization = {
      organizationId: null,
      organizationName: null,
      organizationSlug: null,
    };
  }
  
  if (selectedOrganization.organizationId) {
    try {
      const [templatesResult, createOptionsResult] = await Promise.all([
        listTeacherAssignmentTemplates(session.userId, { page }),
        getTeacherAssignmentTemplateCreateOptions(session.userId),
      ]);
      templates = templatesResult.templates;
      total = templatesResult.total;
      createOptions = createOptionsResult;
    } catch {
      templates = [];
      total = 0;
      createOptions = null;
    }
  }

  // Filter templates by status
  const filteredTemplates = activeFilter === "all"
    ? templates
    : templates.filter(t => t.status === activeFilter);

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t.teacher.tests.title}</CardTitle>
              <CardDescription>
                {t.teacher.tests.description}
              </CardDescription>
            </div>
            {selectedOrganization.organizationId && createOptions && (
              <Button asChild>
                <Link href="/teacher/assignments/new">{t.teacher.tests.empty.createTemplate}</Link>
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Alert Messages */}
      {message ? <StatusAlert tone="success" className="rounded-xl">{message}</StatusAlert> : null}
      {error ? <StatusAlert tone="error" className="rounded-xl">{error}</StatusAlert> : null}

      {/* Organization Info */}
      {selectedOrganization.organizationId && createOptions && (
        <div className="flex items-center gap-2 text-sm text-foreground-secondary">
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
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>{t.teacher.tests.organizationInfo.label}: <span className="font-medium text-foreground">{createOptions.organizationName}</span></span>
          <Badge variant="default" size="sm">
            {t.teacher.tests.organizationInfo.filteredTemplateCount(activeFilter === "all" ? templates.length : filteredTemplates.length, templates.length)}
          </Badge>
        </div>
      )}

      {/* Filter Tabs */}
      {selectedOrganization.organizationId && createOptions && templates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <Button
                key={tab.key}
                asChild
                variant={isActive ? "primary" : "ghost"}
                size="sm"
              >
                <Link
                  href={`/teacher/assignments?filter=${tab.key}`}
                  scroll={false}
                >
                  {tab.label}
                </Link>
              </Button>
            );
          })}
        </div>
      )}

      {/* Assignments List */}
      <Suspense fallback={<AssignmentsLoading />}>
        <AssignmentsContent 
          templates={filteredTemplates} 
          selectedOrganization={selectedOrganization}
          createOptions={createOptions}
        />
      </Suspense>

      {/* Pagination */}
      {total > ASSIGNMENTS_PAGE_SIZE && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-foreground-secondary">
            {t.teacher.tests.pagination.showing(filteredTemplates.length, total)}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={`/teacher/assignments?page=${page - 1}${activeFilter !== "all" ? `&filter=${activeFilter}` : ""}`}
                className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {t.teacher.tests.pagination.previous}
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm text-foreground-muted cursor-not-allowed">
                {t.teacher.tests.pagination.previous}
              </span>
            )}
            <span className="text-sm text-foreground-secondary px-2">
              {t.teacher.tests.pagination.pageOf(page, Math.ceil(total / ASSIGNMENTS_PAGE_SIZE))}
            </span>
            {page < Math.ceil(total / ASSIGNMENTS_PAGE_SIZE) ? (
              <Link
                href={`/teacher/assignments?page=${page + 1}${activeFilter !== "all" ? `&filter=${activeFilter}` : ""}`}
                className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                {t.teacher.tests.pagination.next}
              </Link>
            ) : (
              <span className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm text-foreground-muted cursor-not-allowed">
                {t.teacher.tests.pagination.next}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
