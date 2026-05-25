import Link from "next/link";
import { ArrowLeft, FileText, Plus, Send, Sparkles, Users } from "lucide-react";

import { t } from "@/lib/translations";

import { requireAreaAccess } from "@/lib/auth/guards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusAlert } from "@/components/ui/status-alert";
import { TestsTabBar } from "@/components/ui/tests-tab-bar";
import { SubmitTestButton } from "./SubmitTestButton";
import { DeleteTestButton } from "./DeleteTestButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTeacherSelectedOrganization,
  listTeacherSchoolLibraryTests,
  listTeacherTests,
  type TeacherSchoolLibraryTestSummary,
  type TeacherSelectedOrganization,
  type TeacherTestSummary,
} from "@/modules/teachers/server-data";

// Types
type SchoolLibraryTest = TeacherSchoolLibraryTestSummary;

/**
 * Get status display for a test based on status + pendingApproval
 */
function getTestStatusDisplay(test: TeacherTestSummary): { status: "info" | "warning" | "success" | "error"; label: string } {
  if (test.pendingApproval?.decision === "approved") {
    return { status: "success", label: t.teacher.tests.status.approved };
  }
  if (test.pendingApproval?.decision === "rejected") {
    return { status: "error", label: t.teacher.tests.status.rejected };
  }
  if (test.pendingApproval && !test.pendingApproval.decision) {
    return { status: "info", label: t.teacher.tests.status.pendingReview };
  }
  switch (test.status) {
    case "draft":
      return { status: "warning", label: t.teacher.tests.status.draft };
    case "active":
      return { status: "success", label: t.teacher.tests.status.active };
    case "archived":
      return { status: "info", label: t.teacher.tests.status.archived };
    case "deletion_requested":
      return { status: "warning", label: t.teacher.tests.status.deletionPending };
    default:
      return { status: "info", label: test.status };
  }
}

/**
 * Test status badge component
 */
function TestStatusBadge({ test }: { test: TeacherTestSummary }) {
  const display = getTestStatusDisplay(test);
  return <StatusChip status={display.status} label={display.label} />;
}

/**
 * Source badge component
 */
function SourceBadge({ origin }: { origin: TeacherTestSummary["origin"] }) {
  if (origin === "ai_stub" || origin === "ai_draft") {
    return (
      <Badge variant="info" size="sm">
        <Sparkles className="mr-1 h-3 w-3" />
        {t.teacher.tests.source.aiDraft}
      </Badge>
    );
  }
  if (origin === "imported") {
    return <Badge variant="default" size="sm">{t.teacher.tests.source.imported}</Badge>;
  }
  return <Badge variant="default" size="sm">{t.teacher.tests.source.manual}</Badge>;
}

/**
 * Teacher Tests Page
 *
 * Displays teacher's personal tests library with status indicators
 * and school-visible approved tests.
 */
