"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Plus, X, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

import { t } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";

const ACCEPTED_FILE_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,.txt,image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";

const MAX_FILE_SIZE = 1_000_000_000; // 1 GB — matches Supabase bucket limit

type UploadStage =
  | "idle"
  | "initializing"
  | "uploading"
  | "completing"
  | "creating"
  | "success"
  | "error";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: "",
  initializing: t.teacher.tests.upload.status,
  uploading: t.teacher.tests.upload.uploading,
  completing: t.teacher.tests.upload.processing,
  creating: t.teacher.materials.alerts.created,
  success: t.teacher.tests.upload.complete,
  error: t.teacher.tests.upload.failed,
};

/**
 * Upload a file to a signed URL with XMLHttpRequest for progress tracking.
 */
function uploadWithProgress(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: Blob,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted"));
    });

    xhr.send(body);
  });
}

export function MaterialUploadForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isWorking = stage !== "idle" && stage !== "success" && stage !== "error";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!title.trim() || title.trim().length < 3) {
        setErrorMessage(t.teacher.materials.create.titleMinLength);
        setStage("error");
        return;
      }

      if (!selectedFile || selectedFile.size === 0) {
        setErrorMessage(t.teacher.materials.create.selectFile);
        setStage("error");
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        setErrorMessage(`File is too large (${formatFileSize(selectedFile.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
        setStage("error");
        return;
      }

      const mimeType = selectedFile.type || "application/octet-stream";

      try {
        // Step 1: Initialize upload session
        setStage("initializing");
        setUploadPercent(0);

        const initRes = await fetch("/api/v1/uploads/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadType: "material",
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType,
          }),
        });

        if (!initRes.ok) {
          const err = await initRes.json().catch(() => null);
          throw new Error(err?.error?.message ?? "Failed to initialize upload.");
        }

        const uploadInit = await initRes.json();
        const { uploadId, targetUrl, upload } = uploadInit.data ?? uploadInit;

        // Step 2: Upload file directly to Supabase Storage with progress
        setStage("uploading");

        await uploadWithProgress(
          targetUrl,
          upload.method ?? "PUT",
          {
            "Content-Type": mimeType,
            ...(upload.upsert ? { "x-upsert": "true" } : {}),
          },
          selectedFile,
          (percent) => setUploadPercent(percent),
        );

        // Step 3: Complete upload session
        setStage("completing");

        const completeRes = await fetch(`/api/v1/uploads/${uploadId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType,
          }),
        });

        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => null);
          throw new Error(err?.error?.message ?? "Failed to verify upload.");
        }

        // Step 4: Create material
        setStage("creating");

        const materialRes = await fetch("/api/v1/teacher/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            scopeType: "personal",
            uploadId,
          }),
        });

        if (!materialRes.ok) {
          const err = await materialRes.json().catch(() => null);
          throw new Error(err?.error?.message ?? "Failed to create material.");
        }

        setStage("success");

        // Reload page after short delay to show success state
        setTimeout(() => {
          window.location.href = "/teacher/materials?created=1";
        }, 800);
      } catch (error) {
        console.error("[MaterialUploadForm] Upload error:", error);
        setErrorMessage(error instanceof Error ? error.message : t.teacher.materials.create.uploadFailed);
        setStage("error");
      }
    },
    [title, description, selectedFile],
  );

  const handleReset = () => {
    setStage("idle");
    setUploadPercent(0);
    setErrorMessage(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label={t.teacher.materials.create.title} required hint={t.teacher.materials.list.emptyDescription}>
        <Input
          name="title"
          required
          minLength={3}
          placeholder={t.teacher.materials.create.description}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isWorking}
        />
      </FormField>
      <FormField
        label={t.teacher.tests.detail.descriptionLabel}
        hint={t.teacher.materials.detail.noDescription}
      >
        <Textarea
          name="description"
          rows={4}
          placeholder={t.teacher.materials.create.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isWorking}
        />
      </FormField>
      <FormField
        label={t.teacher.materials.detail.file}
        required
        hint={t.teacher.materials.detail.noFileAttached}
      >
        <div className="space-y-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            name="sourceFile"
            className="hidden"
            id="material-file-input"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
            disabled={isWorking}
          />

          {/* Custom button to trigger file selection */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              leftIcon={<Upload className="h-4 w-4" />}
              onClick={handleChooseFile}
              disabled={isWorking}
            >
              {t.teacher.materials.create.chooseFile}
            </Button>

            {/* Show selected filename and size */}
            {selectedFile && (
              <div className="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-1.5">
                <FileText className="h-4 w-4 text-foreground-secondary" />
                <span className="text-sm text-foreground">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-foreground-secondary">
                  ({formatFileSize(selectedFile.size)})
                </span>
                {!isWorking && (
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="ml-1 text-foreground-secondary hover:text-foreground transition-colors"
                    aria-label={t.teacher.materials.detail.noFileAttached}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Validation indicator - file is required */}
          {!selectedFile && (
            <p className="text-xs text-foreground-secondary">
              {t.teacher.materials.detail.noFileAttached}
            </p>
          )}
        </div>
      </FormField>

      {/* Upload Progress */}
      {stage !== "idle" && (
        <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-muted/30 p-4">
          {/* Stage indicator */}
          <div className="flex items-center gap-2 text-sm">
            {stage === "success" && <CheckCircle2 className="h-4 w-4 text-success" />}
            {stage === "error" && <AlertCircle className="h-4 w-4 text-error" />}
            {isWorking && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            <span className={stage === "error" ? "text-error font-medium" : stage === "success" ? "text-success font-medium" : "text-foreground-secondary"}>
              {STAGE_LABELS[stage]}
            </span>
            {stage === "uploading" && (
              <span className="ml-1 font-mono text-foreground">{uploadPercent}%</span>
            )}
          </div>

          {/* Progress bar — shown for all active stages and success */}
          {(stage === "uploading" || stage === "completing" || stage === "creating" || stage === "success") && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  stage === "success" ? "bg-success" : "bg-primary"
                }`}
                style={{
                  width: stage === "uploading"
                    ? `${uploadPercent}%`
                    : "100%",
                }}
              />
            </div>
          )}

          {/* Initializing spinner (no progress bar yet) */}
          {stage === "initializing" && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full w-1/4 animate-pulse rounded-full bg-primary" />
            </div>
          )}

          {/* Error message */}
          {stage === "error" && errorMessage && (
            <p className="text-sm text-error">{errorMessage}</p>
          )}

          {/* Retry button on error */}
          {stage === "error" && (
            <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
              {t.common.tryAgain}
            </Button>
          )}
        </div>
      )}

      {/* Submit button */}
      <div className="flex gap-3">
        <Button
          type="submit"
          variant="primary"
          className="w-fit shrink-0"
          leftIcon={
            isWorking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )
          }
          disabled={isWorking || !selectedFile || title.trim().length < 3}
        >
          {isWorking ? (stage === "uploading" ? `${t.teacher.tests.upload.uploading} ${uploadPercent}%` : STAGE_LABELS[stage]) : t.teacher.materials.create.title}
        </Button>
      </div>
    </form>
  );
}
