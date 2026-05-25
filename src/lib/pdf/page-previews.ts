import { createHash } from "node:crypto";

import {
  buildSubmissionDerivedAssetBasePath,
  getSubmissionFixtureDescriptor,
  type CanonicalDerivedAssetDraft,
  type DeterministicAssetDraft,
} from "@/lib/storage/submission-assets";

const deterministicPdfPageCatalog: Record<string, { pageCount: number; width: number; height: number }> = {
  "fixtures/submissions/sample.pdf": {
    pageCount: 3,
    width: 1200,
    height: 1697,
  },
};

function createChecksum(parts: Array<string | number>) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

export function buildPdfPagePreviewAssets(input: {
  fixturePath: string;
  publicationId: string;
  studentId: string;
  submissionId: string;
}) {
  const descriptor = getSubmissionFixtureDescriptor(input.fixturePath);
  const previewDescriptor = deterministicPdfPageCatalog[input.fixturePath];

  if (descriptor.assetKind !== "pdf" || !previewDescriptor) {
    throw new Error("PDF preview metadata is only available for deterministic PDF fixtures.");
  }

  const previews: DeterministicAssetDraft[] = Array.from({ length: previewDescriptor.pageCount }, (_, index) => {
    const pageNumber = index + 1;

    return {
      storagePath: `submissions/${input.studentId}/${input.publicationId}/${input.submissionId}/pages/page-${String(pageNumber).padStart(2, "0")}.jpg`,
      fixturePath: input.fixturePath,
      fileName: `${descriptor.fileName.replace(/\.[^.]+$/, "")}-page-${pageNumber}.jpg`,
      mimeType: "image/jpeg",
      extension: "jpg",
      byteSize: 1024 + pageNumber * 64,
      checksum: createChecksum([input.fixturePath, input.publicationId, input.studentId, input.submissionId, pageNumber]),
      assetKind: "pdf",
      variant: "page_preview",
      width: previewDescriptor.width,
      height: previewDescriptor.height,
      pageNumber,
      pageCount: previewDescriptor.pageCount,
      downloadOnly: false,
    } satisfies DeterministicAssetDraft;
  });

  return {
    pageCount: previewDescriptor.pageCount,
    previews,
  };
}

function countPdfPages(pdfText: string) {
  const matches = pdfText.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}

function extractFirstMediaBox(pdfText: string) {
  const match = pdfText.match(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/);

  if (!match) {
    return null;
  }

  const [, left, bottom, right, top] = match;
  const width = Math.abs(Number(right) - Number(left));
  const height = Math.abs(Number(top) - Number(bottom));

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width: Math.round(width * (96 / 72)),
    height: Math.round(height * (96 / 72)),
  };
}

export function inspectUploadedPdf(buffer: Buffer) {
  const pdfText = buffer.toString("latin1");
  const pageCount = countPdfPages(pdfText);

  if (pageCount < 1) {
    throw new Error("Unable to determine PDF page count for derived previews.");
  }

  const mediaBox = extractFirstMediaBox(pdfText);

  return {
    pageCount,
    width: mediaBox?.width ?? 816,
    height: mediaBox?.height ?? 1056,
  };
}

export function buildUploadedPdfPagePreviewAssets(input: {
  assignmentResultId: string;
  submissionFileId: string;
  originalFilename: string;
  sourceStoragePath: string;
  pageCount: number;
  width: number;
  height: number;
}) {
  const stem = input.originalFilename.replace(/\.[^.]+$/, "");
  const safeStem = stem.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "submission";
  const basePath = buildSubmissionDerivedAssetBasePath(input);

  const previews: CanonicalDerivedAssetDraft[] = Array.from({ length: input.pageCount }, (_, index) => {
    const pageNumber = index + 1;

    return {
      kind: "pdf_page_preview",
      storagePath: `${basePath}/pages/page-${String(pageNumber).padStart(2, "0")}.svg`,
      fileName: `${safeStem}-page-${pageNumber}.svg`,
      mimeType: "image/svg+xml",
      extension: "svg",
      width: input.width,
      height: input.height,
      pageIndex: index,
      pageCount: input.pageCount,
      metadataJson: {
        sourceStoragePath: input.sourceStoragePath,
        derivedFrom: "submission_file",
        previewStrategy: "pdf_placeholder_svg",
        pageNumber,
      },
    } satisfies CanonicalDerivedAssetDraft;
  });

  return {
    pageCount: input.pageCount,
    previews,
  };
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPdfPagePreviewSvg(input: {
  fileName: string;
  pageNumber: number;
  pageCount: number;
  width: number;
  height: number;
}) {
  const title = escapeSvgText(input.fileName);
  const pageLabel = escapeSvgText(`Page ${input.pageNumber} of ${input.pageCount}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}" role="img" aria-label="${pageLabel}">
  <rect width="100%" height="100%" fill="#ffffff" />
  <rect x="24" y="24" width="${Math.max(input.width - 48, 0)}" height="${Math.max(input.height - 48, 0)}" rx="24" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
  <text x="50%" y="44%" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#0f172a">PDF review preview</text>
  <text x="50%" y="50%" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#334155">${pageLabel}</text>
  <text x="50%" y="58%" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#64748b">${title}</text>
</svg>`;
}
