"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SubmissionRecord, SubmissionAssetRecord } from "@/modules/submissions";
import type { ReviewRecord } from "@/modules/reviews";
import type { AnnotationRecord } from "@/modules/annotations";
import type { GradeRecord } from "@/modules/grades";
import { AnnotationOverlay } from "./AnnotationOverlay";
import { overrideGradeAction } from "@/modules/grades/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/translations";

// ─── Asset Preview Component ─────────────────────────────────────────

interface AssetPreviewProps {
  asset: SubmissionAssetRecord;
  reviewId: string;
  submissionId: string;
  selectedPage: number | null;
  isReadOnly: boolean;
  annotations: AnnotationRecord[];
}

function AssetPreview({ asset, reviewId, submissionId, selectedPage, isReadOnly, annotations }: AssetPreviewProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const isImage = asset.mimeType?.startsWith("image/");
  const isPdf = asset.mimeType === "application/pdf";

  useEffect(() => {
    if (!asset.storagePath) {
      setLoadError(true);
      return;
    }

    const url = `/api/v1/uploads/signed-url?path=${encodeURIComponent(asset.storagePath)}`;
    setSignedUrl(url);
    setLoadError(false);
  }, [asset.storagePath]);

  if (!signedUrl || loadError) {
    return (
      <div className="bg-surface-raised shadow-elevation-2 relative rounded-card" style={{ width: "800px", maxWidth: "100%" }}>
        <div className="w-full aspect-[8.5/11] bg-surface-muted border border-border flex items-center justify-center text-foreground-muted relative rounded-card">
          <div className="text-center">
            <p className="text-foreground-secondary">{asset.fileName}</p>
            <p className="text-caption text-foreground-muted mt-1">{t.components.reviewWorkspace.previewNotAvailable}</p>
          </div>
          {reviewId && (
            <AnnotationOverlay
              reviewId={reviewId}
              submissionId={submissionId}
              assetId={asset.id}
              pageNumber={selectedPage}
              width={800}
              height={1035}
              readOnly={isReadOnly}
              initialAnnotations={annotations.filter(a => a.assetId === asset.id && a.pageNumber === selectedPage)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-raised shadow-elevation-2 relative rounded-card overflow-hidden" style={{ width: "800px", maxWidth: "100%" }}>
      {isImage ? (
        <div className="w-full relative" style={{ minHeight: "500px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signedUrl}
            alt={asset.fileName}
            className="w-full h-auto"
            onError={() => setLoadError(true)}
          />
          {reviewId && (
            <div className="absolute inset-0 pointer-events-none">
              <AnnotationOverlay
                reviewId={reviewId}
                submissionId={submissionId}
                assetId={asset.id}
                pageNumber={selectedPage}
                width={800}
                height={Math.round(800 * 1.294)} // A4 ratio
                readOnly={isReadOnly}
                initialAnnotations={annotations.filter(a => a.assetId === asset.id && a.pageNumber === selectedPage)}
              />
            </div>
          )}
        </div>
      ) : isPdf ? (
        <div className="w-full relative" style={{ minHeight: "800px" }}>
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(
              typeof window !== "undefined"
                ? `${window.location.origin}/api/v1/uploads/signed-url?path=${encodeURIComponent(asset.storagePath)}`
                : ""
            )}&embedded=true`}
            className="w-full"
            style={{ height: "800px", border: "none" }}
            title={asset.fileName}
            onError={() => setLoadError(true)}
          />
          {reviewId && (
            <div className="absolute inset-0 pointer-events-none">
              <AnnotationOverlay
                reviewId={reviewId}
                submissionId={submissionId}
                assetId={asset.id}
                pageNumber={selectedPage}
                width={800}
                height={1035}
                readOnly={isReadOnly}
                initialAnnotations={annotations.filter(a => a.assetId === asset.id && a.pageNumber === selectedPage)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full aspect-[8.5/11] bg-surface-muted border border-border flex items-center justify-center relative rounded-card">
          <div className="text-center">
            <p className="text-foreground font-medium">{asset.fileName}</p>
            <p className="text-caption text-foreground-muted mt-1">{t.components.reviewWorkspace.unsupportedPreviewFormat}</p>
            <a
              href={signedUrl}
              download={asset.fileName}
              className="text-primary text-body-sm mt-2 inline-block hover:underline"
            >
              {t.components.reviewWorkspace.downloadFile}
            </a>
          </div>
          {reviewId && (
            <div className="absolute inset-0">
              <AnnotationOverlay
                reviewId={reviewId}
                submissionId={submissionId}
                assetId={asset.id}
                pageNumber={selectedPage}
                width={800}
                height={1035}
                readOnly={isReadOnly}
                initialAnnotations={annotations.filter(a => a.assetId === asset.id && a.pageNumber === selectedPage)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Review Workspace ──────────────────────────────────────────────────

interface ReviewWorkspaceProps {
  submission: SubmissionRecord;
  assets: SubmissionAssetRecord[];
  initialReview: ReviewRecord | null;
  initialAnnotations: AnnotationRecord[];
  teacherId: string;
  isStudent?: boolean;
  initialGrade?: GradeRecord | null;
}

export function ReviewWorkspace({ 
  submission, 
  assets, 
  initialReview, 
  initialAnnotations,
  teacherId, 
  isStudent = false,
  initialGrade = null,
}: ReviewWorkspaceProps) {
  const router = useRouter();
  const [review, setReview] = useState<ReviewRecord | null>(initialReview);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(assets.length > 0 ? assets[0].id : null);
  const [selectedPage, setSelectedPage] = useState<number | null>(assets.length > 0 ? assets[0].pageNumber : null);
  const [comment, setComment] = useState(initialReview?.comment || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [grade, setGrade] = useState<GradeRecord | null>(initialGrade);
  const [overrideScore, setOverrideScore] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  async function parseEnvelope(response: Response) {
    const envelope = await response.json();
    if (!response.ok || !envelope.success) {
      throw new Error(envelope.error?.message || t.components.reviewWorkspace.requestFailed);
    }
    return envelope.data as Record<string, unknown>;
  }

  const handleSaveComment = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/v1/teacher/assignment-results/${submission.resultId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });

      const data = await parseEnvelope(response);
      setReview((current) => ({
        id: (data.reviewId as string) ?? current?.id ?? "",
        submissionId: submission.id,
        resultId: submission.resultId,
        publicationId: submission.publicationId,
        studentId: submission.studentId,
        teacherId,
        comment,
        status: "draft",
        releasedAt: null,
        createdAt: (data.createdAt as string) ?? current?.createdAt ?? new Date().toISOString(),
        updatedAt: (data.updatedAt as string) ?? new Date().toISOString(),
      }));
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t.components.reviewWorkspace.failedToSaveDraft);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRelease = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/v1/teacher/assignment-results/${submission.resultId}/review/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyStudent: true, comment }),
      });

      const data = await parseEnvelope(response);
      setReview((current) => ({
        id: (data.reviewId as string) ?? current?.id ?? "",
        submissionId: submission.id,
        resultId: submission.resultId,
        publicationId: submission.publicationId,
        studentId: submission.studentId,
        teacherId,
        comment,
        status: "released",
        releasedAt: (data.releasedAt as string) ?? new Date().toISOString(),
        createdAt: current?.createdAt ?? new Date().toISOString(),
        updatedAt: (data.releasedAt as string) ?? new Date().toISOString(),
      }));
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t.components.reviewWorkspace.failedToRelease);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverrideGrade = async () => {
    const score = parseFloat(overrideScore);
    if (isNaN(score) || score < 0 || score > 100) return;
    if (!overrideReason.trim()) return;

    setIsOverriding(true);
    try {
      const updated = await overrideGradeAction(
        submission.resultId,
        teacherId,
        score,
        overrideReason.trim()
      );
      setGrade(updated);
      setOverrideScore("");
      setOverrideReason("");
    } finally {
      setIsOverriding(false);
    }
  };

  return (
    <div className="flex h-screen bg-surface">
      {/* Sidebar */}
      <div className="w-64 bg-surface-raised border-r border-border flex flex-col">
        <div className="p-comfortable border-b border-border">
          <h2 className="font-bold text-h4 text-foreground">{t.components.reviewWorkspace.workspace}</h2>
          <p className="text-body-sm text-foreground-secondary">{t.components.reviewWorkspace.status.replace("{status}", review?.status ?? "pending")}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-comfortable">
          <h3 className="font-semibold text-foreground mb-2">{t.components.reviewWorkspace.assets}</h3>
          <ul className="flex flex-col gap-2">
            {assets.map((asset) => (
              <li key={asset.id}>
                <Button
                  variant={selectedAssetId === asset.id ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  aria-label={t.components.reviewWorkspace.selectAsset.replace("{file}", asset.fileName).replace("{page}", asset.pageNumber ? t.components.reviewWorkspace.pageSuffix.replace("{page}", String(asset.pageNumber)) : "")}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setSelectedPage(asset.pageNumber);
                  }}
                >
                  {asset.fileName} {asset.pageNumber ? `(${t.components.reviewWorkspace.pageSuffix.replace("{page}", String(asset.pageNumber))})` : ""}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-comfortable border-t border-border">
          <h3 className="font-semibold text-foreground mb-2">{t.components.reviewWorkspace.reviewComment}</h3>
          {isStudent ? (
            <div className="p-default bg-surface-muted rounded-control-md border border-border text-body-sm whitespace-pre-wrap text-foreground">
              {comment || t.components.reviewWorkspace.noWrittenFeedback}
            </div>
          ) : (
            <>
              <Textarea
                className="mb-2"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t.components.reviewWorkspace.feedbackPlaceholder}
                disabled={review?.status === "released" || isSaving}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  loading={isSaving}
                  disabled={review?.status === "released" || isSaving}
                  aria-label={t.components.reviewWorkspace.saveDraftAria}
                  onClick={handleSaveComment}
                >
                  {t.components.reviewWorkspace.saveDraft}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  loading={isSaving}
                  disabled={review?.status === "released" || isSaving}
                  aria-label={review?.status === "released" ? t.components.reviewWorkspace.reviewAlreadyReleasedAria : t.components.reviewWorkspace.releaseToStudentAria}
                  onClick={handleRelease}
                >
                  {review?.status === "released" ? t.components.reviewWorkspace.released : t.components.reviewWorkspace.release}
                </Button>
              </div>
              {saveError && (
                <div className="mt-2 rounded-control-md border border-error bg-error-subtle/30 p-default text-body-sm text-error">
                  {saveError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Grade Section */}
        <div className="p-comfortable border-t border-border">
          <h3 className="font-semibold text-foreground mb-2">{t.components.reviewWorkspace.grade}</h3>
          {grade ? (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-body-sm">
                <span className="text-foreground-secondary">{t.components.reviewWorkspace.finalScore}</span>
                <span className="font-semibold text-foreground">{grade.finalScoreRaw}</span>
              </div>
              <div className="flex justify-between text-body-sm">
                <span className="text-foreground-secondary">{t.components.reviewWorkspace.letterGrade}</span>
                <span className="inline-block rounded-full bg-primary-subtle px-compact py-tight text-caption font-bold text-primary">
                  {grade.mappedGrade}
                </span>
              </div>
              {grade.practiceScoreRaw !== null && (
                <div className="flex justify-between text-body-sm">
                  <span className="text-foreground-secondary">{t.components.reviewWorkspace.practice}</span>
                  <span className="text-foreground">{grade.practiceScoreRaw}</span>
                </div>
              )}
              {grade.testScoreRaw !== null && (
                <div className="flex justify-between text-body-sm">
                  <span className="text-foreground-secondary">{t.components.reviewWorkspace.test}</span>
                  <span className="text-foreground">{grade.testScoreRaw}</span>
                </div>
              )}
              {grade.overrideReason && (
                <div className="text-caption text-warning bg-warning-subtle rounded-control-md p-default">
                  {t.components.reviewWorkspace.override.replace("{reason}", grade.overrideReason)}
                </div>
              )}
            </div>
          ) : (
            <p className="text-body-sm text-foreground-muted">{t.components.reviewWorkspace.noGradeRecorded}</p>
          )}

          {!isStudent && grade && (
            <div className="mt-3 flex flex-col gap-2">
              <h4 className="text-caption font-semibold uppercase tracking-wider text-foreground-secondary">{t.components.reviewWorkspace.overrideGrade}</h4>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                size="sm"
                placeholder={t.components.reviewWorkspace.newScorePlaceholder}
                value={overrideScore}
                onChange={(e) => setOverrideScore(e.target.value)}
                disabled={isOverriding}
              />
              <Input
                type="text"
                size="sm"
                placeholder={t.components.reviewWorkspace.overrideReasonPlaceholder}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                disabled={isOverriding}
              />
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                loading={isOverriding}
                disabled={isOverriding || !overrideScore || !overrideReason.trim()}
                aria-label={t.components.reviewWorkspace.overrideGradeAria}
                onClick={handleOverrideGrade}
              >
                {t.components.reviewWorkspace.overrideGradeButton}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-comfortable flex justify-center items-start bg-surface">
        {selectedAsset ? (
          <AssetPreview
            asset={selectedAsset}
            reviewId={review?.id ?? ""}
            submissionId={submission.id}
            selectedPage={selectedPage}
            isReadOnly={isStudent || review?.status === "released"}
            annotations={initialAnnotations}
          />
        ) : (
          <div className="text-foreground-secondary">{t.components.reviewWorkspace.selectAssetToReview}</div>
        )}
      </div>
    </div>
  );
}
