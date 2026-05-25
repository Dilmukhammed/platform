import Link from "next/link";
import { format } from "date-fns";

import { requireAreaAccess } from "@/lib/auth/guards";
import type { SubmissionFixtureKind } from "@/lib/storage/submission-assets";
import {
  getStudentReleasedReviewDetail,
  getStudentResultDetail,
  type StudentResultDetail as StudentResultDetailResponse,
  type StudentReviewDetail as ReviewDetailResponse,
} from "@/modules/students/server-data";
import { t } from "@/lib/translations";

type SubmissionAssetVariant = "original" | "preview" | "page_preview";
type ReviewStatus = "draft" | "released";

import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

import {
  ArrowLeft,
  Award,
  Calculator,
  FileText,
  MessageSquare,
  PenTool,
  AlertCircle,
  Calendar,
  User,
} from "lucide-react";

type AnnotationPayload = {
  strokes: Array<{
    points: Array<{ x: number; y: number }>;
    color: string;
    width: number;
  }>;
};

function getWorkspaceAssetId(assetId: string, pageIndex: number | null) {
  return `${assetId}:${pageIndex ?? "unknown"}`;
}

function getReviewComment(reviewData: ReviewDetailResponse) {
  return (
    reviewData.review?.teacherFeedback ??
    reviewData.review?.teacherSummary ??
    reviewData.comments[0]?.body ??
    ""
  );
}

function toAnnotationPayload(payloadJson: unknown): AnnotationPayload {
  if (typeof payloadJson !== "object" || payloadJson === null || !("strokes" in payloadJson)) {
    return { strokes: [] };
  }

  const rawStrokes = payloadJson.strokes;
  const strokes = Array.isArray(rawStrokes)
    ? rawStrokes.flatMap((stroke: unknown) => {
        if (typeof stroke !== "object" || stroke === null) {
          return [];
        }

        const strokeRecord = stroke as {
          points?: unknown;
          color?: unknown;
          width?: unknown;
        };

        const points = Array.isArray(strokeRecord.points)
          ? strokeRecord.points.flatMap((point: unknown) => {
              if (
                typeof point === "object" &&
                point !== null &&
                typeof (point as { x?: unknown }).x === "number" &&
                typeof (point as { y?: unknown }).y === "number"
              ) {
                return [
                  {
                    x: (point as { x: number }).x,
                    y: (point as { y: number }).y,
                  },
                ];
              }

              return [];
            })
          : [];

        return typeof strokeRecord.color === "string" && typeof strokeRecord.width === "number"
          ? [{ points, color: strokeRecord.color, width: strokeRecord.width }]
          : [];
      })
    : [];

  return { strokes };
}

function toFormulaSnapshot(
  formulaSnapshot: Record<string, unknown> | null | undefined,
  fallback: { practiceWeight: number; testWeight: number },
) {
  const practiceWeight = formulaSnapshot?.practiceWeight;
  const testWeight = formulaSnapshot?.testWeight;

  return {
    practiceWeight:
      typeof practiceWeight === "number" ? practiceWeight : fallback.practiceWeight,
    testWeight: typeof testWeight === "number" ? testWeight : fallback.testWeight,
  };
}

function getGradeBadgeVariant(score: number): "success" | "warning" | "error" | "primary" {
  if (score >= 80) return "success";
  if (score >= 60) return "primary";
  if (score >= 40) return "warning";
  return "error";
}

