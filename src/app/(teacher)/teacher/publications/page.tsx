import Link from "next/link";
import {
  BookOpen,
  FileText,
  GraduationCap,
  AlertCircle,
  ArrowRight,
  Plus,
  Calendar,
  Users,
} from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  getTeacherSelectedOrganization,
  listTeacherPublications,
  type TeacherPublicationSummary,
  type TeacherSelectedOrganization,
} from "@/modules/teachers/server-data";

type Publication = TeacherPublicationSummary;

interface SearchParams {
  created?: string;
  error?: string;
  view?: string;
  page?: string;
}

// Check if deadline is approaching (within 3 days)
function isDeadlineApproaching(deadline: string | null): boolean {
  if (!deadline) {
    return false;
  }

  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 0 && diffDays <= 3;
}

// Check if deadline is past
function isDeadlinePast(deadline: string | null): boolean {
  if (!deadline) {
    return false;
  }

  return new Date(deadline) < new Date();
}

export default async function TeacherPublicationsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await requireAreaAccess("teacher");
  const params = await searchParams;
  const pageStr = params?.page;
  const page = typeof pageStr === "string" ? parseInt(pageStr, 10) || 1 : 1;
  const pageSize = 10;
  let selectedOrganization: TeacherSelectedOrganization = {
    organizationId: null,
    organizationName: null,
    organizationSlug: null,
  };

  // Fetch both in parallel
  const [orgResult, publicationsResult] = await Promise.all([
    getTeacherSelectedOrganization(session.userId).catch((err) => {
      console.error("[publications] Failed to load organization:", err);
      return null;
    }),
    listTeacherPublications(session.userId, { pageSize, page }).catch((err) => {
      console.error("[publications] Failed to load publications:", err);
      return err;
    }),
  ]);

  selectedOrganization = orgResult ?? {
    organizationId: null,
    organizationName: null,
    organizationSlug: null,
  };

  let publications: Publication[] = [];
  let totalPublications = 0;
  let fetchError: string | null = null;

  if (selectedOrganization.organizationId && publicationsResult instanceof Error) {
    fetchError = publicationsResult.message;
  } else if (selectedOrganization.organizationId && publicationsResult && typeof publicationsResult === "object" && "publications" in publicationsResult) {
    publications = publicationsResult.publications;
    totalPublications = publicationsResult.total;
  }
  const totalPages = Math.ceil(totalPublications / pageSize);

  const message = typeof params?.created === "string" ? t.teacher.publications.alerts.created : null;
  const error = typeof params?.error === "string" ? params.error : null;

  return (
    <section className="space-y-6">
{/* Header */}
      <div>
        <h1 className="text-h1 font-bold text-foreground">{t.teacher.publications.title}</h1>
        <p className="mt-1 text-body text-foreground-secondary">
          {t.teacher.publications.description}
        </p>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="rounded-card border border-success bg-success-subtle p-4 text-success">
          <div className="flex items-center gap-2">
            <span className="font-medium">{message}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

{/* No Organization Selected */}
      {!selectedOrganization.organizationId && (
        <Card elevation="sm">
          <CardContent className="py-8">
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title={t.teacher.publications.noOrganization.title}
              description={t.teacher.publications.noOrganization.description}
              action={
                <Button asChild>
                  <Link href="/teacher/organizations">{t.teacher.publications.noOrganization.action}</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Fetch Error */}
      {selectedOrganization.organizationId && fetchError && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{fetchError}</span>
          </div>
        </div>
      )}

{/* Empty State - No Publications */}
      {selectedOrganization.organizationId && !fetchError && publications.length === 0 && (
        <Card elevation="sm">
          <CardContent className="py-8">
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title={t.teacher.publications.empty.title}
              description={t.teacher.publications.empty.description}
              action={
                <Button asChild>
                  <Link href="/teacher/assignments">
                    <Plus className="mr-2 h-4 w-4" />
                    {t.teacher.publications.empty.action}
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Publications List */}
      {selectedOrganization.organizationId && !fetchError && publications.length > 0 && (
        <>
{/* Stats Summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground-secondary">
                {t.teacher.publications.summary.count(totalPublications)}
              </span>
              <Badge variant="primary" size="sm">
                {selectedOrganization.organizationName}
              </Badge>
            </div>
            <Button asChild>
              <Link href="/teacher/assignments">
                <Plus className="mr-2 h-4 w-4" />
                {t.teacher.publications.summary.publishNew}
              </Link>
            </Button>
          </div>

          {/* Publications Table */}
          <Card elevation="sm">
            <CardContent className="p-0">
              <Table>
<TableHeader>
                  <TableRow>
                    <TableHead>{t.teacher.publications.table.headers.assignment}</TableHead>
                    <TableHead>{t.teacher.publications.table.headers.classes}</TableHead>
                    <TableHead>{t.teacher.publications.table.headers.resources}</TableHead>
                    <TableHead>{t.teacher.publications.table.headers.deadline}</TableHead>
                    <TableHead>{t.teacher.publications.table.headers.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publications.map((publication) => {
                    const approaching = isDeadlineApproaching(publication.defaultDeadline);
                    const past = isDeadlinePast(publication.defaultDeadline);

                    return (
                      <TableRow key={publication.id} interactive>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Link
                              href={`/teacher/publications/${publication.id}`}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {publication.title}
                            </Link>
<span className="text-xs text-foreground-secondary">
                              {t.teacher.publications.table.updated(formatDate(publication.updatedAt))}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-foreground-secondary" />
                            <span className="text-foreground">{publication.classCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
{publication.linkedMaterialCount > 0 && (
                              <Badge variant="default" size="sm">
                                <FileText className="mr-1 h-3 w-3" />
                                {t.teacher.publications.table.materials(publication.linkedMaterialCount)}
                              </Badge>
                            )}
                            {publication.linkedTestCount > 0 && (
                              <Badge variant="info" size="sm">
                                <BookOpen className="mr-1 h-3 w-3" />
                                {t.teacher.publications.table.tests(publication.linkedTestCount)}
                              </Badge>
                            )}
                            {publication.linkedMaterialCount === 0 && publication.linkedTestCount === 0 && (
                              <span className="text-sm text-foreground-secondary">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className={`text-sm ${past ? "text-error" : approaching ? "text-warning" : "text-foreground"}`}>
                              {formatDate(publication.defaultDeadline)}
                            </span>
{approaching && !past && (
                              <StatusChip status="warning" size="sm">
                                {t.teacher.publications.table.approaching}
                              </StatusChip>
                            )}
                            {past && (
                              <StatusChip status="error" size="sm">
                                {t.teacher.publications.table.pastDue}
                              </StatusChip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
<Button asChild variant="ghost" size="sm">
                            <Link href={`/teacher/publications/${publication.id}`}>
                              {t.teacher.publications.table.view}
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-foreground-secondary">
                {t.teacher.publications.pagination.showing(publications.length, totalPublications)}
              </p>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Link
                    href={`/teacher/publications?page=${page - 1}`}
                    className="rounded-control-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-raised transition-colors"
                  >
                    {t.teacher.publications.pagination.previous}
                  </Link>
                ) : (
                  <span className="rounded-control-md border border-border px-3 py-1.5 text-sm text-foreground-muted cursor-not-allowed">
                    {t.teacher.publications.pagination.previous}
                  </span>
                )}
                <span className="px-2 text-sm text-foreground-secondary">
                  {t.teacher.publications.pagination.pageOf(page, totalPages)}
                </span>
                {page < totalPages ? (
                  <Link
                    href={`/teacher/publications?page=${page + 1}`}
                    className="rounded-control-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-raised transition-colors"
                  >
                    {t.teacher.publications.pagination.next}
                  </Link>
                ) : (
                  <span className="rounded-control-md border border-border px-3 py-1.5 text-sm text-foreground-muted cursor-not-allowed">
                    {t.teacher.publications.pagination.next}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Publications Cards (Alternative View) */}
          {/* Cards view removed — table view is primary; use ?view=cards to restore */}
          {params?.view === "cards" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publications.map((publication) => {
              const approaching = isDeadlineApproaching(publication.defaultDeadline);
              const past = isDeadlinePast(publication.defaultDeadline);

              return (
                <Link
                  key={`card-${publication.id}`}
                  href={`/teacher/publications/${publication.id}`}
                  className="block"
                >
                  <Card
                    interactive
                    elevation="sm"
                    className="h-full transition-shadow hover:shadow-md"
                  >
<CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-1">{publication.title}</CardTitle>
                        {past ? (
                          <StatusChip status="error" size="sm">{t.teacher.publications.table.pastDue}</StatusChip>
                        ) : approaching ? (
                          <StatusChip status="warning" size="sm">{t.teacher.publications.table.dueSoon}</StatusChip>
                        ) : (
                          <StatusChip status="success" size="sm">{t.teacher.publications.table.active}</StatusChip>
                        )}
                      </div>
                      <CardDescription className="line-clamp-1">
                        {publication.organizationName}
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-foreground-secondary">
                          <GraduationCap className="h-4 w-4 shrink-0" />
                          <span>{publication.classCount} {t.teacher.publications.table.headers.classes.toLowerCase()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground-secondary">
                          <Calendar className="h-4 w-4 shrink-0" />
                          <span>{formatDate(publication.defaultDeadline)}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        {publication.linkedMaterialCount > 0 && (
                          <Badge variant="default" size="sm">
                            <FileText className="mr-1 h-3 w-3" />
                            {t.teacher.publications.table.materials(publication.linkedMaterialCount)}
                          </Badge>
                        )}
                        {publication.linkedTestCount > 0 && (
                          <Badge variant="info" size="sm">
                            <BookOpen className="mr-1 h-3 w-3" />
                            {t.teacher.publications.table.tests(publication.linkedTestCount)}
                          </Badge>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="justify-between border-t border-border pt-4">
                      <span className="text-sm text-foreground-secondary">
                        {t.teacher.publications.table.updated(formatDate(publication.updatedAt))}
                      </span>
                      <ArrowRight className="h-4 w-4 text-foreground-secondary" />
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
          </div>
          )}
        </>
      )}
    </section>
  );
}
