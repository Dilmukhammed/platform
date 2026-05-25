"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { t } from "@/lib/translations";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16">
      <Card elevation="md" className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-error-subtle">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
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
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
              {t.common.somethingWentWrong}
            </p>
            <CardTitle className="mt-2 text-3xl">Error</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <CardDescription className="text-base">
            We&apos;re sorry, but an unexpected error has occurred. 
            Our team has been notified and we&apos;re working to fix the issue.
          </CardDescription>
          
          {error.digest && (
            <div className="rounded-lg bg-surface-muted p-3">
              <p className="text-xs text-foreground-secondary">
                Error ID: <code className="font-mono text-foreground">{error.digest}</code>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={reset}>
              {t.common.tryAgain}
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/">{t.common.goHome}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