export default async function TeacherTestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAreaAccess("teacher");

  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const page = typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;
  const pageSize = 12;

  const [selectedOrganization, testsResult, schoolTests] = await Promise.all([
    getTeacherSelectedOrganization(session.userId),
    listTeacherTests(session.userId, { pageSize, page }),
    listTeacherSchoolLibraryTests(session.userId),
  ]);

  const tests = testsResult.tests;
  const totalTests = testsResult.total;
  const totalPages = Math.ceil(totalTests / pageSize);
  const message = typeof params.submitted === "string"
    ? t.teacher.tests.alerts.submitted
    : typeof params.edited === "string"
      ? t.teacher.tests.alerts.edited
      : typeof params.deleted === "string"
        ? t.teacher.tests.alerts.deleted
        : typeof params["deletion-requested"] === "string"
          ? t.teacher.tests.alerts.deletionRequested
          : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <Card elevation="sm">
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.teacher.tests.title}
          </p>
          <CardTitle className="text-h1">{t.teacher.tests.libraryTitle}</CardTitle>
          <CardDescription>
            {t.teacher.tests.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="default" size="md">
              {t.teacher.tests.activeOrganization(selectedOrganization.organizationName ?? null)}
              {selectedOrganization.organizationName && (
                <span className="ml-1 text-foreground">
                  {selectedOrganization.organizationName}
                </span>
              )}
              {!selectedOrganization.organizationName && (
                <span className="ml-1 text-foreground">
                  {t.teacher.tests.notSelected}
                </span>
              )}
            </Badge>
            <Button asChild variant="primary">
              <Link href="/teacher/tests/ai-draft">
                <Sparkles className="mr-2 h-4 w-4" />
                {t.teacher.tests.actions.aiWorkspace}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/teacher/tests/create">
                <Plus className="mr-2 h-4 w-4" />
                {t.teacher.tests.actions.createManual}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <TestsTabBar />

      {/* Alert Messages */}
      {message ? <StatusAlert tone="success">{message}</StatusAlert> : null}
      {error ? <StatusAlert tone="error">{error}</StatusAlert> : null}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        {/* My Tests Section */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>{t.teacher.tests.myTests.title}</CardTitle>
                <CardDescription>
                  {t.teacher.tests.myTests.description}
                </CardDescription>
              </div>
              <Badge variant="default" size="sm">
                {t.teacher.tests.myTests.total(totalTests)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {tests.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title={t.teacher.tests.myTests.emptyTitle}
                description={t.teacher.tests.myTests.emptyDescription}
                action={
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="primary">
                      <Link href="/teacher/tests/ai-draft">
                        <Sparkles className="mr-2 h-4 w-4" />
                        {t.teacher.tests.actions.createAiDraft}
                      </Link>
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href="/teacher/tests/create">
                        <Plus className="mr-2 h-4 w-4" />
                        {t.teacher.tests.actions.createManual}
                      </Link>
                    </Button>
                  </div>
                }
              />
            ) : (
              <div className="space-y-4">
                {tests.map((test) => (
                  <Card key={test.testId} elevation="sm" className="border-border">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-foreground">
                              {test.title}
                            </h3>
                            <SourceBadge origin={test.origin} />
                          </div>
<p className="mt-1 text-sm text-foreground-secondary">
                             {t.teacher.tests.myTests.questionCount(test.scopeType, test.questionCount)}
                           </p>
                        </div>
                        <TestStatusBadge test={test} />
                      </div>

                      {test.description && (
                        <p className="mt-3 text-sm text-foreground-secondary">
                          {test.description}
                        </p>
                      )}

                      {test.pendingApproval?.decision === "rejected" && (
                        <div className="mt-3 rounded-md border border-error-subtle bg-error-subtle/30 px-3 py-2 text-sm text-error">
                          <strong>{t.teacher.tests.status.rejected}</strong>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          asChild
                          variant={test.status === "draft" ? "secondary" : "ghost"}
                          size="sm"
                        >
                          {test.status === "draft" ? (
                            test.origin === "ai_draft" ? (
                              <Link href={`/teacher/tests/ai-draft?draftId=${test.testId}`}>
                                {t.teacher.tests.myTests.editDraft}
                              </Link>
                            ) : (
                              <Link href={`/teacher/tests/${test.testId}/edit`}>
                                {t.teacher.tests.myTests.editDraft}
                              </Link>
                            )
                          ) : (
                            <Link href={`/teacher/tests/ai-draft?draftId=${test.testId}`}>
                              {t.teacher.tests.myTests.viewDetails}
                            </Link>
                          )}
                        </Button>
                        {test.status === "active" && (
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/teacher/tests/${test.testId}/edit`}>
                              {t.teacher.tests.myTests.edit}
                            </Link>
                          </Button>
                        )}
                        {test.status === "draft" && !test.pendingApproval && selectedOrganization.organizationId && (
                          <SubmitTestButton
                            testId={test.testId}
                            organizationId={selectedOrganization.organizationId}
                          />
                        )}
                        <DeleteTestButton
                          testId={test.testId}
                          title={test.title}
                          status={test.status}
                          hasPendingApproval={!!(test.pendingApproval && !test.pendingApproval.decision)}
                        />
                        {test.pendingApproval && !test.pendingApproval.decision && (
                          <Badge variant="warning" size="sm">
                            {t.teacher.tests.myTests.awaitingAdminApproval}
                          </Badge>
                        )}
                        {test.pendingApproval?.decision === "approved" && (
                          <Badge variant="success" size="sm">
                            {t.teacher.tests.myTests.visibleInSchoolScope}
                          </Badge>
                        )}
                        {test.pendingApproval?.decision === "rejected" && (
                          <Badge variant="error" size="sm">
                            {t.teacher.tests.myTests.hiddenFromSchoolScope}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                    </Card>
                ))}
              </div>
            )}
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between gap-4">
                <p className="text-sm text-foreground-secondary">
                  {t.teacher.tests.pagination.showing(tests.length, totalTests)}
                </p>
                <div className="flex items-center gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/teacher/tests?page=${page - 1}`}
                      className="rounded-control-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-raised transition-colors"
                    >
                      {t.teacher.tests.pagination.previous}
                    </Link>
                  ) : (
                    <span className="rounded-control-md border border-border px-3 py-1.5 text-sm text-foreground-muted cursor-not-allowed">
                      {t.teacher.tests.pagination.previous}
                    </span>
                  )}
                  <span className="px-2 text-sm text-foreground-secondary">
                    {t.teacher.tests.pagination.pageOf(page, totalPages)}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={`/teacher/tests?page=${page + 1}`}
                      className="rounded-control-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-raised transition-colors"
                    >
                      {t.teacher.tests.pagination.next}
                    </Link>
                  ) : (
                    <span className="rounded-control-md border border-border px-3 py-1.5 text-sm text-foreground-muted cursor-not-allowed">
                      {t.teacher.tests.pagination.next}
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* School Library Tests Section */}
        <Card elevation="sm">
          <CardHeader>
            <CardTitle>{t.teacher.tests.schoolVisible.title}</CardTitle>
            <CardDescription>
              {t.teacher.tests.schoolVisible.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schoolTests.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title={t.teacher.tests.schoolVisible.emptyTitle}
                description={t.teacher.tests.schoolVisible.emptyDescription}
              />
            ) : (
              <div className="space-y-4">
                {schoolTests.map((test) => (
                  <SchoolTestCard key={test.testId} test={test} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * School test card component
 */
function SchoolTestCard({ test }: { test: SchoolLibraryTest }) {
  return (
    <Card elevation="sm" className="border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">{test.title}</h3>
            <p className="mt-1 text-sm text-foreground-secondary">
              {t.teacher.tests.schoolVisible.addedBy(test.ownerTeacherName ?? t.teacher.tests.schoolVisible.unknownTeacher)}
            </p>
          </div>
          <StatusChip status="success" label={t.teacher.tests.schoolVisible.approved} size="sm" />
        </div>
        {test.description && (
          <p className="mt-3 text-sm text-foreground-secondary">{test.description}</p>
        )}
        <p className="mt-3 text-sm text-foreground-secondary">
          {t.teacher.tests.schoolVisible.approvedDate(test.questionCount, test.approvedAt ? new Date(test.approvedAt).toLocaleDateString() : t.teacher.tests.schoolVisible.dateUnavailable)}
        </p>
      </CardContent>
    </Card>
  );
}
