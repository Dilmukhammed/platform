"use client";

import { PdfViewer } from "@/components/pdf/PdfViewer";

interface PdfViewerWrapperProps {
  fileUrl: string;
  fileName?: string;
}

export function PdfViewerWrapper({ fileUrl, fileName }: PdfViewerWrapperProps) {
  return <PdfViewer fileUrl={fileUrl} fileName={fileName} />;
}
