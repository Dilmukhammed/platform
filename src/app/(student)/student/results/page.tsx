import Link from "next/link";
import { format } from "date-fns";

import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
import {
  listStudentResults,
  type StudentGradeInfo as GradeInfo,
  type StudentResultSummary as ResultItem,
} from "@/modules/students/server-data";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Award, FileText, Calendar, ChevronRight } from "lucide-react";

function getGradeBadgeVariant(
  score: number | null,
): "default" | "success" | "warning" | "error" | "primary" {
  if (score === null) return "default";
  if (score >= 80) return "success";
  if (score >= 60) return "primary";
  if (score >= 40) return "warning";
  return "error";
}

function formatScore(score: number | null): string {
  return score === null ? "—" : `${score.toFixed(1)}%`;
}

export default async function StudentResultsPage() {
  const session = await requireAreaAccess("student");

  let results: ResultItem[] = [];
  let totalResults = 0;
  let error: string | null = null;

  try {
    const resultsResponse = await listStudentResults(session.userId);
    results = resultsResponse.data;
    totalResults = resultsResponse.meta.pagination.total;
  } catch (err) {
    error = err instanceof Error ? err.message : t.student.results.detail.notFound.description;
  }

  // Sort by release date, newest first
  const sortedResults = [...results].sort(
    (a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime()
  );
  const scoredResults = sortedResults.filter(
    (result): result is ResultItem & { grade: GradeInfo & { finalScore: number } } =>
      result.grade?.finalScore !== null && result.grade?.finalScore !== undefined
  );
  const averageScore =
    scoredResults.length > 0
      ? scoredResults.reduce((total, result) => total + result.grade.finalScore, 0) /
        scoredResults.length
      : null;
  const highestScore =
    scoredResults.length > 0
      ? Math.max(...scoredResults.map((result) => result.grade.finalScore))
      : null;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-bold text-foreground">{t.student.results.title}</h1>
          <p className="mt-1 text-body text-foreground-secondary">
            {t.student.results.description}
          </p>
        </div>
        <Badge variant="info" size="md">
          {t.student.results.count(totalResults)}
        </Badge>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-card border border-error bg-error-subtle p-4 text-error">
          {error}
        </div>
      )}

      {/* Results Table */}
      {!error && sortedResults.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Award className="h-6 w-6" />}
            title={t.student.results.emptyTitle}
            description={t.student.results.emptyDescription}
          />
        </Card>
      ) : (
        <Card elevation="sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow noHover>
                  <TableHead>{t.student.results.table.headers.assignment}</TableHead>
                  <TableHead>{t.student.results.table.headers.class}</TableHead>
                  <TableHead>{t.student.results.table.headers.released}</TableHead>
                  <TableHead className="text-right">{t.student.results.table.headers.score}</TableHead>
                  <TableHead className="text-right">{t.student.results.table.headers.grade}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.map((result) => {
                  const finalScore = result.grade?.finalScore ?? null;
                  const mappedGrade = result.grade?.mappedGrade ?? null;

                  return (
                    <TableRow key={result.assignmentResultId} interactive>
                      <TableCell>
                        <Link
                          href={`/student/results/${result.assignmentResultId}`}
                          className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                        >
                          <FileText className="h-4 w-4 text-foreground-secondary" />
                          {result.assignmentTitle ?? t.student.results.table.untitledAssignment}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-body-sm text-foreground-secondary">
                          {result.classTitle ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-body-sm text-foreground-secondary">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(result.releasedAt), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={getGradeBadgeVariant(finalScore)}
                          size="sm"
                        >
                          {formatScore(finalScore)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={mappedGrade ? "primary" : "default"} size="sm">
                          {mappedGrade ?? t.student.results.table.noGrade}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/student/results/${result.assignmentResultId}`}
                          className="flex items-center justify-center text-foreground-secondary hover:text-foreground transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {!error && sortedResults.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card elevation="sm">
            <CardContent className="p-4">
              <div className="text-body-sm text-foreground-secondary">{t.student.results.summary.averageScore}</div>
              <div className="mt-1 text-h2 font-bold text-foreground">
                {averageScore === null ? "—" : `${averageScore.toFixed(1)}%`}
              </div>
            </CardContent>
          </Card>
          <Card elevation="sm">
            <CardContent className="p-4">
              <div className="text-body-sm text-foreground-secondary">{t.student.results.summary.highestScore}</div>
              <div className="mt-1 text-h2 font-bold text-success">
                {highestScore === null ? "—" : `${highestScore.toFixed(1)}%`}
              </div>
            </CardContent>
          </Card>
          <Card elevation="sm">
            <CardContent className="p-4">
              <div className="text-body-sm text-foreground-secondary">{t.student.results.summary.totalAssignments}</div>
              <div className="mt-1 text-h2 font-bold text-foreground">
                {totalResults}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
