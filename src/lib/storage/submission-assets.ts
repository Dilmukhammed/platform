import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

export type SubmissionFixtureKind = "image" | "pdf" | "dwg";
export type DerivedAssetStatus = "pending" | "processing" | "ready" | "failed";
export type CanonicalDerivedAssetKind = "compressed_preview" | "thumbnail" | "pdf_page_preview";

export type SubmissionFixtureOption = {
  fixturePath: string;
  fileName: string;
  label: string;
  assetKind: SubmissionFixtureKind;
  previewMode: "image" | "pdf_pages" | "archive_only";
};

export type DeterministicAssetDraft = {
  storagePath: string;
  fixturePath: string;
  fileName: string;
  mimeType: string;
  extension: string;
  byteSize: number;
  checksum: string;
  assetKind: SubmissionFixtureKind;
  variant: "original" | "preview" | "page_preview";
  width: number | null;
  height: number | null;
  pageNumber: number | null;
  pageCount: number | null;
  downloadOnly: boolean;
};

export type CanonicalDerivedAssetDraft = {
  kind: CanonicalDerivedAssetKind;
  storagePath: string;
  fileName: string;
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
  pageIndex: number | null;
  pageCount: number | null;
  metadataJson: Record<string, unknown>;
};

type FixtureCatalogEntry = {
  fileName: string;
  label: string;
  mimeType: string;
  extension: string;
  byteSize: number;
  assetKind: SubmissionFixtureKind;
  width: number | null;
  height: number | null;
  previewMode: "image" | "pdf_pages" | "archive_only";
  preview?: {
    extension: string;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
  };
};

const submissionFixtureCatalog: Record<string, FixtureCatalogEntry> = {
  "fixtures/submissions/sample.jpg": {
    fileName: "sample.jpg",
    label: "Sample JPG practice sheet",
    mimeType: "image/jpeg",
    extension: "jpg",
    byteSize: 4096,
    assetKind: "image",
    width: 1600,
    height: 900,
    previewMode: "image",
    preview: {
      extension: "jpg",
      mimeType: "image/jpeg",
      byteSize: 1536,
      width: 1200,
      height: 675,
    },
  },
  "fixtures/submissions/sample.pdf": {
    fileName: "sample.pdf",
    label: "Sample PDF practice packet",
    mimeType: "application/pdf",
    extension: "pdf",
    byteSize: 6144,
    assetKind: "pdf",
    width: null,
    height: null,
    previewMode: "pdf_pages",
  },
  "fixtures/submissions/sample.dwg": {
    fileName: "sample.dwg",
    label: "Sample DWG archive upload",
    mimeType: "application/acad",
    extension: "dwg",
    byteSize: 8192,
    assetKind: "dwg",
    width: null,
    height: null,
    previewMode: "archive_only",
  },
};

function createChecksum(parts: Array<string | number | null>) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

function ensureFixtureExists(fixturePath: string) {
  const absolutePath = path.resolve(process.cwd(), fixturePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Submission fixture is missing: ${fixturePath}`);
  }
}

function slugifyFileStem(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, "").trim();
  const normalized = stem
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return normalized || "submission";
}

export function inferFileExtension(input: {
  fileName?: string | null;
  mimeType?: string | null;
  fallback?: string;
}) {
  const fileNameExtension = input.fileName?.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();

  if (fileNameExtension) {
    return fileNameExtension;
  }

  switch (input.mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/tiff":
      return "tif";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return input.fallback ?? "bin";
  }
}

export function buildSubmissionDerivedAssetBasePath(input: {
  assignmentResultId: string;
  submissionFileId: string;
}) {
  return `derived/${input.assignmentResultId}/${input.submissionFileId}`;
}

export function buildUploadedImagePreviewAsset(input: {
  assignmentResultId: string;
  submissionFileId: string;
  originalFilename: string;
  mimeType: string | null;
  sourceStoragePath: string;
}) {
  const extension = inferFileExtension({
    fileName: input.originalFilename,
    mimeType: input.mimeType,
    fallback: "bin",
  });
  const stem = slugifyFileStem(input.originalFilename);
  const basePath = buildSubmissionDerivedAssetBasePath(input);

  return {
    kind: "compressed_preview",
    storagePath: `${basePath}/preview.${extension}`,
    fileName: `${stem}-preview.${extension}`,
    mimeType: input.mimeType ?? "application/octet-stream",
    extension,
    width: null,
    height: null,
    pageIndex: null,
    pageCount: null,
    metadataJson: {
      sourceStoragePath: input.sourceStoragePath,
      derivedFrom: "submission_file",
      previewStrategy: "storage_copy",
    },
  } satisfies CanonicalDerivedAssetDraft;
}

export function getSubmissionFixtureDescriptor(fixturePath: string) {
  const descriptor = submissionFixtureCatalog[fixturePath];

  if (!descriptor) {
    throw new Error("Unsupported submission fixture.");
  }

  ensureFixtureExists(fixturePath);
  return descriptor;
}

export function listSubmissionFixtureOptions(): SubmissionFixtureOption[] {
  return Object.entries(submissionFixtureCatalog)
    .map(([fixturePath, descriptor]) => ({
      fixturePath,
      fileName: descriptor.fileName,
      label: descriptor.label,
      assetKind: descriptor.assetKind,
      previewMode: descriptor.previewMode,
    }))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

export function buildOriginalSubmissionAsset(input: {
  fixturePath: string;
  publicationId: string;
  studentId: string;
  submissionId: string;
}): DeterministicAssetDraft {
  const descriptor = getSubmissionFixtureDescriptor(input.fixturePath);

  return {
    storagePath: `submissions/${input.studentId}/${input.publicationId}/${input.submissionId}/original.${descriptor.extension}`,
    fixturePath: input.fixturePath,
    fileName: descriptor.fileName,
    mimeType: descriptor.mimeType,
    extension: descriptor.extension,
    byteSize: descriptor.byteSize,
    checksum: createChecksum([input.fixturePath, input.publicationId, input.studentId, input.submissionId, "original"]),
    assetKind: descriptor.assetKind,
    variant: "original",
    width: descriptor.width,
    height: descriptor.height,
    pageNumber: null,
    pageCount: null,
    downloadOnly: descriptor.previewMode === "archive_only",
  };
}

export function buildImagePreviewAsset(input: {
  fixturePath: string;
  publicationId: string;
  studentId: string;
  submissionId: string;
}): DeterministicAssetDraft {
  const descriptor = getSubmissionFixtureDescriptor(input.fixturePath);

  if (descriptor.assetKind !== "image" || !descriptor.preview) {
    throw new Error("Image preview metadata is only available for deterministic image fixtures.");
  }

  return {
    storagePath: `submissions/${input.studentId}/${input.publicationId}/${input.submissionId}/preview.${descriptor.preview.extension}`,
    fixturePath: input.fixturePath,
    fileName: `${descriptor.fileName.replace(/\.[^.]+$/, "")}-preview.${descriptor.preview.extension}`,
    mimeType: descriptor.preview.mimeType,
    extension: descriptor.preview.extension,
    byteSize: descriptor.preview.byteSize,
    checksum: createChecksum([input.fixturePath, input.publicationId, input.studentId, input.submissionId, "preview"]),
    assetKind: descriptor.assetKind,
    variant: "preview",
    width: descriptor.preview.width,
    height: descriptor.preview.height,
    pageNumber: null,
    pageCount: null,
    downloadOnly: false,
  };
}
