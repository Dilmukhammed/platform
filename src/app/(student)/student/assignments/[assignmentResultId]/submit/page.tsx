"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/translations";
// Upload flow state machine types
type UploadFlowState =
  | "loading"
  | "empty"
  | "selected"
  | "validation-errors"
  | "upload-progress"
  | "success"
  | "unavailable"
  | "error";

interface ValidationError {
  field: string;
  message: string;
}

interface AssignmentDetail {
  assignmentResultId: string;
  assignmentTitle: string;
  assignmentDescription: string | null;
  status: string;
  hasPractice: boolean;
  deadline: string | null;
  practiceStartedAt: string | null;
  practiceSubmittedAt: string | null;
  classTitle: string;
  submissionFiles: FinalizedSubmissionFile[];
}

interface UploadInitResponse {
  uploadId: string;
  fileRole: "main" | "attachment" | "reference" | "source";
  fileKind: "image" | "pdf" | "dwg" | "other";
  storageBucket: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string | null;
  fileSizeBytes: number;
  sortOrder: number;
  targetUrl: string;
  upload: {
    provider: "supabase";
    bucket: string;
    path: string;
    signedUrl: string;
    token: string;
    method: "PUT";
    upsert: true;
  };
  allowedMimeTypes: string[];
}

interface FinalizedSubmissionFile {
  id: string;
  fileRole: "main" | "attachment" | "reference" | "source";
  fileKind: "image" | "pdf" | "dwg" | "other";
  originalFilename: string;
  mimeType: string | null;
  fileSizeBytes: number;
  sortOrder: number;
  createdAt: string;
}

function deriveFileKind(file: File): "image" | "pdf" | "dwg" | "other" {
  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return "pdf";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (
    mimeType.includes("dwg") ||
    mimeType.includes("acad") ||
    mimeType.includes("autocad") ||
    fileName.endsWith(".dwg") ||
    fileName.endsWith(".dxf")
  ) {
    return "dwg";
  }

  return "other";
}

// File size formatter
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// File icon based on type
function FileIcon({ mimeType }: { mimeType: string }) {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const isCad = mimeType.includes("dwg") || mimeType.includes("acad") || mimeType.includes("autocad");

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted">
      {isImage ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-foreground-secondary"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ) : isPdf ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-error"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 13v6" />
          <path d="M15 13v6" />
          <path d="M9 16h6" />
        </svg>
      ) : isCad ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-foreground-secondary"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      )}
    </div>
  );
}

// Upload progress component
function UploadProgress({
  progress,
  fileName,
  fileSize,
  status,
}: {
  progress: number;
  fileName: string;
  fileSize: number;
  status: "uploading" | "processing" | "complete" | "error";
}) {
  const statusConfig = {
    uploading: { label: t.student.assignments.submit.upload.uploading, color: "bg-primary" },
    processing: { label: t.student.assignments.submit.upload.processing, color: "bg-warning" },
    complete: { label: t.student.assignments.submit.upload.complete, color: "bg-success" },
    error: { label: t.student.assignments.submit.upload.failed, color: "bg-error" },
  };

  const config = statusConfig[status];

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-3">
        <FileIcon mimeType="application/octet-stream" />
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium text-foreground">{fileName}</p>
          <p className="text-sm text-foreground-secondary">{formatFileSize(fileSize)}</p>
        </div>
        <StatusChip
          status={status === "error" ? "error" : status === "complete" ? "success" : "info"}
        >
          {config.label}
        </StatusChip>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${config.color}`}
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Upload progress: ${progress}%`}
        />
      </div>

      <p className="text-right text-sm text-foreground-secondary">{progress}%</p>
    </div>
  );
}

// File validation
function validateFile(
  file: File,
  allowedTypes: string[],
  maxSize: number
): ValidationError | null {
  // Check file size
  if (file.size > maxSize) {
    return {
      field: "file",
      message: `File size exceeds maximum allowed (${formatFileSize(maxSize)}). Your file is ${formatFileSize(file.size)}.`,
    };
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes("*/*")) {
    const isAllowed = allowedTypes.some((type) => {
      if (type.endsWith("/*")) {
        return file.type.startsWith(type.replace("/*", ""));
      }
      return file.type === type;
    });

    if (!isAllowed) {
      return {
        field: "file",
        message: `File type not allowed. Allowed types: ${allowedTypes.join(", ")}`,
      };
    }
  }

  return null;
}

