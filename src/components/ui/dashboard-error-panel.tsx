import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/lib/translations";

interface DashboardErrorPanelProps {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function DashboardErrorPanel({
  title,
  message,
  onRetry,
  retryLabel = t.components.dashboardErrorPanel.tryAgain,
}: DashboardErrorPanelProps) {
  return (
    <Card className="border-error-subtle">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ErrorPanelIcon />
          <CardTitle className="text-error">{title}</CardTitle>
        </div>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {onRetry ? (
        <CardFooter>
          <Button variant="secondary" onClick={onRetry} leftIcon={<RefreshIcon />}>
            {retryLabel}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function ErrorPanelIcon() {
  return (
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
      className="text-error"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
