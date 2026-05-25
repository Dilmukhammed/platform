import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
  User,
  GraduationCap,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  BookOpen,
} from "lucide-react";

import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";
import { TestQuestionReview } from "@/components/review/TestQuestionReview";
import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
import { apiGet } from "@/lib/api/server-fetch";
import type { SubmissionFixtureKind } from "@/lib/storage/submission-assets";
import type { AnnotationPayload } from "@/modules/annotations/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { t } from "@/lib/translations";

// Local type definitions to match module types
type SubmissionAssetVariant = "original" | "preview" | "page_preview";
type ReviewStatus = "draft" | "released";

// Type for TestQuestionReview initialData (matches API response)
interface TestQuestionReviewInitialData {
  testId: string;
  testTitle: string;
  showResults: string;
  studentInfo: { studentProfileId: string; studentName: string };
  questions: Array<{
    questionId: string;
    orderIndex: number;
    questionType: string;
    prompt: string;
    optionsJson: Record<string, unknown> | null;
    studentAnswer: string | null;
    correctAnswer: Record<string, unknown>;
    explanation: string | null;
    currentScore: number | null;
    isCorrect: boolean | null;
    autoScored: boolean;
  }>;
  scoreRaw: number | null;
  submittedAt: string;
  reviewCompletedAt: string | null;
}

type TestQuestionReviewProps = {
  attemptId: string;
  initialData: TestQuestionReviewInitialData;
  onComplete?: () => void;
};

