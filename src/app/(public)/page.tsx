import Link from "next/link";
import { t } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PublicHomePage() {
  return (
    <div className="min-h-screen bg-surface">
      <section className="relative px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex justify-center">
            <Badge variant="primary" size="sm">
              {t.public.landing.badge}
            </Badge>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {t.public.landing.titleLine1}
              <br />
              <span className="text-primary">{t.public.landing.titleLine2}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-foreground-secondary sm:text-lg">
              {t.public.landing.description}
            </p>
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/join">{t.public.landing.enterClassCode}</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
              <Link href="/auth/student/login">{t.public.landing.studentLogin}</Link>
            </Button>
          </div>

          <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface-raised p-6 sm:flex-row sm:gap-6">
            <span className="text-sm text-foreground-secondary">{t.public.landing.teacherPrompt}</span>
            <div className="flex gap-3">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/teacher/sign-up">Sign up</Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/auth/teacher/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{t.public.landing.howItWorks}</h2>
            <p className="mt-2 text-foreground-secondary">{t.public.landing.howItWorksDescription}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <Card elevation="sm">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-control-md bg-primary-subtle text-primary font-semibold">
                  1
                </div>
                <CardTitle>{t.public.landing.step1Title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t.public.landing.step1Description}
                </CardDescription>
              </CardContent>
            </Card>

            <Card elevation="sm">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-control-md bg-primary-subtle text-primary font-semibold">
                  2
                </div>
                <CardTitle>{t.public.landing.step2Title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t.public.landing.step2Description}
                </CardDescription>
              </CardContent>
            </Card>

            <Card elevation="sm">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-control-md bg-primary-subtle text-primary font-semibold">
                  3
                </div>
                <CardTitle>{t.public.landing.step3Title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t.public.landing.step3Description}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-16">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="flex flex-col justify-center">
              <Badge variant="info" size="sm" className="mb-4 w-fit">
                {t.public.landing.forStudents}
              </Badge>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                {t.public.landing.studentsTitle}
              </h2>
              <ul className="mt-6 space-y-4">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success text-xs font-medium">
                    ✓
                  </span>
                  <span className="text-foreground-secondary">
                    {t.public.landing.studentsPoint1}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success text-xs font-medium">
                    ✓
                  </span>
                  <span className="text-foreground-secondary">
                    {t.public.landing.studentsPoint2}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success text-xs font-medium">
                    ✓
                  </span>
                  <span className="text-foreground-secondary">
                    {t.public.landing.studentsPoint3}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success text-xs font-medium">
                    ✓
                  </span>
                  <span className="text-foreground-secondary">
                    {t.public.landing.studentsPoint4}
                  </span>
                </li>
              </ul>
            </div>
            <Card elevation="md" className="flex items-center justify-center bg-surface-muted">
              <CardContent className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-container bg-primary-subtle">
                  <svg
                    className="h-10 w-10 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                </div>
                <p className="text-foreground-secondary">{t.public.landing.studentsVisualCaption}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <Card elevation="md" className="order-2 flex items-center justify-center bg-surface-muted lg:order-1">
              <CardContent className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-container bg-primary-subtle">
                  <svg
                    className="h-10 w-10 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.75m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605"
                    />
                  </svg>
                </div>
                <p className="text-foreground-secondary">{t.public.landing.teachersVisualCaption}</p>
              </CardContent>
            </Card>
            <div className="order-1 flex flex-col justify-center lg:order-2">
              <Badge variant="primary" size="sm" className="mb-4 w-fit">
                {t.public.landing.forTeachers}
              </Badge>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                {t.public.landing.teachersTitle}
              </h2>
              <ul className="mt-6 space-y-4">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success text-xs font-medium">
                    ✓
                  </span>
                  <span className="text-foreground-secondary">
                    {t.public.landing.teachersPoint1}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success text-xs font-medium">
                    ✓
                  </span>
                  <span className="text-foreground-secondary">
                    {t.public.landing.teachersPoint2}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success text-xs font-medium">
                    ✓
                  </span>
                  <span className="text-foreground-secondary">
                    {t.public.landing.teachersPoint3}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success text-xs font-medium">
                    ✓
                  </span>
                  <span className="text-foreground-secondary">
                    {t.public.landing.teachersPoint4}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface-raised px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <p className="font-semibold text-foreground">{t.public.footer.brand}</p>
              <p className="mt-2 text-sm text-foreground-secondary">
                {t.nav.footerTagline}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">{t.nav.product}</h3>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link href="/" className="text-sm text-foreground-secondary hover:text-primary">
                    {t.nav.home}
                  </Link>
                </li>
                <li>
                  <Link href="/join" className="text-sm text-foreground-secondary hover:text-primary">
                    {t.nav.joinClass}
                  </Link>
                </li>
                <li>
                  <Link href="/auth/student/login" className="text-sm text-foreground-secondary hover:text-primary">
                    {t.nav.studentLogin}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">{t.nav.support}</h3>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link href="/help" className="text-sm text-foreground-secondary hover:text-primary">
                    {t.nav.helpCenter}
                  </Link>
                </li>
                <li>
                  <Link href="/help" className="text-sm text-foreground-secondary hover:text-primary">
                    {t.nav.studentAccessHelp}
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-sm text-foreground-secondary hover:text-primary">
                    {t.nav.contact}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">{t.nav.legal}</h3>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link href="/terms" className="text-sm text-foreground-secondary hover:text-primary">
                    {t.nav.terms}
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-sm text-foreground-secondary hover:text-primary">
                    {t.nav.privacy}
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-8 text-center">
            <p className="text-sm text-foreground-secondary">
              © {new Date().getFullYear()} {t.public.footer.brand}. {t.common.allRightsReserved}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}