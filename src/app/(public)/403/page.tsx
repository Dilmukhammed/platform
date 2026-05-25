import Link from "next/link";
import { t } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-16">
      <Card elevation="md" className="w-full max-w-md text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-warning-subtle">
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
              className="text-warning"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              <path d="m14.5 9-5 5" />
              <path d="m9.5 9 5 5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
              {t.public.forbidden.eyebrow}
            </p>
            <CardTitle className="mt-2 text-3xl">{t.public.forbidden.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <CardDescription className="text-base">
            {t.public.forbidden.description}
          </CardDescription>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/">{t.public.forbidden.goHome}</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/contact">{t.public.forbidden.contactSupport}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}