import Link from "next/link";
import {
  ClipboardCheck,
  Clock,
  AlertCircle,
  CheckCircle,
  Search,
  FileText,
  ArrowRight,
  GraduationCap,
  Calendar,
  User,
  BookOpen,
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
import { Input } from "@/components/ui/input";
import { ReviewsFilters } from "./reviews-filters";
import {
  listTeacherPendingReviews,
  type TeacherPendingReviewSummary,
} from "@/modules/teachers/server-data";

type PendingReview = TeacherPendingReviewSummary;

interface ClassItem {
  classId: string;
  title: string;
  description?: string;
  status: string;
  studentCount: number;
}

interface PublicationItem {
  id: string;
  title: string;
  status: string;
  templateId: string;
}

function getFallbackClasses(reviews: PendingReview[]): ClassItem[] {
  return Array.from(
    new Map(
      reviews.flatMap((review) =>
        review.class.classId
          ? [[
              review.class.classId,
              {
                classId: review.class.classId,
                title: review.class.title ?? t.teacher.reviews.submissions.unknownClass,
                status: "active",
                studentCount: 0,
              } satisfies ClassItem,
            ]]
          : [],
      ),
    ).values(),
  );
}

function getFallbackPublications(reviews: PendingReview[]): PublicationItem[] {
  return Array.from(
    new Map(
      reviews.flatMap((review) =>
        review.assignment.publicationId
          ? [[
              review.assignment.publicationId,
              {
                id: review.assignment.publicationId,
                title: review.assignment.title ?? t.teacher.reviews.submissions.unknownPublication,
                status: "active",
                templateId: review.assignment.templateId ?? "",
              } satisfies PublicationItem,
            ]]
          : [],
      ),
    ).values(),
  );
}

// Helper to format dates

// Helper to format relative time
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

if (diffHours < 1) return t.teacher.reviews.submissions.priorities.justNow;
  if (diffHours < 24) return t.teacher.reviews.submissions.priorities.hoursAgo(diffHours);
  if (diffDays === 1) return t.teacher.reviews.submissions.priorities.yesterday;
  if (diffDays < 7) return t.teacher.reviews.submissions.priorities.daysAgo(diffDays);
  return formatDate(dateString);
}

  // Get priority status for a submission
function getSubmissionPriority(
  submittedAt: string | null,
  reviewStatus: string | null
): { level: "high" | "medium" | "low" | null; label: string; icon: React.ReactNode } {
  // If already reviewed, no priority
  if (reviewStatus === "released") {
    return { level: null, label: t.teacher.reviews.submissions.priorities.reviewed, icon: <CheckCircle className="h-4 w-4" /> };
  }

  if (!submittedAt) {
    return { level: "low", label: t.teacher.reviews.submissions.priorities.new, icon: <FileText className="h-4 w-4" /> };
  }

  const submitted = new Date(submittedAt);
  const now = new Date();
  const diffMs = now.getTime() - submitted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 7) {
    return { level: "high", label: t.teacher.reviews.submissions.priorities.overdue, icon: <AlertCircle className="h-4 w-4" /> };
  }
  if (diffDays >= 3) {
    return { level: "medium", label: t.teacher.reviews.submissions.priorities.dueSoon, icon: <Clock className="h-4 w-4" /> };
  }
  return { level: "low", label: t.teacher.reviews.submissions.priorities.new, icon: <FileText className="h-4 w-4" /> };
}

// Get review status chip config
function getReviewStatusConfig(
  status: string | null
): { status: "info" | "warning" | "success"; label: string } {
  switch (status) {
    case "released":
      return { status: "success", label: t.teacher.reviews.submissions.reviewStatus.released };
    case "draft":
      return { status: "warning", label: t.teacher.reviews.submissions.reviewStatus.draft };
    default:
      return { status: "info", label: t.teacher.reviews.submissions.reviewStatus.pending };
  }
}

