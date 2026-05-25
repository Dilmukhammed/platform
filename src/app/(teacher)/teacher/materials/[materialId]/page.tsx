import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Download, FileText, FolderOpen, ShieldCheck } from "lucide-react";

import { apiGet } from "@/lib/api/server-fetch";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { t } from "@/lib/translations";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";

import { DeleteMaterialButton } from "./DeleteMaterialButton";
import { EditMaterialForm } from "./EditMaterialForm";
import { PdfViewerWrapper } from "./PdfViewerWrapper";

type MaterialStatus = "draft" | "active" | "archived";
type ReviewState = "none" | "pending" | "approved" | "rejected";

interface TeacherMaterialDetail {
  materialId: string;
  title: string;
  description: string | null;
  scopeType: "personal" | "organization";
  ownerTeacherId: string | null;
  ownerOrganizationId: string | null;
  status: MaterialStatus;
  sourceFilePath: string | null;
  createdAt: string;
  updatedAt: string;
  reviewState: ReviewState;
  latestDecision: string | null;
  latestDecisionReason: string | null;
  schoolVisible: boolean;
  submittedAt: string | null;
  decidedAt: string | null;
}


function getDescriptionText(description: string | null) {
  return description?.trim() ? description : t.teacher.materials.detail.noDescription;
}

function getFileName(sourceFilePath: string | null) {
  if (!sourceFilePath) {
    return null;
  }

  const fileName = sourceFilePath.split("/").pop();
  return fileName ? decodeURIComponent(fileName) : sourceFilePath;
}

function getFileActionLabel(sourceFilePath: string | null) {
  if (!sourceFilePath) {
    return t.teacher.materials.detail.noFileAttached;
  }

  const extension = sourceFilePath.split(".").pop()?.toLowerCase();
  const viewableExtensions = new Set(["gif", "jpeg", "jpg", "pdf", "png", "svg", "txt", "webp"]);

  return extension && viewableExtensions.has(extension) ? t.teacher.materials.detail.viewFile : t.teacher.materials.detail.downloadFile;
}

function isPdf(sourceFilePath: string | null) {
  if (!sourceFilePath) return false;
  return sourceFilePath.split(".").pop()?.toLowerCase() === "pdf";
}

function getStatusChipProps(material: TeacherMaterialDetail): { status: "success" | "warning" | "error" | "info"; label: string } {
  switch (material.reviewState) {
    case "pending":
      return { status: "warning", label: t.teacher.materials.detail.statusLabels.pendingReview };
    case "approved":
      return { status: "success", label: t.teacher.materials.detail.statusLabels.approved };
    case "rejected":
      return { status: "error", label: t.teacher.materials.detail.statusLabels.rejected };
    case "none":
    default:
      break;
  }

  switch (material.status) {
    case "active":
      return { status: "success", label: t.teacher.materials.detail.statusLabels.active };
    case "archived":
      return { status: "info", label: t.teacher.materials.detail.statusLabels.archived };
    default:
      return { status: "info", label: t.teacher.materials.detail.statusLabels.draft };
  }
}

export default async function TeacherMaterialDetailPage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const { materialId } = await params;

  let material: TeacherMaterialDetail;

  try {
    material = await apiGet<TeacherMaterialDetail>(`/api/v1/teacher/materials/${materialId}`);
  } catch {
    notFound();
  }

  const statusProps = getStatusChipProps(material);
  const fileName = getFileName(material.sourceFilePath);
  const fileActionLabel = getFileActionLabel(material.sourceFilePath);

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/teacher/materials">
          <ArrowLeft className="mr-2 h-4 w-4" />
Back to materials
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-foreground-secondary">
            <FileText className="h-4 w-4" />
            {t.teacher.materials.detail.pageLabel}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-h1">{material.title}</CardTitle>
              <CardDescription className="max-w-3xl">{getDescriptionText(material.description)}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={statusProps.status} label={statusProps.label} />
<Badge variant={material.scopeType === "personal" ? "primary" : "info"}>
                {material.scopeType === "personal" ? t.teacher.materials.detail.personal : t.teacher.materials.detail.organization}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
