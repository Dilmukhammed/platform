"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Award,
  Calculator,
  CheckCircle,
  Clock,
  FileEdit,
  Search,
  Filter,
  Download,
  GraduationCap,
  BookOpen,
  AlertCircle,
} from "lucide-react";

import { apiGet } from "@/lib/api/client-fetch";
import { t } from "@/lib/translations";
import { getGradeBadgeVariant, getGradeStatusChip } from "./gradebook-helpers";
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

// Export grades to CSV
function exportGradesToCSV(
  grades: Array<{
    studentDisplayName: string;
    studentLogin: string;
    publicationTitle: string;
    classId: string;
    practiceScoreRaw: number | null;
    testScoreRaw: number | null;
    finalScoreRaw: number | null;
    mappedGrade: string | null;
    overrideReason: string | null;
  }>,
  classes: Array<{ classId: string; title: string }>
) {
  // CSV headers
  const headers = [
    t.teacher.gradebook.table.headers.studentId,
    t.teacher.gradebook.recentGrades.headers.student,
    "Login",
    t.teacher.gradebook.table.headers.actions,
    t.teacher.publications.classTargets.headers.class,
    t.teacher.gradebook.table.headers.practiceScore,
    t.teacher.gradebook.table.headers.testScore,
    t.teacher.gradebook.table.headers.finalScore,
    t.teacher.gradebook.table.headers.grade,
    t.teacher.gradebook.table.headers.status,
  ];

  // Map grades to CSV rows
  const rows = grades.map((grade) => {
    const className = classes.find((c) => c.classId === grade.classId)?.title || t.teacher.gradebook.publicationNotFound;
    const status = grade.practiceScoreRaw !== null && grade.testScoreRaw !== null
      ? t.teacher.gradebook.stats.graded
      : grade.practiceScoreRaw !== null || grade.testScoreRaw !== null
      ? "Qisman"
      : t.teacher.gradebook.stats.pending;

    return [
      grade.studentDisplayName,
      grade.studentLogin,
      className,
      grade.publicationTitle,
      grade.practiceScoreRaw !== null ? `${grade.practiceScoreRaw}%` : "",
      grade.testScoreRaw !== null ? `${grade.testScoreRaw}%` : "",
      grade.finalScoreRaw !== null ? `${grade.finalScoreRaw}%` : "",
      grade.mappedGrade ?? "—",
      status,
      grade.overrideReason || "",
    ];
  });

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          // Escape cells containing commas, quotes, or newlines
          const cellStr = String(cell);
          if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(",")
    )
    .join("\n");

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gradebook_export_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Types
interface GradebookGrade {
  resultId: string;
  publicationClassId: string;
  enrollmentId: string;
  status: string;
  grade: {
    practiceScoreRaw: number | null;
    testScoreRaw: number | null;
    finalScoreRaw: number | null;
    mappedGrade: string | null;
    overrideReason: string | null;
    formulaSnapshot?: {
      practiceWeight: number;
      testWeight: number;
    } | null;
  } | null;
  review: {
    reviewId: string;
    status: string;
  } | null;
}

interface GradebookClass {
  classId: string;
  title: string;
}

interface GradebookStudent {
  enrollmentId: string;
  studentProfileId: string;
  displayName: string;
  studentLogin: string;
}

interface GradebookAssignment {
  publicationId: string;
  publicationClassId: string;
  classId: string;
  title: string;
}

interface GradebookResponse {
  classes: GradebookClass[];
  students: GradebookStudent[];
  assignments: GradebookAssignment[];
  grades: GradebookGrade[];
}

interface EnrichedGrade {
  id: string;
  studentId: string;
  studentDisplayName: string;
  studentLogin: string;
  publicationId: string;
  publicationTitle: string;
  classId: string;
  practiceScoreRaw: number | null;
  testScoreRaw: number | null;
  finalScoreRaw: number | null;
  mappedGrade: string | null;
  overrideReason: string | null;
}

