import Link from "next/link";
import { t } from "@/lib/translations";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16">
      <div className="w-full max-w-md rounded-card border border-border bg-surface-raised p-comfortable text-center shadow-md">
        <div className="space-y-4 pb-4">
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
              {t.common.error404}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground">{t.common.pageNotFound}</h1>
          </div>
        </div>
        <div className="space-y-6 pt-0">
          <p className="text-base text-foreground-secondary">
            {t.common.pageNotFoundDescription}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex h-[var(--control-md-height)] items-center justify-center rounded-control-md bg-primary px-[var(--control-md-padding-x)] text-[var(--control-md-font)] font-medium text-foreground-inverse transition-all duration-fast ease-default hover:bg-primary-hover"
            >
              {t.common.goHome}
            </Link>
            <Link
              href="/help"
              className="inline-flex h-[var(--control-md-height)] items-center justify-center rounded-control-md border border-border bg-transparent px-[var(--control-md-padding-x)] text-[var(--control-md-font)] font-medium text-primary transition-all duration-fast ease-default hover:bg-surface-muted hover:border-border-hover"
            >
              {t.common.getHelp}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
