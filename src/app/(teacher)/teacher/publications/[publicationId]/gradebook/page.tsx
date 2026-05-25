import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  AlertCircle,
  Calculator,
  Users,
  FileEdit,
  CheckCircle,
  Clock,
} from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { apiGet } from "@/lib/api/server-fetch";
import { getGradeBadgeVariant, getGradeStatusChip } from "@/app/(teacher)/teacher/gradebook/gradebook-helpers";
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
import { t } from "@/lib/translations";

type Publication = {
  id: string;
  title: string;
  organizationName: string;
};

type FormulaSnapshot = {
  practiceWeight: number;
  testWeight: number;
};

type GradebookGrade = {
  id: string;
  studentId: string;
  practiceScoreRaw: number | null;
  testScoreRaw: number | null;
  finalScoreRaw: number | null;
  mappedGrade: string | null;
  overrideReason: string | null;
  formulaSnapshot: FormulaSnapshot | null;
};

type GradebookData = {
  grades: GradebookGrade[];
  totalStudents: number;
  gradedCount: number;
  averageScore: number | null;
  overrideCount: number;
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    belowAverage: number;
  };
};

export default async function GradebookPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAreaAccess("teacher");
  const { publicationId } = await params;
  const query = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;

  let publication: Publication | null = null;
  let gradebookData: GradebookData | null = null;
  let fetchError: string | null = null;

  try {
    publication = await apiGet<Publication>(`/api/v1/teacher/publications/${publicationId}`);
    gradebookData = await apiGet<GradebookData>(`/api/v1/teacher/publications/${publicationId}/gradebook`);
  } catch (err) {
    console.error("[publications/gradebook] Failed to load gradebook:", err);
    const message = err instanceof Error ? err.message : t.teacher.publications.gradebook.loadFailed;
    // Only show 404 for actual "not found" errors, not for server errors
    if (message.toLowerCase().includes("not found")) {
      notFound();
    }
    fetchError = message;
  }

  if (fetchError || !publication || !gradebookData) {
    return (
      <section className="space-y-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href={`/teacher/publications/${publicationId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t.teacher.publications.gradebook.back}
          </Link>
        </Button>
        <Card elevation="sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 rounded-card border border-error bg-error-subtle/40 p-4 text-error">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">{t.teacher.publications.gradebook.loadFailed}</p>
                <p className="text-sm">{fetchError ?? t.teacher.publications.gradebook.publicationNotFound}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const { grades, totalStudents, gradedCount, averageScore, overrideCount, scoreDistribution } = gradebookData;
  const pendingCount = totalStudents - gradedCount;

  return (
    <section className="space-y-6">
{/* Back Navigation */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/teacher/publications/${publicationId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.teacher.publications.gradebook.back}
        </Link>
      </Button>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 font-bold text-foreground">{t.teacher.publications.gradebook.title}</h1>
            <p className="mt-1 text-body text-foreground-secondary">
              {publication.title}
            </p>
          </div>
          <Badge variant="primary" size="md">
            {publication.organizationName}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.stats.totalStudents}</p>
              <p className="font-medium text-foreground">{totalStudents}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.stats.graded}</p>
              <p className="font-medium text-foreground">{gradedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-subtle">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.stats.pending}</p>
              <p className="font-medium text-foreground">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.stats.classAverage}</p>
              <p className="font-medium text-foreground">
                {averageScore !== null ? `${averageScore}%` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Distribution */}
      {grades.length > 0 && (
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.publications.gradebook.distribution.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-success-subtle bg-success-subtle/50 p-4">
                <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.distribution.excellent}</p>
                <p className="mt-1 text-2xl font-bold text-success">{scoreDistribution.excellent}</p>
                <p className="text-xs text-foreground-secondary">
                  {t.teacher.publications.gradebook.distribution.percentOfGraded(Math.round((scoreDistribution.excellent / grades.length) * 100))}
                </p>
              </div>
              <div className="rounded-lg border border-primary-subtle bg-primary-subtle/50 p-4">
                <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.distribution.good}</p>
                <p className="mt-1 text-2xl font-bold text-primary">{scoreDistribution.good}</p>
                <p className="text-xs text-foreground-secondary">
                  {t.teacher.publications.gradebook.distribution.percentOfGraded(Math.round((scoreDistribution.good / grades.length) * 100))}
                </p>
              </div>
              <div className="rounded-lg border border-warning-subtle bg-warning-subtle/50 p-4">
                <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.distribution.average}</p>
                <p className="mt-1 text-2xl font-bold text-warning">{scoreDistribution.average}</p>
                <p className="text-xs text-foreground-secondary">
                  {t.teacher.publications.gradebook.distribution.percentOfGraded(Math.round((scoreDistribution.average / grades.length) * 100))}
                </p>
              </div>
              <div className="rounded-lg border border-error-subtle bg-error-subtle/50 p-4">
                <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.distribution.belowAverage}</p>
                <p className="mt-1 text-2xl font-bold text-error">{scoreDistribution.belowAverage}</p>
                <p className="text-xs text-foreground-secondary">
                  {t.teacher.publications.gradebook.distribution.percentOfGraded(Math.round((scoreDistribution.belowAverage / grades.length) * 100))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Override Notice */}
      {overrideCount > 0 && (
        <div className="rounded-card border border-warning bg-warning-subtle p-4 text-warning">
          <div className="flex items-center gap-2">
            <FileEdit className="h-4 w-4" />
            <span className="font-medium">
              {t.teacher.publications.gradebook.overrides.notice(overrideCount)}
            </span>
          </div>
        </div>
      )}

      {/* Grades Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.publications.gradebook.table.title}</CardTitle>
            </div>
            <Badge variant="default" size="sm">
              {grades.length} of {totalStudents}
            </Badge>
          </div>
          <CardDescription>
            {t.teacher.publications.gradebook.table.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {grades.length === 0 ? (
            <EmptyState
              icon={<Award className="h-6 w-6" />}
              title={t.teacher.publications.gradebook.table.emptyTitle}
              description={t.teacher.publications.gradebook.table.emptyDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.studentId}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.status}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.practiceScore}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.testScore}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.finalScore}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.grade}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.override}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => {
                  const status = getGradeStatusChip(grade);

                  return (
                    <TableRow key={grade.id} interactive>
                      <TableCell className="font-medium text-foreground">
                        {grade.studentId}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={status.status} size="sm">
                          {status.label}
                        </StatusChip>
                      </TableCell>
                      <TableCell>
                        {grade.practiceScoreRaw !== null ? (
                          <span className="text-foreground">{grade.practiceScoreRaw}%</span>
                        ) : (
                          <span className="text-foreground-secondary">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {grade.testScoreRaw !== null ? (
                          <span className="text-foreground">{grade.testScoreRaw}%</span>
                        ) : (
                          <span className="text-foreground-secondary">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {grade.finalScoreRaw !== null ? `${grade.finalScoreRaw}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getGradeBadgeVariant(grade.finalScoreRaw)}>
                          {grade.mappedGrade ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {grade.overrideReason ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="warning" size="sm">
                              {t.teacher.publications.gradebook.table.overridden}
                            </Badge>
                            <span className="text-xs text-foreground-secondary truncate max-w-[150px]">
                              {grade.overrideReason}
                            </span>
                          </div>
                        ) : (
                          <span className="text-foreground-secondary">—</span>
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

      {/* Grading Formula Info */}
      {grades.some((g) => g.formulaSnapshot) && (() => {
        const snapshot = grades.find((g) => g.formulaSnapshot)?.formulaSnapshot;
        if (!snapshot) return null;
        return (
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.publications.gradebook.formula.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-foreground-secondary">{t.teacher.publications.gradebook.formula.practiceWeight}</span>
                <Badge variant="default" size="sm">
                  {Math.round(snapshot.practiceWeight * 100)}%
                </Badge>
              </div>
              <span className="text-foreground-secondary">+</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground-secondary">{t.teacher.publications.gradebook.formula.testWeight}</span>
                <Badge variant="default" size="sm">
                  {Math.round(snapshot.testWeight * 100)}%
                </Badge>
              </div>
              <span className="text-foreground-secondary">=</span>
              <span className="text-foreground">{t.teacher.publications.gradebook.formula.finalScore}</span>
            </div>
          </CardContent>
        </Card>
        );
      })()}
    </section>
  );
}