export default async function TeacherReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireAreaAccess("teacher");

  // Get filter params
  const params = await searchParams;
  const filterPublication = typeof params.publication === "string" ? params.publication : "";
  const filterClass = typeof params.class === "string" ? params.class : "";
  const filterStatus = typeof params.status === "string" ? params.status : "";
  const searchQuery = typeof params.search === "string" ? params.search.toLowerCase() : "";
  const page = typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;

  // Fetch data from API
  let reviews: PendingReview[] = [];
  let total = 0;
  let fetchError: string | null = null;

  try {
    const result = await listTeacherPendingReviews(session.userId, { page });
    reviews = result.reviews;
    total = result.total;
  } catch (error) {
    console.error("[reviews] Failed to load reviews:", error);
    fetchError = error instanceof Error ? error.message : "Failed to load reviews.";
  }

  const publications = getFallbackPublications(reviews);
  const classes = getFallbackClasses(reviews);

  // Build enriched submission records
  const enrichedSubmissions = reviews.map((review) => {
    const publication = publications.find((p) => p.id === review.assignment.publicationId);
    const classInfo = classes.find((c) => c.classId === review.class.classId);
    const submittedAt = review.testSubmittedAt || review.practiceSubmittedAt;
    const needsTestReview = review.hasLinkedTest && review.testSubmittedAt !== null;

    return {
      ...review,
      id: review.assignmentResultId,
      publicationId: review.assignment.publicationId ?? "",
      classId: review.class.classId ?? "",
      studentId: review.student.studentProfileId ?? "",
publicationTitle: publication?.title ?? review.assignment.title ?? t.teacher.reviews.submissions.unknownPublication,
      className: classInfo?.title ?? review.class.title ?? t.teacher.reviews.submissions.unknownClass,
      studentDisplayName: review.student.displayName ?? t.teacher.reviews.submissions.unknownStudent,
      studentLogin: review.student.studentLogin ?? "—",
      reviewStatus: review.review?.status ?? null,
      reviewId: review.review?.reviewId ?? null,
      submittedAt: submittedAt ?? new Date().toISOString(),
      priority: getSubmissionPriority(submittedAt, review.review?.status ?? null),
      needsTestReview,
    };
  });

  // Apply filters
  const filteredSubmissions = enrichedSubmissions.filter((s) => {
    if (filterPublication && s.publicationId !== filterPublication) return false;
    if (filterClass && s.classId !== filterClass) return false;
    if (filterStatus) {
      if (filterStatus === "pending" && s.reviewStatus) return false;
      if (filterStatus === "in-review" && s.reviewStatus !== "draft") return false;
      if (filterStatus === "released" && s.reviewStatus !== "released") return false;
    }
    if (searchQuery) {
      const searchFields = [
        s.studentDisplayName.toLowerCase(),
        s.studentLogin.toLowerCase(),
        s.publicationTitle.toLowerCase(),
        s.className.toLowerCase(),
      ];
      if (!searchFields.some((field) => field.includes(searchQuery))) return false;
    }
    return true;
  });

  // Sort by priority (high -> medium -> low) then by submission date
  const sortedSubmissions = filteredSubmissions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2, null: 3 };
    const aPriority = a.priority.level ?? "null";
    const bPriority = b.priority.level ?? "null";
    if (priorityOrder[aPriority] !== priorityOrder[bPriority]) {
      return priorityOrder[aPriority] - priorityOrder[bPriority];
    }
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  // Calculate stats
  const totalSubmissions = enrichedSubmissions.length;
  const pendingCount = enrichedSubmissions.filter((s) => !s.reviewStatus).length;
  const inReviewCount = enrichedSubmissions.filter((s) => s.reviewStatus === "draft").length;
  const releasedCount = enrichedSubmissions.filter((s) => s.reviewStatus === "released").length;
  const overdueCount = enrichedSubmissions.filter((s) => s.priority.level === "high").length;
  const testReviewCount = enrichedSubmissions.filter((s) => s.needsTestReview).length;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 font-bold text-foreground">{t.teacher.reviews.title}</h1>
            <p className="mt-1 text-body text-foreground-secondary">
              {t.teacher.reviews.description}
            </p>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{fetchError}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.stats.total}</p>
              <p className="font-medium text-foreground">{totalSubmissions}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info-subtle">
              <FileText className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.stats.pending}</p>
              <p className="font-medium text-foreground">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-subtle">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.stats.inReview}</p>
              <p className="font-medium text-foreground">{inReviewCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.stats.released}</p>
              <p className="font-medium text-foreground">{releasedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-subtle">
              <AlertCircle className="h-5 w-5 text-error" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.stats.overdue}</p>
              <p className="font-medium text-foreground">{overdueCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-subtle">
              <BookOpen className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.stats.testReview}</p>
              <p className="font-medium text-foreground">{testReviewCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card elevation="sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-secondary" />
              <form action="/teacher/reviews" method="GET">
                <Input
                  name="search"
                  placeholder={t.teacher.reviews.searchPlaceholder}
                  className="pl-10"
                  defaultValue={searchQuery}
                />
              </form>
            </div>
            <ReviewsFilters
              publications={publications.map((p) => ({ id: p.id, title: p.title }))}
              classes={classes.map((c) => ({ classId: c.classId, title: c.title }))}
              filterPublication={filterPublication}
              filterClass={filterClass}
              filterStatus={filterStatus}
              searchQuery={searchQuery}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
<div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.reviews.submissions.title}</CardTitle>
            </div>
            <Badge variant="default" size="sm">
              {sortedSubmissions.length} of {totalSubmissions}
            </Badge>
          </div>
