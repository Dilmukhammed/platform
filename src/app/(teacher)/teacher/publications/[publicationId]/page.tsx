import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  GraduationCap,
  AlertCircle,
  ChevronRight,
  Users,
  Calendar,
  CheckCircle,
  Clock,
  Award,
} from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
import { apiGet } from "@/lib/api/server-fetch";
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
import { t } from "@/lib/translations";

interface Publication {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  defaultDeadline: string;
  status: string;
  classTargets: Array<{
    classId: string;
    publicationClassId: string;
    className: string;
    classSlug: string;
    rosterCount: number;
    defaultDeadline: string;
    deadlineOverride: string | null;
    effectiveDeadline: string;
    submissionStats: {
      submittedCount: number;
      reviewedCount: number;
      pendingCount: number;
      submissionRate: number;
    };
  }>;
  linkedMaterials: Array<{
    id: string;
    title: string;
    scopeType: string;
    ownerTeacherId: string;
    ownerTeacherName?: string;
  }>;
  linkedTests: Array<{
    id: string;
    title: string;
    questionCount: number;
    scopeType: string;
    ownerTeacherId: string;
    ownerTeacherName?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Grade {
  id: string;
  studentId: string;
  practiceScoreRaw: number | null;
  testScoreRaw: number | null;
  finalScoreRaw: number;
  mappedGrade: string;
}

interface SearchParams {
  created?: string;
  error?: string;
}

// Helper to format dates

// Helper to format short date
function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Get grade badge variant based on score
function getGradeBadgeVariant(score: number | null): "default" | "primary" | "success" | "warning" | "error" {
  if (score === null) return "default";
  if (score >= 90) return "success";
  if (score >= 70) return "primary";
  if (score >= 50) return "warning";
  return "error";
}

export default async function TeacherPublicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicationId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const session = await requireAreaAccess("teacher");
  const { publicationId } = await params;
  const query = (await searchParams) ?? {};

  const message = typeof query.created === "string" ? t.teacher.publications.alerts.created : null;
  const error = typeof query.error === "string" ? query.error : null;

  let publication: Publication;
  let grades: Grade[] = [];

  try {
    publication = await apiGet<Publication>(`/api/v1/teacher/publications/${publicationId}`);
  } catch {
    notFound();
  }

  // Gradebook fetch is optional — may be empty for new publications
  try {
    const gradebookResponse = await apiGet<{ grades: Grade[] }>(`/api/v1/teacher/publications/${publicationId}/gradebook`);
    grades = gradebookResponse.grades;
  } catch {
    // Gradebook not available yet — show publication without grades
    grades = [];
  }

  // Calculate aggregate stats
  const totalStudents = publication.classTargets.reduce((sum, target) => sum + target.rosterCount, 0);
  const gradedCount = grades.length;
  const averageScore = grades.length > 0
    ? Math.round(grades.reduce((sum, g) => sum + g.finalScoreRaw, 0) / grades.length)
    : null;

  return (
    <section className="space-y-6">
      {/* Back Navigation */}
<Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/teacher/publications">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.teacher.publications.detail.back}
        </Link>
      </Button>

      {/* Alert Messages */}
      {message && (
        <div className="rounded-card border border-success bg-success-subtle p-4 text-success">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
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

      {/* Publication Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 font-bold text-foreground">{publication.title}</h1>
            <p className="mt-1 text-body text-foreground-secondary">
              {publication.description ?? t.teacher.publications.detail.noDescription}
            </p>
          </div>
          <Badge variant="primary" size="md">
            {publication.organizationName}
          </Badge>
        </div>
      </div>

      {/* Meta Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
<Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.publications.detail.stats.totalStudents}</p>
              <p className="font-medium text-foreground">{totalStudents}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.publications.detail.stats.classTargets}</p>
              <p className="font-medium text-foreground">{publication.classTargets.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.publications.detail.stats.graded}</p>
              <p className="font-medium text-foreground">{gradedCount} / {totalStudents}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.publications.detail.stats.defaultDeadline}</p>
              <p className="font-medium text-foreground">{formatShortDate(publication.defaultDeadline)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

{/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href={`/teacher/publications/${publicationId}/gradebook`}>
            <Award className="mr-2 h-4 w-4" />
            {t.teacher.publications.detail.actions.viewGradebook}
          </Link>
        </Button>
      </div>

      {/* Linked Materials Section */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.publications.detail.linkedMaterials.title}</CardTitle>
            </div>
            <Badge variant="default" size="sm">
              {publication.linkedMaterials.length}
            </Badge>
          </div>
          <CardDescription>{t.teacher.publications.detail.linkedMaterials.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {publication.linkedMaterials.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title={t.teacher.publications.detail.linkedMaterials.emptyTitle}
              description={t.teacher.publications.detail.linkedMaterials.emptyDescription}
            />
          ) : (
            <div className="grid gap-3">
              {publication.linkedMaterials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-start justify-between rounded-lg border border-border bg-surface p-4"
                >
                  <div>
                    <Link
                      href={`/teacher/materials/${material.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {material.title}
                    </Link>
                    <p className="text-sm text-foreground-secondary">
                      {material.scopeType} · {material.ownerTeacherName}
                    </p>
                  </div>
                  <Badge variant={material.scopeType === "organization" ? "success" : "default"} size="sm">
                    {material.scopeType}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Tests Section */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.publications.detail.linkedTests.title}</CardTitle>
            </div>
            <Badge variant="default" size="sm">
              {publication.linkedTests.length}
            </Badge>
          </div>
          <CardDescription>{t.teacher.publications.detail.linkedTests.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {publication.linkedTests.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title={t.teacher.publications.detail.linkedTests.emptyTitle}
              description={t.teacher.publications.detail.linkedTests.emptyDescription}
            />
          ) : (
            <div className="grid gap-3">
              {publication.linkedTests.map((test) => (
                <div
                  key={test.id}
                  className="flex items-start justify-between rounded-lg border border-border bg-surface p-4"
                >
                  <div>
                    <Link
                      href={`/teacher/tests/${test.id}/edit`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {test.title}
                    </Link>
                    <p className="text-sm text-foreground-secondary">
                      {test.questionCount} questions · {test.ownerTeacherName}
                    </p>
                  </div>
                  <Badge variant={test.scopeType === "organization" ? "success" : "default"} size="sm">
                    {test.scopeType}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class Targets / Submissions Section */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.publications.detail.classTargets.title}</CardTitle>
            </div>
            <Badge variant="primary" size="sm">
              {publication.classTargets.length} classes
            </Badge>
          </div>
          <CardDescription>{t.teacher.publications.detail.classTargets.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {publication.classTargets.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-6 w-6" />}
              title={t.teacher.publications.detail.classTargets.emptyTitle}
              description={t.teacher.publications.detail.classTargets.emptyDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.teacher.publications.detail.classTargets.headers.class}</TableHead>
                  <TableHead>Oʻquvchilar</TableHead>
                  <TableHead>{t.teacher.publications.detail.classTargets.headers.deadline}</TableHead>
                  <TableHead>{t.teacher.publications.detail.classTargets.headers.submissions}</TableHead>
                  <TableHead>{t.teacher.publications.detail.classTargets.headers.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publication.classTargets.map((classTarget) => {
                  const stats = classTarget.submissionStats;
                  const hasOverride = classTarget.deadlineOverride !== null;
                  const isOverridden = hasOverride && classTarget.deadlineOverride !== classTarget.defaultDeadline;

                  return (
                    <TableRow key={classTarget.classId} interactive>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{classTarget.className}</p>
                          <p className="text-sm text-foreground-secondary">{classTarget.classSlug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground">{classTarget.rosterCount}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-foreground">
                            {formatShortDate(classTarget.effectiveDeadline)}
                          </span>
                          {isOverridden && (
                            <Badge variant="warning" size="sm">
                              {t.teacher.publications.detail.classTargets.overridden}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-foreground">
                            {stats.submittedCount} / {classTarget.rosterCount}
                          </span>
                          <span className="text-xs text-foreground-secondary">
                            {t.teacher.publications.detail.classTargets.pending(stats.pendingCount)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {stats.submissionRate >= 80 ? (
                          <StatusChip status="success" size="sm">
                            {t.teacher.publications.detail.classTargets.submittedRate(stats.submissionRate)}
                          </StatusChip>
                        ) : stats.submissionRate >= 50 ? (
                          <StatusChip status="warning" size="sm">
                            {t.teacher.publications.detail.classTargets.submittedRate(stats.submissionRate)}
                          </StatusChip>
                        ) : (
                          <StatusChip status="info" size="sm">
                            {t.teacher.publications.detail.classTargets.submittedRate(stats.submissionRate)}
                          </StatusChip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Grades Preview */}
      {grades.length > 0 && (
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-foreground-secondary" />
                <CardTitle>{t.teacher.publications.detail.recentGrades.title}</CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/teacher/publications/${publicationId}/gradebook`}>
                  {t.teacher.publications.detail.recentGrades.viewAll}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <CardDescription>
              {averageScore !== null && (
                <span className="flex items-center gap-2">
                  {t.teacher.publications.detail.recentGrades.classAverage}:
                  <Badge variant={getGradeBadgeVariant(averageScore)}>
                    {averageScore}%
                  </Badge>
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.teacher.publications.detail.recentGrades.headers.student}</TableHead>
                  <TableHead>{t.teacher.publications.detail.recentGrades.headers.practice}</TableHead>
                  <TableHead>{t.teacher.publications.detail.recentGrades.headers.test}</TableHead>
                  <TableHead>{t.teacher.publications.detail.recentGrades.headers.finalScore}</TableHead>
                  <TableHead>{t.teacher.publications.detail.recentGrades.headers.grade}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.slice(0, 5).map((grade) => (
                  <TableRow key={grade.id} interactive>
                    <TableCell className="font-medium">{grade.studentId}</TableCell>
                    <TableCell>{grade.practiceScoreRaw ?? "—"}</TableCell>
                    <TableCell>{grade.testScoreRaw ?? "—"}</TableCell>
                    <TableCell className="font-semibold">{grade.finalScoreRaw}%</TableCell>
                    <TableCell>
                      <Badge variant={getGradeBadgeVariant(grade.finalScoreRaw)}>
                        {grade.mappedGrade}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