export default async function StudentResultDetailPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const session = await requireAreaAccess("student");
  const { resultId } = await params;

  let resultData: StudentResultDetailResponse;
  try {
    const result = await getStudentResultDetail(session.userId, resultId);
    if (!result) {
      throw new Error("Result not found");
    }
    resultData = result;
  } catch {
    return (
      <section className="space-y-6">
        <Link
          href="/student/results"
          className="inline-flex items-center gap-1 text-body-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.student.results.detail.back}
        </Link>
        <Card>
          <EmptyState
            icon={<AlertCircle className="h-6 w-6" />}
            title={t.student.results.detail.notFound.title}
            description={t.student.results.detail.notFound.description}
            action={
              <Button asChild variant="secondary">
                <Link href="/student/results">{t.student.results.detail.notFound.action}</Link>
              </Button>
            }
          />
        </Card>
      </section>
    );
  }

  const grade = resultData.grade;

  // Try to fetch review details
  let reviewData: ReviewDetailResponse | null = null;
  let submission: {
    id: string;
    publicationId: string;
    studentId: string;
    teacherId: string;
    resultId: string;
    classId: string;
    submittedAt: string;
    pageCount: number | null;
    organizationId: string;
    templateId: string;
    assetKind: SubmissionFixtureKind;
    originalAssetId: string;
    previewAssetIds: string[];
  } | null = null;
  let assets: Array<{
    id: string;
    submissionId: string;
    resultId: string;
    publicationId: string;
    studentId: string;
    variant: SubmissionAssetVariant;
    assetKind: SubmissionFixtureKind;
    storagePath: string;
    fixturePath: string;
    fileName: string;
    mimeType: string;
    extension: string;
    byteSize: number;
    checksum: string;
    width: number | null;
    height: number | null;
    pageNumber: number | null;
    pageCount: number | null;
    derivativeOfAssetId: string | null;
    downloadOnly: boolean;
    createdAt: string;
  }> = [];
  let transformedReview: {
    id: string;
    submissionId: string;
    resultId: string;
    publicationId: string;
    studentId: string;
    teacherId: string;
    comment: string;
    status: ReviewStatus;
    releasedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null = null;
  let annotations: Array<{
    id: string;
    reviewId: string;
    submissionId: string;
    assetId: string;
    pageNumber: number | null;
    baseWidth: number;
    baseHeight: number;
    version: number;
    data: { strokes: Array<{ points: Array<{ x: number; y: number }>; color: string; width: number }> };
    createdAt: string;
    updatedAt: string;
  }> = [];
  let transformedGrade: {
    id: string;
    resultId: string;
    studentId: string;
    publicationId: string;
    finalScoreRaw: number;
    practiceScoreRaw: number | null;
    testScoreRaw: number | null;
    mappedGrade: string;
    formulaSnapshot: { practiceWeight: number; testWeight: number };
    overrideReason: string | null;
    overriddenBy: string | null;
    overriddenAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null = null;

  try {
    reviewData = await getStudentReleasedReviewDetail(session.userId, resultId);

    const releasedReview = reviewData?.review ?? null;

    if (reviewData && releasedReview) {
      const releasedReviewData = reviewData;
      const submissionId = releasedReviewData.assignmentResultId;
      const publicationId = releasedReviewData.assignment.templateId ?? resultData.assignmentTemplateId;
      const comment = getReviewComment(releasedReviewData);
      const reviewTimestamp =
        releasedReview.reviewedAt ??
        releasedReview.updatedAt ??
        releasedReview.createdAt ??
        resultData.releasedAt ??
        new Date().toISOString();

      submission = {
        id: submissionId,
        publicationId,
        studentId: "",
        teacherId: "",
        resultId: releasedReviewData.assignmentResultId,
        classId: "",
        submittedAt: reviewTimestamp,
        pageCount: releasedReviewData.annotations.length || null,
        organizationId: "",
        templateId: publicationId,
        assetKind: "pdf",
        originalAssetId: releasedReviewData.annotations[0]?.derivedAssetId ?? submissionId,
        previewAssetIds: [],
      };

      assets = Array.from(
        new Map(
          releasedReviewData.annotations.map((annotation) => {
            const assetId = getWorkspaceAssetId(
              annotation.derivedAssetId,
              annotation.pageIndex ?? null,
            );

            return [
              assetId,
              {
                id: assetId,
                submissionId,
                resultId: releasedReviewData.assignmentResultId,
                publicationId,
                studentId: "",
                variant: "page_preview" as SubmissionAssetVariant,
                assetKind: "pdf" as SubmissionFixtureKind,
                storagePath: "",
                fixturePath: "",
                fileName:
                  annotation.pageIndex !== null
                    ? t.student.results.detail.annotatedReview.pageLabel(annotation.pageIndex + 1)
                    : t.student.results.detail.annotatedReview.title,
                mimeType: "application/pdf",
                extension: "pdf",
                byteSize: 0,
                checksum: "",
                width: annotation.baseWidth,
                height: annotation.baseHeight,
                pageNumber: annotation.pageIndex ?? null,
                pageCount: null,
                derivativeOfAssetId: annotation.derivedAssetId,
                downloadOnly: true,
                createdAt: annotation.createdAt,
              },
            ];
          }),
        ).values(),
      );

      transformedReview = {
        id: releasedReview.reviewId,
        submissionId,
        resultId: releasedReviewData.assignmentResultId,
        publicationId,
        studentId: "",
        teacherId: "",
        comment,
        status: releasedReview.status === "draft" ? "draft" : "released",
        releasedAt: releasedReview.releasedAt,
        createdAt: releasedReview.createdAt,
        updatedAt: releasedReview.updatedAt,
      };

      annotations = releasedReviewData.annotations.map((a) => ({
        id: a.annotationId,
        reviewId: releasedReview.reviewId,
        submissionId,
        assetId: getWorkspaceAssetId(a.derivedAssetId, a.pageIndex ?? null),
        pageNumber: a.pageIndex ?? null,
        baseWidth: a.baseWidth,
        baseHeight: a.baseHeight,
        version: a.version,
        data: toAnnotationPayload(a.payloadJson),
        createdAt: a.createdAt,
        updatedAt: a.createdAt,
      }));

      if (releasedReviewData.grade) {
        transformedGrade = {
          id: `grade-${releasedReviewData.assignmentResultId}`,
          resultId: releasedReviewData.assignmentResultId,
          studentId: "",
          publicationId,
          finalScoreRaw: releasedReviewData.grade.finalScore,
          practiceScoreRaw: releasedReviewData.grade.practiceScore,
          testScoreRaw: releasedReviewData.grade.testScore,
          mappedGrade: releasedReviewData.grade.mappedGrade,
          formulaSnapshot: toFormulaSnapshot(releasedReviewData.grade.formulaSnapshot, {
            practiceWeight: grade?.formulaSnapshot.practiceWeight ?? 0.5,
            testWeight: grade?.formulaSnapshot.testWeight ?? 0.5,
          }),
          overrideReason: releasedReviewData.grade.overrideReason,
          overriddenBy: null,
          overriddenAt: null,
          createdAt: releasedReview.createdAt,
          updatedAt: releasedReview.updatedAt,
        };
      }
    }
  } catch {
    // Review not available, continue without it
  }

  const hasPracticeScore = grade?.practiceScore !== null && grade?.practiceScore !== undefined;
  const hasTestScore = grade?.testScore !== null && grade?.testScore !== undefined;
  const hasBreakdown = !!grade && (hasPracticeScore || hasTestScore);

  return (
    <section className="space-y-6">
      {/* Back Link */}
      <Link
        href="/student/results"
        className="inline-flex items-center gap-1 text-body-sm text-foreground-secondary hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.student.results.detail.back}
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h1 font-bold text-foreground">
            {resultData.assignmentTitle ?? t.student.results.detail.assignmentResult}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-body-sm text-foreground-secondary">
            {resultData.classTitle && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {resultData.classTitle}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {t.student.results.detail.released(resultData.releasedAt 
                ? format(new Date(resultData.releasedAt), "MMM d, yyyy")
                : format(new Date(), "MMM d, yyyy")
              )}
            </span>
            <StatusChip status="success" size="sm">
              {t.student.results.detail.releasedStatus}
            </StatusChip>
          </div>
        </div>
        {grade ? (
          <div className="flex items-center gap-3">
            <Badge
              variant={getGradeBadgeVariant(grade.finalScore)}
              size="md"
            >
              <Award className="h-3.5 w-3.5 mr-1" />
              {grade.finalScore.toFixed(1)}%
            </Badge>
            <Badge variant="primary" size="md">
              {t.student.results.detail.breakdown.grade(grade.mappedGrade)}
            </Badge>
          </div>
        ) : (
          <Badge variant="warning" size="md">{t.student.results.detail.gradePending}</Badge>
        )}
      </div>

      {/* Grade Breakdown */}
      <Card elevation="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-foreground-secondary" />
            {t.student.results.detail.breakdown.title}
          </CardTitle>
          <CardDescription>
            {t.student.results.detail.breakdown.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {grade && hasBreakdown ? (
            <div className="space-y-4">
              {/* Component Scores */}
              <div className="grid gap-4 sm:grid-cols-2">
                {hasPracticeScore && (
                  <div className="rounded-lg bg-surface-muted p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-foreground-secondary">
                        {t.student.results.detail.breakdown.practicalScore}
                      </span>
                      <Badge variant="info" size="sm">
                        {t.student.results.detail.breakdown.weight(Math.round(grade.formulaSnapshot.practiceWeight * 100))}
                      </Badge>
                    </div>
                    <div className="mt-2 text-h3 font-bold text-foreground">
                      {grade.practiceScore!.toFixed(1)}%
                    </div>
                    <p className="mt-1 text-caption text-foreground-secondary">
                      {t.student.results.detail.breakdown.practicalSource}
                    </p>
                  </div>
                )}
                {hasTestScore && (
                  <div className="rounded-lg bg-surface-muted p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-foreground-secondary">
                        {t.student.results.detail.breakdown.testScore}
                      </span>
                      <Badge variant="info" size="sm">
                        {t.student.results.detail.breakdown.weight(Math.round(grade.formulaSnapshot.testWeight * 100))}
                      </Badge>
                    </div>
                    <div className="mt-2 text-h3 font-bold text-foreground">
                      {grade.testScore!.toFixed(1)}%
                    </div>
                    <p className="mt-1 text-caption text-foreground-secondary">
                      {t.student.results.detail.breakdown.testSource}
                    </p>
                  </div>
                )}
              </div>

              {/* Final Score */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-body font-medium text-foreground">
                      {t.student.results.detail.breakdown.finalScore}
                    </span>
                    <p className="text-body-sm text-foreground-secondary">
                      {t.student.results.detail.breakdown.weighted}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-h2 font-bold text-foreground">
                      {grade.finalScore.toFixed(1)}%
                    </div>
                    <Badge variant="primary" size="sm">
                      {t.student.results.detail.breakdown.grade(grade.mappedGrade)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Override Notice */}
              {grade.overrideReason && (
                <div className="rounded-lg bg-warning-subtle border border-warning-subtle p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">
                        {t.student.results.detail.breakdown.adjusted}
                      </p>
                      <p className="text-body-sm text-foreground-secondary mt-1">
                        {grade.overrideReason}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : grade ? (
            <div className="text-center py-8">
              <Calculator className="h-8 w-8 text-foreground-secondary mx-auto mb-3" />
              <p className="text-body text-foreground-secondary">
                {t.student.results.detail.breakdown.noBreakdown}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calculator className="h-8 w-8 text-foreground-secondary mx-auto mb-3" />
              <p className="text-body text-foreground-secondary">
                {t.student.results.detail.breakdown.gradeUnavailable}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teacher Comments */}
      {transformedReview && (
        <Card elevation="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-foreground-secondary" />
              {t.student.results.detail.feedback.title}
            </CardTitle>
            <CardDescription>
              {t.student.results.detail.feedback.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transformedReview.comment ? (
              <div className="rounded-lg bg-surface-muted p-4">
                <p className="text-body whitespace-pre-wrap text-foreground">
                  {transformedReview.comment}
                </p>
              </div>
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title={t.student.results.detail.feedback.noWrittenTitle}
                description={t.student.results.detail.feedback.noWrittenDescription}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Review Workspace with Annotations */}
      {transformedReview && submission && (
        <Card elevation="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-foreground-secondary" />
              {t.student.results.detail.annotatedReview.title}
            </CardTitle>
            <CardDescription>
              {t.student.results.detail.annotatedReview.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ReviewWorkspace
              submission={submission}
              assets={assets}
              initialReview={transformedReview}
              initialAnnotations={annotations}
              teacherId={transformedReview.teacherId}
              isStudent={true}
              initialGrade={transformedGrade ?? undefined}
            />
          </CardContent>
        </Card>
      )}

      {/* No Review Available */}
      {!transformedReview && (
        <Card elevation="sm">
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={t.student.results.detail.noReview.title}
            description={t.student.results.detail.noReview.description}
          />
        </Card>
      )}
    </section>
  );
}