// Types
interface ReviewDetailResponse {
  assignmentResultId: string;
  student: {
    studentProfileId: string;
    displayName: string;
    studentLogin: string;
  };
  classInfo: {
    classId: string;
    title: string;
  };
  assignment: {
    templateId: string;
    title: string;
    description?: string;
    linkedTestId: string | null;
  };
  practiceSubmittedAt: string | null;
  testSubmittedAt: string | null;
  testAttemptId: string | null;
  review: {
    reviewId: string;
    status: string;
    reviewedByTeacherId: string;
    releasedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  comments: Array<{
    commentId: string;
    authorType: string;
    authorPlatformUserId: string | null;
    authorStudentProfileId: string | null;
    parentCommentId: string | null;
    body: string;
    isInternal: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  annotations: Array<{
    annotationId: string;
    derivedAssetId: string;
    pageIndex: number;
    version: number;
    isCurrent: boolean;
    baseWidth: number;
    baseHeight: number;
    payloadJson: Record<string, unknown>;
    createdAt: string;
  }>;
  grade: {
    gradeRecordId: string;
    mappedGrade: string;
    practiceScoreRaw: number | null;
    testScoreRaw: number | null;
    finalScoreRaw: number;
    isOverridden: boolean;
    overrideReason: string | null;
  } | null;
  submissionFiles: Array<{
    fileId: string;
    fileRole: string;
    fileKind: string;
    originalFilename: string;
    mimeType: string;
    fileSizeBytes: number;
    derivedAssets: Array<{
      assetId: string;
      kind: string;
      storagePath: string;
      pageIndex: number | null;
      width: number | null;
      height: number | null;
    }>;
  }>;
}

// Helper to format dates

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

interface ReviewPageProps {
  params: Promise<{ submissionId: string }>;
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { submissionId } = await params;
  const session = await requireAreaAccess("teacher");
  const teacherId = session.userId;

  // Fetch review details from API
  let reviewData: ReviewDetailResponse;
  try {
    reviewData = await apiGet<ReviewDetailResponse>(
      `/api/v1/teacher/assignment-results/${submissionId}/review`
    );
  } catch {
    notFound();
  }

  // Transform API response to match ReviewWorkspace component expectations
  const submission = {
    id: submissionId,
    publicationId: reviewData.assignment.templateId,
    studentId: reviewData.student.studentProfileId,
    teacherId: reviewData.review?.reviewedByTeacherId ?? teacherId,
    resultId: reviewData.assignmentResultId,
    classId: reviewData.classInfo?.classId ?? "",
    organizationId: "",
    templateId: reviewData.assignment.templateId,
    assetKind: "pdf" as SubmissionFixtureKind,
    originalAssetId: submissionId,
    previewAssetIds: [] as string[],
    submittedAt:
      reviewData.testSubmittedAt ??
      reviewData.practiceSubmittedAt ??
      reviewData.review?.createdAt ??
      new Date().toISOString(),
    pageCount: reviewData.submissionFiles.length || null,
  };

  const assets = reviewData.submissionFiles.flatMap((file) =>
    file.derivedAssets.map((da) => ({
      id: da.assetId,
      submissionId: submissionId,
      resultId: reviewData.assignmentResultId,
      publicationId: reviewData.assignment.templateId,
      studentId: reviewData.student.studentProfileId,
      variant: da.kind as SubmissionAssetVariant,
      assetKind: file.fileKind as SubmissionFixtureKind,
      storagePath: da.storagePath,
      fixturePath: da.storagePath,
      fileName: file.originalFilename,
      mimeType: file.mimeType,
      extension: file.mimeType.split("/")[1] ?? "unknown",
      byteSize: file.fileSizeBytes,
      checksum: "",
      width: da.width,
      height: da.height,
      pageNumber: da.pageIndex,
      pageCount: null,
      derivativeOfAssetId: null,
      downloadOnly: false,
      createdAt: reviewData.review?.createdAt ?? new Date().toISOString(),
    }))
  );

  const review = reviewData.review
    ? {
        id: reviewData.review.reviewId,
        submissionId: submissionId,
        resultId: reviewData.assignmentResultId,
        publicationId: reviewData.assignment.templateId,
        studentId: reviewData.student.studentProfileId,
        teacherId: reviewData.review.reviewedByTeacherId,
        comment: reviewData.comments.find((c) => !c.isInternal)?.body ?? "",
        status: reviewData.review.status as ReviewStatus,
        releasedAt: reviewData.review.releasedAt,
        createdAt: reviewData.review.createdAt,
        updatedAt: reviewData.review.updatedAt,
      }
    : null;

  const annotations = reviewData.annotations.map((a) => ({
    id: a.annotationId,
    reviewId: review?.id ?? "",
    submissionId: submissionId,
    assetId: a.derivedAssetId,
    pageNumber: a.pageIndex,
    baseWidth: a.baseWidth,
    baseHeight: a.baseHeight,
    version: a.version,
    data: (a.payloadJson ?? { strokes: [] }) as AnnotationPayload,
    createdAt: a.createdAt,
    updatedAt: a.createdAt,
  }));

  const grade = reviewData.grade
    ? {
        id: reviewData.grade.gradeRecordId,
        resultId: reviewData.assignmentResultId,
        studentId: reviewData.student.studentProfileId,
        publicationId: reviewData.assignment.templateId,
        finalScoreRaw: reviewData.grade.finalScoreRaw,
        practiceScoreRaw: reviewData.grade.practiceScoreRaw,
        testScoreRaw: reviewData.grade.testScoreRaw,
        mappedGrade: reviewData.grade.mappedGrade,
        formulaSnapshot: { practiceWeight: 0.5, testWeight: 0.5 },
        overrideReason: reviewData.grade.overrideReason,
        overriddenBy: null,
        overriddenAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    : null;

  const reviewStatus = getReviewStatusConfig(review?.status ?? null);

  // Determine if test review should be shown
  const hasLinkedTest = reviewData.assignment.linkedTestId !== null;
  const testSubmitted = reviewData.testSubmittedAt !== null;
  const showTestReview = hasLinkedTest && testSubmitted && reviewData.testAttemptId !== null;

  // Fetch test review data if applicable
  let testReviewData: TestQuestionReviewProps["initialData"] | null = null;
  if (showTestReview && reviewData.testAttemptId) {
    try {
      testReviewData = await apiGet<TestQuestionReviewProps["initialData"]>(
        `/api/v1/teacher/test-attempts/${reviewData.testAttemptId}/review`
      );
    } catch {
      // Test review data fetch failed — show practice review only
    }
  }

  return (
    <section className="space-y-6">
{/* Back Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />} asChild>
          <Link href="/teacher/reviews">{t.teacher.reviews.detail.back}</Link>
        </Button>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-h1 font-bold text-foreground">{t.teacher.reviews.detail.title}</h1>
            <p className="mt-1 text-body text-foreground-secondary">
              {t.teacher.reviews.detail.description}
            </p>
          </div>
          <StatusChip status={reviewStatus.status} size="md">
            {reviewStatus.label}
          </StatusChip>
        </div>
      </div>

{/* Submission Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.detail.stats.student}</p>
              <p className="font-medium text-foreground">{reviewData.student.displayName ?? t.teacher.reviews.submissions.unknownStudent}</p>
              <p className="text-xs text-foreground-secondary">{reviewData.student.studentLogin ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info-subtle">
              <GraduationCap className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.detail.stats.publication}</p>
              <p className="font-medium text-foreground">{reviewData.assignment.title}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-subtle">
              <ClipboardCheck className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.detail.stats.class}</p>
              <p className="font-medium text-foreground">{reviewData.classInfo?.title ?? t.teacher.reviews.submissions.unknownClass}</p>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle">
              <Calendar className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-foreground-secondary">{t.teacher.reviews.detail.stats.submitted}</p>
              <p className="font-medium text-foreground">
                {formatDate(submission.submittedAt)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

{/* Grade Summary Card */}
      {grade && (
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.reviews.detail.gradeSummary.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-primary-subtle bg-primary-subtle/30 p-4">
                <p className="text-sm text-foreground-secondary">{t.teacher.reviews.detail.gradeSummary.finalScore}</p>
                <p className="mt-1 text-2xl font-bold text-primary">{grade.finalScoreRaw}%</p>
              </div>
              <div className="rounded-lg border border-success-subtle bg-success-subtle/30 p-4">
                <p className="text-sm text-foreground-secondary">{t.teacher.reviews.detail.gradeSummary.letterGrade}</p>
                <p className="mt-1 text-2xl font-bold text-success">{grade.mappedGrade}</p>
              </div>
              {grade.practiceScoreRaw !== null && (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-sm text-foreground-secondary">{t.teacher.reviews.detail.gradeSummary.practiceScore}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{grade.practiceScoreRaw}%</p>
                </div>
              )}
              {grade.testScoreRaw !== null && (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-sm text-foreground-secondary">{t.teacher.reviews.detail.gradeSummary.testScore}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{grade.testScoreRaw}%</p>
                </div>
              )}
            </div>
            {grade.overrideReason && (
              <div className="mt-4 rounded-card border border-warning bg-warning-subtle/50 p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" />
                  <span className="font-medium text-warning">{t.teacher.reviews.detail.gradeSummary.overridden}</span>
                </div>
                <p className="mt-1 text-sm text-foreground-secondary">{grade.overrideReason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

{/* Submission Assets */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.reviews.detail.submissionAssets.title}</CardTitle>
            </div>
            <Badge variant="default" size="sm">
              {t.teacher.reviews.detail.submissionAssets.fileCount(assets.length)}
            </Badge>
          </div>
          <CardDescription>
            {t.teacher.reviews.detail.submissionAssets.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="rounded-card border border-border bg-surface-muted p-4 text-center">
              <p className="text-foreground-secondary">{t.teacher.reviews.detail.submissionAssets.noAssets}</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between rounded-card border border-border bg-surface p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-foreground-secondary" />
                    <div>
                      <p className="font-medium text-foreground">{asset.fileName}</p>
                      <p className="text-xs text-foreground-secondary">
                        {asset.assetKind} • {asset.extension.toUpperCase()}
                        {asset.pageNumber ? ` • ${t.teacher.reviews.detail.submissionAssets.page(asset.pageNumber)}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" size="sm">
                    {asset.variant}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

{/* Review Sections */}
      {showTestReview ? (
        <div className="space-y-4">
          {/* Section Tabs Header */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-muted p-1">
            <div className="flex-1 rounded-md bg-primary-subtle px-4 py-2 text-center">
              <span className="text-sm font-semibold text-primary">{t.teacher.reviews.submissions.practice}</span>
            </div>
            <div className="flex-1 rounded-md px-4 py-2 text-center">
              <span className="text-sm font-medium text-foreground-secondary">{t.teacher.reviews.submissions.test}</span>
              {!testReviewData?.reviewCompletedAt && (
                <Badge variant="warning" size="sm" className="ml-2">{t.teacher.reviews.detail.sections.pendingReview}</Badge>
              )}
            </div>
          </div>

          {/* Practice Review Section */}
          <Card elevation="sm" className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-foreground-secondary" />
                <CardTitle>{t.teacher.reviews.detail.sections.practiceReview}</CardTitle>
              </div>
              <CardDescription>
                {t.teacher.reviews.detail.sections.practiceReviewDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-t border-border">
                <ReviewWorkspace
                  submission={submission}
                  assets={assets}
                  initialReview={review}
                  initialAnnotations={annotations}
                  teacherId={teacherId}
                  initialGrade={grade}
                />
              </div>
            </CardContent>
          </Card>

          {/* Test Review Section */}
          <Card elevation="sm" className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-foreground-secondary" />
                  <CardTitle>{t.teacher.reviews.detail.sections.testReview}</CardTitle>
                </div>
                {testReviewData?.reviewCompletedAt ? (
                  <Badge variant="success" size="sm">{t.teacher.reviews.detail.sections.reviewCompleted}</Badge>
                ) : (
                  <Badge variant="warning" size="sm">{t.teacher.reviews.detail.sections.pendingReview}</Badge>
                )}
              </div>
              <CardDescription>
                {t.teacher.reviews.detail.sections.testReviewDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-t border-border p-6">
                {testReviewData && reviewData.testAttemptId ? (
                  <TestQuestionReview
                    attemptId={reviewData.testAttemptId}
                    initialData={testReviewData}
                  />
                ) : (
                  <div className="rounded-card border border-border bg-surface-muted p-4 text-center">
                    <p className="text-foreground-secondary">{t.teacher.reviews.detail.sections.testReviewLoadFailed}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Practice Review Only (no linked test) */
        <Card elevation="sm" className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-foreground-secondary" />
              <CardTitle>{t.teacher.reviews.detail.sections.reviewWorkspace}</CardTitle>
            </div>
            <CardDescription>
              {t.teacher.reviews.detail.sections.reviewWorkspaceDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t border-border">
              <ReviewWorkspace
                submission={submission}
                assets={assets}
                initialReview={review}
                initialAnnotations={annotations}
                teacherId={teacherId}
                initialGrade={grade}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