<CardDescription>
            {t.teacher.reviews.submissions.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sortedSubmissions.length === 0 ? (
<EmptyState
              icon={<ClipboardCheck className="h-6 w-6" />}
              title={t.teacher.reviews.submissions.emptyTitle}
              description={t.teacher.reviews.submissions.emptyDescription}
              action={
                publications.length > 0 ? (
                  <Button variant="primary" size="sm" asChild>
                    <Link href="/teacher/publications">{t.teacher.reviews.submissions.viewPublications}</Link>
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" asChild>
                    <Link href="/teacher/assignments">{t.teacher.reviews.submissions.createAssignment}</Link>
                  </Button>
                )
              }
            />
          ) : (
            <Table>
<TableHeader>
                <TableRow>
                  <TableHead>{t.teacher.reviews.submissions.headers.priority}</TableHead>
                  <TableHead>{t.teacher.reviews.submissions.headers.student}</TableHead>
                  <TableHead>{t.teacher.reviews.submissions.headers.publication}</TableHead>
                  <TableHead>{t.teacher.reviews.submissions.headers.class}</TableHead>
                  <TableHead>{t.teacher.reviews.submissions.headers.submitted}</TableHead>
                  <TableHead>{t.teacher.reviews.submissions.headers.status}</TableHead>
                  <TableHead>{t.teacher.reviews.submissions.headers.reviewType}</TableHead>
                  <TableHead>{t.teacher.reviews.submissions.headers.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSubmissions.map((submission) => {
                  const statusConfig = getReviewStatusConfig(submission.reviewStatus);
                  const priorityColorClass =
                    submission.priority.level === "high"
                      ? "text-error"
                      : submission.priority.level === "medium"
                      ? "text-warning"
                      : "text-foreground-secondary";

                  return (
                    <TableRow key={submission.id} interactive>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${priorityColorClass}`}>
                          {submission.priority.icon}
                          <span className="text-sm font-medium">{submission.priority.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {submission.studentDisplayName}
                          </span>
                          <span className="text-xs text-foreground-secondary">
                            {submission.studentLogin}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-foreground-secondary" />
                          <span className="text-foreground">{submission.publicationTitle}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-foreground-secondary" />
                          <span className="text-foreground">{submission.className}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-foreground">
                            {formatDate(submission.submittedAt)}
                          </span>
                          <span className="text-xs text-foreground-secondary">
                            {getRelativeTime(submission.submittedAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusChip status={statusConfig.status} size="sm">
                          {statusConfig.label}
                        </StatusChip>
                      </TableCell>
<TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="default" size="sm">{t.teacher.reviews.submissions.practice}</Badge>
                          {submission.needsTestReview && (
                            <Badge variant="warning" size="sm">
                              <BookOpen className="h-3 w-3 mr-1" />
                              {t.teacher.reviews.submissions.test}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="primary"
                          size="sm"
                          asChild
                          rightIcon={<ArrowRight className="h-4 w-4" />}
                        >
<Link href={`/teacher/reviews/${submission.id}`}>
                            {submission.reviewStatus === "released" ? t.teacher.reviews.submissions.view : t.teacher.reviews.submissions.review}
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

      {/* Publications Quick Links */}
      {publications.length > 0 && (
        <Card elevation="sm">
<CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.reviews.publicationLinks.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {publications.map((pub) => {
                const pubSubmissions = enrichedSubmissions.filter(
                  (s) => s.publicationId === pub.id
                );
                const pubPending = pubSubmissions.filter((s) => !s.reviewStatus).length;
                const pubInReview = pubSubmissions.filter((s) => s.reviewStatus === "draft").length;
                const pubReleased = pubSubmissions.filter((s) => s.reviewStatus === "released").length;

                return (
                  <Link
                    key={pub.id}
                    href={`/teacher/reviews?publication=${pub.id}`}
                    className="group rounded-card border border-border bg-surface p-4 transition-colors hover:border-primary-subtle hover:bg-primary-subtle/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium text-foreground group-hover:text-primary">
                          {pub.title}
                        </h3>
                        <p className="mt-1 text-sm text-foreground-secondary">
                          {t.teacher.reviews.submissions.submissionCount(pubSubmissions.length)}
                        </p>
                      </div>
<div className="flex items-center gap-2">
                         {pubPending > 0 && (
                           <Badge variant="info" size="sm">
                             {t.teacher.reviews.submissions.pendingCount(pubPending)}
                           </Badge>
                         )}
                         {pubInReview > 0 && (
                           <Badge variant="warning" size="sm">
                             {t.teacher.reviews.submissions.inReviewCount(pubInReview)}
                           </Badge>
                         )}
                         {pubReleased > 0 && pubPending === 0 && pubInReview === 0 && (
                           <Badge variant="success" size="sm">
                             {t.teacher.reviews.submissions.complete}
                           </Badge>
                         )}
                       </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {total > 20 && (() => {
        const totalPages = Math.ceil(total / 20);
        return (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-foreground-secondary">
              {t.teacher.reviews.submissions.pageOf(page, totalPages, total)}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={`/teacher/reviews?page=${page - 1}${filterPublication ? `&publication=${filterPublication}` : ""}${filterClass ? `&class=${filterClass}` : ""}${filterStatus ? `&status=${filterStatus}` : ""}${searchQuery ? `&search=${searchQuery}` : ""}`}
                  className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  {t.teacher.reviews.submissions.previous}
                </Link>
              ) : (
                <span className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm text-foreground-muted cursor-not-allowed">
                  {t.teacher.reviews.submissions.previous}
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={`/teacher/reviews?page=${page + 1}${filterPublication ? `&publication=${filterPublication}` : ""}${filterClass ? `&class=${filterClass}` : ""}${filterStatus ? `&status=${filterStatus}` : ""}${searchQuery ? `&search=${searchQuery}` : ""}`}
                  className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  {t.teacher.reviews.submissions.next}
                </Link>
              ) : (
                <span className="inline-flex h-9 items-center justify-center rounded-control-md border border-border px-4 text-sm text-foreground-muted cursor-not-allowed">
                  {t.teacher.reviews.submissions.next}
                </span>
              )}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