<div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-caption uppercase tracking-wide text-foreground-secondary">{t.teacher.materials.detail.status}</p>
              <p className="mt-2 font-medium text-foreground">{statusProps.label}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-caption uppercase tracking-wide text-foreground-secondary">{t.teacher.materials.detail.updated}</p>
              <p className="mt-2 font-medium text-foreground">{formatDateTime(material.updatedAt)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-caption uppercase tracking-wide text-foreground-secondary">{t.teacher.materials.detail.scope}</p>
              <p className="mt-2 font-medium capitalize text-foreground">{material.scopeType === "personal" ? t.teacher.materials.detail.personal : t.teacher.materials.detail.organization}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="text-caption uppercase tracking-wide text-foreground-secondary">{t.teacher.materials.detail.file}</p>
              <p className="mt-2 font-medium text-foreground">{fileName ?? t.teacher.materials.detail.noFileAttached}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
<Card elevation="sm">
          <CardHeader>
            <CardTitle>{t.teacher.materials.detail.reviewAndFileAccess.title}</CardTitle>
            <CardDescription>
              {t.teacher.materials.detail.reviewAndFileAccess.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-foreground-secondary" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">{t.teacher.materials.detail.reviewAndFileAccess.reviewStatus}</p>
                {material.reviewState === "pending" && material.submittedAt ? (
                  <p className="text-sm text-foreground-secondary">
                    {t.teacher.materials.detail.reviewAndFileAccess.submittedOn(formatDateTime(material.submittedAt))}
                  </p>
                ) : material.reviewState === "approved" && material.decidedAt ? (
                  <p className="text-sm text-foreground-secondary">
                    {t.teacher.materials.detail.reviewAndFileAccess.approvedOn(formatDateTime(material.decidedAt))}
                  </p>
                ) : material.reviewState === "rejected" && material.decidedAt ? (
                  <p className="text-sm text-foreground-secondary">
                    {t.teacher.materials.detail.reviewAndFileAccess.rejectedOn(formatDateTime(material.decidedAt))}
                  </p>
                ) : (
                  <p className="text-sm text-foreground-secondary">
                    {t.teacher.materials.detail.reviewAndFileAccess.notSubmitted}
                  </p>
                )}
              </div>
            </div>

            {material.reviewState === "rejected" && material.latestDecisionReason ? (
              <div className="rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-foreground">
                <p className="font-medium text-error">{t.teacher.materials.detail.reviewAndFileAccess.rejectionReason}</p>
                <p className="mt-1 whitespace-pre-line text-foreground-secondary">
                  {material.latestDecisionReason}
                </p>
              </div>
            ) : null}

            {material.schoolVisible ? (
              <div className="rounded-lg border border-success-subtle bg-success-subtle/50 px-4 py-3 text-sm text-foreground-secondary">
                {t.teacher.materials.detail.reviewAndFileAccess.schoolVisible}
              </div>
            ) : null}

            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
              <FolderOpen className="mt-0.5 h-5 w-5 text-foreground-secondary" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="font-medium text-foreground">{t.teacher.materials.detail.reviewAndFileAccess.attachedFile}</p>
                  <p className="text-sm text-foreground-secondary">
                    {fileName ?? t.teacher.materials.detail.reviewAndFileAccess.noFileYet}
                  </p>
                </div>
                {material.sourceFilePath && !isPdf(material.sourceFilePath) ? (
                  <Button asChild variant="secondary" size="sm">
                    <a
                      href={`/api/v1/teacher/materials/${material.materialId}/download`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {fileActionLabel}
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            {/* PDF Viewer */}
            {material.sourceFilePath && isPdf(material.sourceFilePath) ? (
              <PdfViewerWrapper
                fileUrl={`/api/v1/teacher/materials/${material.materialId}/download`}
                fileName={fileName ?? undefined}
              />
            ) : null}

<div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
              <Clock3 className="mt-0.5 h-5 w-5 text-foreground-secondary" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">{t.teacher.materials.detail.reviewAndFileAccess.lastUpdated}</p>
                <p className="text-sm text-foreground-secondary">{formatDateTime(material.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <EditMaterialForm
            materialId={material.materialId}
            initialTitle={material.title}
            initialDescription={material.description}
          />

          <DeleteMaterialButton
            materialId={material.materialId}
            materialTitle={material.title}
          />
        </div>
      </div>
    </section>
  );
}