export default function GradebookContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams?.get("classId") ?? null;

  const [gradebookData, setGradebookData] = useState<GradebookResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPublicationId, setSelectedPublicationId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(classId ?? "");

  useEffect(() => {
    async function fetchData() {
      try {
        setErrorMessage(null);
        const url = classId
          ? `/api/v1/teacher/gradebook?classId=${classId}`
          : "/api/v1/teacher/gradebook";
        const data = await apiGet<GradebookResponse>(url);
        setGradebookData(data);
      } catch (error) {
        console.error("Failed to fetch gradebook data:", error);
        setErrorMessage(error instanceof Error ? error.message : t.teacher.publications.gradebook.loadFailed);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [classId]);

if (errorMessage) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-h1 font-bold text-foreground">{t.teacher.gradebook.title}</h1>
          <p className="mt-1 text-body text-foreground-secondary">
            {t.teacher.gradebook.description}
          </p>
        </div>
        <Card elevation="sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 rounded-card border border-error bg-error-subtle/40 p-4 text-error">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">{t.teacher.gradebook.loadFailed}</p>
                <p className="text-sm">{errorMessage}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

if (isLoading || !gradebookData) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-h1 font-bold text-foreground">{t.teacher.gradebook.title}</h1>
          <p className="mt-1 text-body text-foreground-secondary">{t.teacher.gradebook.loading}</p>
        </div>
      </section>
    );
  }

  const allGrades = gradebookData.grades;
  const gradebookClasses = gradebookData.classes;
  const gradebookStudents = gradebookData.students;
  const gradebookAssignments = gradebookData.assignments;

  // Build enriched grade records with assignment and student info
  const enrichedGrades: EnrichedGrade[] = allGrades.map((grade) => {
    const assignment = gradebookAssignments.find((a) => a.publicationClassId === grade.publicationClassId);
    const student = gradebookStudents.find((s) => s.enrollmentId === grade.enrollmentId);
return {
      id: grade.resultId,
      studentId: student?.studentProfileId ?? grade.enrollmentId,
      studentDisplayName: student?.displayName ?? t.teacher.reviews.submissions.unknownStudent,
      studentLogin: student?.studentLogin ?? "—",
      publicationId: assignment?.publicationId ?? "",
      publicationTitle: assignment?.title ?? t.teacher.reviews.submissions.unknownPublication,
      classId: assignment?.classId ?? "",
      practiceScoreRaw: grade.grade?.practiceScoreRaw ?? null,
      testScoreRaw: grade.grade?.testScoreRaw ?? null,
      finalScoreRaw: grade.grade?.finalScoreRaw ?? null,
      mappedGrade: grade.grade?.mappedGrade ?? null,
      overrideReason: grade.grade?.overrideReason ?? null,
    };
  });

  // Get unique publications for filter
  const uniquePublications = Array.from(
    new Map(enrichedGrades.map((g) => [g.publicationId, { id: g.publicationId, title: g.publicationTitle }])).values()
  );

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredGrades = enrichedGrades.filter((grade) => {
    if (selectedPublicationId && grade.publicationId !== selectedPublicationId) {
      return false;
    }

    if (selectedClassId && grade.classId !== selectedClassId) {
      return false;
    }

    if (!normalizedSearchQuery) {
      return true;
    }

    return (
      grade.studentDisplayName.toLowerCase().includes(normalizedSearchQuery) ||
      grade.studentLogin.toLowerCase().includes(normalizedSearchQuery) ||
      grade.publicationTitle.toLowerCase().includes(normalizedSearchQuery)
    );
  });

  const totalGrades = filteredGrades.length;
  const completedGrades = filteredGrades.filter(
    (g) => g.finalScoreRaw !== null
  ).length;
  const pendingGrades = totalGrades - completedGrades;
  const overrideCount = filteredGrades.filter((g) => g.overrideReason !== null).length;
  const gradedScores = filteredGrades.filter((g) => g.finalScoreRaw !== null).map((g) => g.finalScoreRaw as number);
  const averageScore = gradedScores.length > 0
    ? Math.round(gradedScores.reduce((sum, s) => sum + s, 0) / gradedScores.length)
    : null;

  const scoreDistribution = {
    excellent: gradedScores.filter((s) => s >= 90).length,
    good: gradedScores.filter((s) => s >= 70 && s < 90).length,
    average: gradedScores.filter((s) => s >= 50 && s < 70).length,
    belowAverage: gradedScores.filter((s) => s < 50).length,
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
<div>
            <h1 className="text-h1 font-bold text-foreground">{t.teacher.gradebook.title}</h1>
            <p className="mt-1 text-body text-foreground-secondary">
              {t.teacher.publications.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
leftIcon={<Download className="h-4 w-4" />}
              onClick={() => exportGradesToCSV(filteredGrades, gradebookClasses)}
            >
{t.teacher.gradebook.export}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
<div>
              <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.stats.totalStudents}</p>
              <p className="font-medium text-foreground">{totalGrades}</p>
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
              <p className="font-medium text-foreground">{completedGrades}</p>
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
              <p className="font-medium text-foreground">{pendingGrades}</p>
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
      {totalGrades > 0 && (
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
                  {gradedScores.length > 0 ? t.teacher.publications.gradebook.distribution.percentOfGraded(Math.round((scoreDistribution.excellent / gradedScores.length) * 100)) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-primary-subtle bg-primary-subtle/50 p-4">
                <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.distribution.good}</p>
                <p className="mt-1 text-2xl font-bold text-primary">{scoreDistribution.good}</p>
                <p className="text-xs text-foreground-secondary">
                  {gradedScores.length > 0 ? t.teacher.publications.gradebook.distribution.percentOfGraded(Math.round((scoreDistribution.good / gradedScores.length) * 100)) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-warning-subtle bg-warning-subtle/50 p-4">
                <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.distribution.average}</p>
                <p className="mt-1 text-2xl font-bold text-warning">{scoreDistribution.average}</p>
                <p className="text-xs text-foreground-secondary">
                  {gradedScores.length > 0 ? t.teacher.publications.gradebook.distribution.percentOfGraded(Math.round((scoreDistribution.average / gradedScores.length) * 100)) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-error-subtle bg-error-subtle/50 p-4">
                <p className="text-sm text-foreground-secondary">{t.teacher.publications.gradebook.distribution.belowAverage}</p>
                <p className="mt-1 text-2xl font-bold text-error">{scoreDistribution.belowAverage}</p>
                <p className="text-xs text-foreground-secondary">
                  {gradedScores.length > 0 ? t.teacher.publications.gradebook.distribution.percentOfGraded(Math.round((scoreDistribution.belowAverage / gradedScores.length) * 100)) : "—"}
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

      {/* Filters */}
      <Card elevation="sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-secondary" />
<Input
                placeholder={t.teacher.reviews.searchPlaceholder}
                className="pl-10"
                disabled={totalGrades === 0}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
<div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-foreground-secondary" />
              <span className="text-sm text-foreground-secondary">{t.teacher.reviews.filters.label}</span>
              <select
                className="rounded-control-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-border-focus"
                disabled={uniquePublications.length === 0}
                value={selectedPublicationId}
                onChange={(event) => setSelectedPublicationId(event.target.value)}
              >
                <option value="">{t.teacher.reviews.filters.allPublications}</option>
                {uniquePublications.map((pub) => (
                  <option key={pub.id} value={pub.id}>
                    {pub.title}
                  </option>
                ))}
              </select>
              <select
                className="rounded-control-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-border-focus"
                disabled={gradebookClasses.length === 0}
                value={selectedClassId}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedClassId(value);
                  if (value) {
                    router.push(`/teacher/gradebook?classId=${value}`);
                  } else {
                    router.push("/teacher/gradebook");
                  }
                }}
              >
                <option value="">{t.teacher.reviews.filters.allClasses}</option>
                {gradebookClasses.map((cls) => (
                  <option key={cls.classId} value={cls.classId}>
                    {cls.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table */}
      <Card elevation="sm">
<CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.publications.gradebook.table.title}</CardTitle>
            </div>
            <Badge variant="default" size="sm">
              {totalGrades} {t.teacher.publications.gradebook.table.description || "records"}
            </Badge>
          </div>
          <CardDescription>
            {t.teacher.publications.gradebook.table.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
{filteredGrades.length === 0 ? (
            <EmptyState
              icon={<Award className="h-6 w-6" />}
              title={enrichedGrades.length === 0 ? t.teacher.publications.gradebook.table.emptyTitle : t.teacher.publications.gradebook.table.emptyDescription}
              description={
                enrichedGrades.length === 0
                  ? t.teacher.publications.gradebook.table.emptyDescription
                  : t.teacher.publications.gradebook.table.emptyDescription
              }
              action={
                <Button variant="primary" size="sm" asChild>
                  <Link href="/teacher/publications">{t.teacher.publications.detail.actions.viewGradebook || "View Publications"}</Link>
                </Button>
              }
            />
          ) : (
<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.studentId}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.practiceScore}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.testScore}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.finalScore}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.grade}</TableHead>
                  <TableHead>{t.teacher.publications.gradebook.table.headers.override}</TableHead>
                  <TableHead>{t.teacher.gradebook.table.headers.status}</TableHead>
                  <TableHead>{t.teacher.gradebook.table.headers.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGrades.map((grade) => {
                  const status = getGradeStatusChip(grade);

                  return (
                    <TableRow key={grade.id} interactive>
<TableCell className="font-medium text-foreground">
                        <div className="flex flex-col">
                          <span>{grade.studentDisplayName}</span>
                          <span className="text-xs text-foreground-secondary">{grade.studentLogin}</span>
                        </div>
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
                      <TableCell>
                        <StatusChip status={status.status} size="sm">
                          {status.label}
                        </StatusChip>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 w-8 p-0"
                        >
                          <Link href={`/teacher/publications/${grade.publicationId}/gradebook`}>
                            <BookOpen className="h-4 w-4" />
                            <span className="sr-only">{t.teacher.publications.gradebook.back}</span>
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

      {/* Publications Summary */}
      {uniquePublications.length > 0 && (
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.gradebook.publicationsWithGrades}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {uniquePublications.map((pub) => {
                const pubGrades = filteredGrades.filter((g) => g.publicationId === pub.id);
                const pubGraded = pubGrades.filter((g) => g.finalScoreRaw !== null);
                const pubAverage = pubGraded.length > 0
                  ? Math.round(pubGraded.reduce((sum, g) => sum + (g.finalScoreRaw as number), 0) / pubGraded.length)
                  : null;

                return (
                  <Link
                    key={pub.id}
                    href={`/teacher/publications/${pub.id}/gradebook`}
                    className="group rounded-card border border-border bg-surface p-4 transition-colors hover:border-primary-subtle hover:bg-primary-subtle/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium text-foreground group-hover:text-primary">
                          {pub.title}
                        </h3>
                        <p className="mt-1 text-sm text-foreground-secondary">
                          {pubGrades.length} grade{pubGrades.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Badge variant="primary" size="sm">
                        {pubAverage !== null ? `${pubAverage}%` : "—"}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