// Main upload page component
export default function StudentUploadPage() {
  const params = useParams();
  const assignmentResultId = typeof params?.assignmentResultId === "string" ? params.assignmentResultId : "";

  const [flowState, setFlowState] = React.useState<UploadFlowState>("loading");
  const [assignment, setAssignment] = React.useState<AssignmentDetail | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [finalizedSubmissionFile, setFinalizedSubmissionFile] = React.useState<FinalizedSubmissionFile | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadStatus, setUploadStatus] = React.useState<"uploading" | "processing" | "complete" | "error">("uploading");
  const [validationErrors, setValidationErrors] = React.useState<ValidationError[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Allowed file types for submissions
  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/tiff",
    "image/webp",
    "application/dwg",
    "application/acad",
    "application/autocad",
    "application/octet-stream",
  ];
  const maxFileSize = 1073741824; // 1GB

  // Fetch assignment details on mount
  React.useEffect(() => {
    async function loadAssignment() {
      try {
        const res = await fetch(`/api/v1/student/assignments/${assignmentResultId}`);
        const envelope = await res.json();

        if (!envelope.success) {
          if (envelope.error?.code === "RESOURCE_NOT_FOUND") {
            setFlowState("unavailable");
            return;
          }
          throw new Error(envelope.error?.message || "Failed to load assignment");
        }

        const data: AssignmentDetail = envelope.data;
        setAssignment(data);

        const currentSubmissionFile = data.submissionFiles.find((file) => file.fileRole === "main")
          ?? data.submissionFiles[0]
          ?? null;
        setFinalizedSubmissionFile(currentSubmissionFile);

        // Check if practice is available
        if (!data.hasPractice) {
          setFlowState("unavailable");
          return;
        }

        // Check if already submitted
        if (data.practiceSubmittedAt) {
          // If deadline hasn't passed, allow re-submit (show file with replace option)
          const isBeforeDeadline = !data.deadline || new Date() <= new Date(data.deadline);
          if (isBeforeDeadline && currentSubmissionFile) {
            setFlowState("selected");
            return;
          }
          setFlowState("success");
          return;
        }

        // If practice hasn't started, automatically start it
        if (!data.practiceStartedAt) {
          const startRes = await fetch(
            `/api/v1/student/assignment-results/${assignmentResultId}/start-practice`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            },
          );
          const startEnvelope = await startRes.json();
          if (!startEnvelope.success) {
            console.error("[UploadPage] Failed to start practice:", startEnvelope.error?.message);
            // Continue anyway - the user can still upload
          }
        }

        if (currentSubmissionFile) {
          setFlowState("selected");
          return;
        }

        setFlowState("empty");
      } catch (err) {
        console.error("[UploadPage] Error loading assignment:", err);
        setErrorMessage(err instanceof Error ? err.message : "Failed to load assignment");
        setFlowState("error");
      }
    }

    loadAssignment();
  }, [assignmentResultId]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const error = validateFile(file, allowedMimeTypes, maxFileSize);

    if (error) {
      setValidationErrors([error]);
      setSelectedFile(file);
      setFinalizedSubmissionFile(null);
      setFlowState("validation-errors");
      return;
    }

    setValidationErrors([]);
    setSelectedFile(file);
    setFinalizedSubmissionFile(null);
    setFlowState("selected");
  };

  // Handle drag and drop
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    // Validate file
    const error = validateFile(file, allowedMimeTypes, maxFileSize);

    if (error) {
      setValidationErrors([error]);
      setSelectedFile(file);
      setFinalizedSubmissionFile(null);
      setFlowState("validation-errors");
      return;
    }

    setValidationErrors([]);
    setSelectedFile(file);
    setFinalizedSubmissionFile(null);
    setFlowState("selected");
  };

  const uploadFileToSignedUrl = React.useCallback(
    (file: File, targetUrl: string) => new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      const mimeType = file.type || "application/octet-stream";

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        const nextProgress = Math.min(99, Math.max(1, Math.round((event.loaded / event.total) * 100)));
        setUploadProgress(nextProgress);
      };

      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) {
          setUploadProgress(100);
          resolve();
          return;
        }

        reject(new Error(`Upload failed with status ${request.status}.`));
      });

      request.addEventListener("error", () => {
        reject(new Error("Upload failed while sending bytes to storage."));
      });

      request.addEventListener("abort", () => {
        reject(new Error("Upload was cancelled before completion."));
      });

      request.open("PUT", targetUrl);
      request.setRequestHeader("Content-Type", mimeType);
      request.setRequestHeader("x-upsert", "true");
      request.send(file);
    }),
    [],
  );

  const submitAssignment = React.useCallback(async () => {
    const submitRes = await fetch(`/api/v1/student/assignment-results/${assignmentResultId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionType: "practice",
      }),
    });

    const submitEnvelope = await submitRes.json();

    if (!submitEnvelope.success) {
      throw new Error(submitEnvelope.error?.message || "Failed to submit assignment");
    }
  }, [assignmentResultId]);

  // Handle upload submission
  const handleUpload = async () => {
    if (!selectedFile && !finalizedSubmissionFile) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (selectedFile) {
        setFlowState("upload-progress");
        setUploadProgress(0);
        setUploadStatus("uploading");

        const initRes = await fetch(
          `/api/v1/student/assignment-results/${assignmentResultId}/submission-files/init`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileRole: "main",
              fileKind: deriveFileKind(selectedFile),
              originalFilename: selectedFile.name,
              mimeType: selectedFile.type || undefined,
              fileSizeBytes: selectedFile.size,
              sortOrder: 0,
            }),
          },
        );

        const initEnvelope = await initRes.json();

        if (!initEnvelope.success) {
          throw new Error(initEnvelope.error?.message || "Failed to initialize upload");
        }

        const initData: UploadInitResponse = initEnvelope.data;

        await uploadFileToSignedUrl(selectedFile, initData.targetUrl);
        setUploadStatus("processing");

        const sharedCompleteRes = await fetch(`/api/v1/uploads/${initData.uploadId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath: initData.storagePath,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type || undefined,
          }),
        });

        const sharedCompleteEnvelope = await sharedCompleteRes.json();

        if (!sharedCompleteEnvelope.success) {
          throw new Error(sharedCompleteEnvelope.error?.message || "Failed to finalize upload");
        }

        const completeRes = await fetch(
          `/api/v1/student/assignment-results/${assignmentResultId}/submission-files/complete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uploadId: initData.uploadId,
              fileRole: initData.fileRole,
              fileKind: initData.fileKind,
              originalFilename: initData.originalFilename,
              mimeType: initData.mimeType ?? undefined,
              fileSizeBytes: initData.fileSizeBytes,
              sortOrder: initData.sortOrder,
            }),
          },
        );

        const completeEnvelope = await completeRes.json();

        if (!completeEnvelope.success) {
          throw new Error(completeEnvelope.error?.message || "Failed to attach upload to assignment");
        }

        const persistedSubmission = completeEnvelope.data as FinalizedSubmissionFile;
        setFinalizedSubmissionFile(persistedSubmission);
        setAssignment((current) => current
          ? {
              ...current,
              submissionFiles: [persistedSubmission],
            }
          : current);
      }

      await submitAssignment();
      setUploadStatus("complete");
      setFlowState("success");
    } catch (err) {
      console.error("[UploadPage] Upload error:", err);
      setUploadStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      setFlowState("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle retry
  const handleRetry = () => {
    setSelectedFile(null);
    setValidationErrors([]);
    setUploadProgress(0);
    setUploadStatus("uploading");
    setErrorMessage(null);
    const persistedSubmissionFile = assignment?.submissionFiles.find((file) => file.fileRole === "main")
      ?? assignment?.submissionFiles[0]
      ?? null;
    setFinalizedSubmissionFile(persistedSubmissionFile);
    setFlowState(persistedSubmissionFile ? "selected" : "empty");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSelectDifferentFile = () => {
    setSelectedFile(null);
    setValidationErrors([]);
    setUploadProgress(0);
    setUploadStatus("uploading");
    setErrorMessage(null);
    setFlowState("empty");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const activeSubmission = selectedFile
    ? {
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        mimeType: selectedFile.type || t.common.error,
        isPersisted: false,
      }
    : finalizedSubmissionFile
      ? {
          fileName: finalizedSubmissionFile.originalFilename,
          fileSizeBytes: finalizedSubmissionFile.fileSizeBytes,
          mimeType: finalizedSubmissionFile.mimeType || "Unknown type",
          isPersisted: true,
        }
      : null;

  // Render based on flow state
  if (flowState === "loading") {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-foreground-secondary">{t.student.assignments.submit.loading}</p>
      </div>
    );
  }

  if (flowState === "unavailable") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          title={t.student.assignments.submit.unavailable.title}
          description={t.student.assignments.submit.unavailable.description}
          action={
            <Button asChild>
              <Link href={`/student/assignments/${assignmentResultId}`}>
                {t.student.assignments.detail.back}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (flowState === "error") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader>
            <StatusChip status="error">{t.student.assignments.submit.error.status}</StatusChip>
            <CardTitle>{t.student.assignments.submit.error.title}</CardTitle>
            <CardDescription>
              {errorMessage || t.student.assignments.submit.error.title}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex gap-3">
            <Button onClick={handleRetry} variant="secondary">
              {t.common.tryAgain}
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/student/assignments/${assignmentResultId}`}>
                {t.student.assignments.detail.back}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (flowState === "empty") {
    return (
      <div className="mx-auto max-w-3xl py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-secondary">
          <Link href="/student/assignments" className="hover:text-foreground">
            {t.student.assignments.title}
          </Link>
          <span>/</span>
          <Link href={`/student/assignments/${assignmentResultId}`} className="hover:text-foreground">
            {assignment?.assignmentTitle || t.student.assignments.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">{t.student.assignments.submit.breadcrumbs.submit}</span>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="primary">{t.student.assignments.submit.practicalWork}</Badge>
              {assignment?.deadline && (
                <span className="text-sm text-foreground-secondary">
                  {t.student.assignments.deadline.dueDate(new Date(assignment.deadline).toLocaleDateString())}
                </span>
              )}
            </div>
            <CardTitle className="text-2xl">{t.student.assignments.submit.title}</CardTitle>
            <CardDescription>
              {assignment?.assignmentDescription || t.student.assignments.submit.beforeSubmit.item2}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* File drop zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-lg border-2 border-dashed border-border bg-surface-raised p-12 text-center transition-colors hover:border-border-hover hover:bg-surface"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
              aria-label={t.student.assignments.submit.validation.fileInputLabel}
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-foreground-secondary"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-lg font-medium text-foreground">
                {t.student.assignments.submit.empty.dropzone.clickOrDrag}
              </p>
              <p className="mt-2 text-sm text-foreground-secondary">
                {t.student.assignments.submit.empty.dropzone.supportedFormats}
              </p>
              <p className="mt-1 text-sm text-foreground-muted">
                {t.student.assignments.submit.validation.maxSize}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept={allowedMimeTypes.join(",")}
                aria-label={t.student.assignments.submit.validation.fileInputLabel}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button asChild variant="secondary">
              <Link href={`/student/assignments/${assignmentResultId}`}>{t.student.assignments.submit.actions.cancel}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (flowState === "selected" && activeSubmission) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-secondary">
          <Link href="/student/assignments" className="hover:text-foreground">
            {t.student.assignments.title}
          </Link>
          <span>/</span>
          <Link href={`/student/assignments/${assignmentResultId}`} className="hover:text-foreground">
            {assignment?.assignmentTitle || t.student.assignments.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">{t.student.assignments.submit.breadcrumbs.submit}</span>
        </div>

        <Card>
          <CardHeader>
            <Badge variant={assignment?.practiceSubmittedAt ? "warning" : "primary"}>
              {assignment?.practiceSubmittedAt ? t.student.assignments.submit.selected.previouslySubmitted : t.student.assignments.submit.selected.readyToUpload}
            </Badge>
            <CardTitle>
              {assignment?.practiceSubmittedAt ? t.student.assignments.submit.selected.updateSubmission : t.student.assignments.submit.selected.confirmSubmission}
            </CardTitle>
            <CardDescription>
              {assignment?.practiceSubmittedAt
                ? t.student.assignments.submit.selected.replaceDescription
                : t.student.assignments.submit.selected.reviewDescription
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File info card */}
            <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-raised p-4">
              <FileIcon mimeType={activeSubmission.mimeType} />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-foreground">{activeSubmission.fileName}</p>
                <p className="text-sm text-foreground-secondary">
                  {formatFileSize(activeSubmission.fileSizeBytes)} • {activeSubmission.mimeType}
                </p>
                {activeSubmission.isPersisted ? (
                  <p className="mt-1 text-sm text-success">
                    {assignment?.practiceSubmittedAt
                      ? t.student.assignments.submit.selected.alreadyUploadedReSubmit
                      : t.student.assignments.submit.selected.alreadyUploadedReady
                    }
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectDifferentFile}
                className="shrink-0"
              >
                {t.student.assignments.submit.selected.replace}
              </Button>
            </div>

            {/* Deadline warning for re-submit */}
            {assignment?.practiceSubmittedAt && assignment?.deadline && (
              <div className="rounded-lg border border-warning bg-warning-subtle p-4">
                <p className="text-sm font-medium text-warning">
                  {t.student.assignments.deadline.dueDate(new Date(assignment.deadline).toLocaleString())}
                </p>
                <p className="text-sm text-foreground-secondary mt-1">
                  {t.student.assignments.submit.selected.resubmitManyTimes}
                </p>
              </div>
            )}

            {/* Submission notes */}
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <h3 className="mb-2 font-medium text-foreground">{t.student.assignments.submit.beforeSubmit.title}</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-foreground-secondary">
                <li>{t.student.assignments.submit.beforeSubmit.item1}</li>
                <li>{t.student.assignments.submit.beforeSubmit.item2}</li>
                {assignment?.practiceSubmittedAt ? (
                  <li>{t.student.assignments.submit.beforeSubmit.item3}</li>
                ) : (
                  <li>{t.student.assignments.submit.beforeSubmit.item4}</li>
                )}
                <li>{t.student.assignments.submit.beforeSubmit.item5}</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button asChild variant="secondary">
              <Link href={`/student/assignments/${assignmentResultId}`}>
                {t.student.assignments.submit.actions.cancel}
              </Link>
            </Button>
            <Button onClick={handleUpload} loading={isSubmitting} size="lg">
              {assignment?.practiceSubmittedAt
                ? t.student.assignments.submit.selected.resubmitWork
                : activeSubmission.isPersisted ? t.student.assignments.submit.selected.submitWork : t.student.assignments.submit.selected.uploadAndSubmit
              }
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (flowState === "validation-errors" && selectedFile) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-secondary">
          <Link href="/student/assignments" className="hover:text-foreground">
            {t.student.assignments.title}
          </Link>
          <span>/</span>
          <Link href={`/student/assignments/${assignmentResultId}`} className="hover:text-foreground">
            {assignment?.assignmentTitle || t.student.assignments.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">{t.student.assignments.submit.breadcrumbs.submit}</span>
        </div>

        <Card>
          <CardHeader>
            <StatusChip status="error">{t.student.assignments.submit.validation.status}</StatusChip>
            <CardTitle>{t.student.assignments.submit.validation.title}</CardTitle>
            <CardDescription>
              {t.student.assignments.submit.validation.requirementsTitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File info with error */}
            <div className="flex items-center gap-4 rounded-lg border border-error bg-error-subtle p-4">
              <FileIcon mimeType={selectedFile.type} />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-foreground-secondary">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type || "Unknown type"}
                </p>
              </div>
            </div>

            {/* Validation errors */}
            <div className="space-y-2">
              {validationErrors.map((error, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-lg border border-error bg-error-subtle p-3 text-error"
                  role="alert"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error.message}</span>
                </div>
              ))}
            </div>

            {/* Requirements reminder */}
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <h3 className="mb-2 font-medium text-foreground">{t.student.assignments.submit.validation.requirementsTitle}</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-foreground-secondary">
                <li>{t.student.assignments.submit.validation.maxSize}</li>
                <li>{t.student.assignments.submit.validation.supportedFormats}</li>
                <li>{t.student.assignments.submit.validation.notProtected}</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button asChild variant="secondary">
              <Link href={`/student/assignments/${assignmentResultId}`}>{t.student.assignments.submit.actions.cancel}</Link>
            </Button>
            <Button onClick={handleRetry} variant="primary">
              {t.student.assignments.submit.validation.selectDifferentFile}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (flowState === "upload-progress" && selectedFile) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-secondary">
          <Link href="/student/assignments" className="hover:text-foreground">
            {t.student.assignments.title}
          </Link>
          <span>/</span>
          <Link href={`/student/assignments/${assignmentResultId}`} className="hover:text-foreground">
            {assignment?.assignmentTitle || t.student.assignments.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">{t.student.assignments.submit.breadcrumbs.submit}</span>
        </div>

        <Card>
          <CardHeader>
            <Badge variant="primary">{t.student.assignments.submit.upload.status}</Badge>
            <CardTitle>{t.student.assignments.submit.upload.title}</CardTitle>
            <CardDescription>
              {t.student.assignments.submit.upload.progressLabel(0)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadProgress
              progress={uploadProgress}
              fileName={selectedFile.name}
              fileSize={selectedFile.size}
              status={uploadStatus}
            />
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-foreground-secondary">
              {uploadStatus === "uploading" && t.student.assignments.submit.upload.uploading}
              {uploadStatus === "processing" && t.student.assignments.submit.upload.processing}
              {uploadStatus === "complete" && t.student.assignments.submit.upload.complete}
              {uploadStatus === "error" && t.student.assignments.submit.upload.failed}
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (flowState === "success") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-success"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <CardTitle className="text-2xl">{t.student.assignments.submit.success.title}</CardTitle>
            <CardDescription>
              {t.student.assignments.submit.success.submitted}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <StatusChip status="success">{t.student.assignments.submit.success.title}</StatusChip>
            <p className="mt-4 text-sm text-foreground-secondary">
              {t.student.assignments.submit.success.description}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild size="lg">
              <Link href={`/student/assignments/${assignmentResultId}`}>
                {t.student.assignments.detail.back}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Fallback
  return null;
}
