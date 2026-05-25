"use client";

import { Download, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/translations";

type PdfViewerProps = {
  fileUrl: string;
  fileName?: string;
};

export function PdfViewer({ fileUrl, fileName }: PdfViewerProps) {
  return (
    <div className="space-y-3">
      {/* Header with file name and actions */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-2">
        {fileName && (
          <span className="truncate text-sm text-foreground-secondary">
            {fileName}
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Button asChild variant="ghost" size="sm">
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              {t.components.pdfViewer.openInNewTab}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={fileUrl} download={fileName ?? "document.pdf"}>
              <Download className="h-4 w-4 mr-1" />
              {t.components.pdfViewer.download}
            </a>
          </Button>
        </div>
      </div>

      {/* Embedded PDF via browser's built-in viewer */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface-muted">
        <iframe
          src={fileUrl}
          title={fileName ?? t.components.pdfViewer.pdfDocument}
          className="h-[600px] w-full border-0"
        />
      </div>
    </div>
  );
}
