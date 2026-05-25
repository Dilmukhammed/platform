import Link from "next/link";
import { redirect } from "next/navigation";

import { t } from "@/lib/translations";
import { requireAreaAccess } from "@/lib/auth/guards";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTeacherOnboardingState } from "@/modules/teachers/server-data";

// ============================================================================
// Icon Components
// ============================================================================

function BuildingIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M12 6h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
      <path d="M8 6h.01" />
      <path d="M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <rect x="4" y="2" width="16" height="20" rx="2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ArrowRightIcon() {
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
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

// ============================================================================
// Main Onboarding Page Component
// ============================================================================

export default async function TeacherOnboardingPage() {
  const session = await requireAreaAccess("teacher");
  const onboardingState = await getTeacherOnboardingState(session.userId);

  if (onboardingState === "active") {
    redirect("/teacher");
  }

  if (onboardingState === "pending_approval") {
    redirect("/teacher/pending-approval");
  }

  return (
    <section className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-h1 font-bold text-foreground">
          {t.teacher.onboarding.welcome(session.displayName)}
        </h1>
        <p className="mt-2 text-body text-foreground-secondary">
          {t.teacher.onboarding.description}
        </p>
      </div>

      {/* Options Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Create Organization Option */}
        <Card elevation="sm" className="flex flex-col">
          <CardHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-subtle text-primary">
              <BuildingIcon />
            </div>
            <CardTitle>{t.teacher.onboarding.createOrganization.title}</CardTitle>
            <CardDescription>
              {t.teacher.onboarding.createOrganization.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Button asChild className="w-full">
              <Link href="/teacher/organizations">
                {t.teacher.onboarding.createOrganization.action}
                <ArrowRightIcon />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Join via Invite Option */}
        <Card elevation="sm" className="flex flex-col">
          <CardHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-info-subtle text-info">
              <MailIcon />
            </div>
            <CardTitle>{t.teacher.onboarding.joinViaInvite.title}</CardTitle>
            <CardDescription>
              {t.teacher.onboarding.joinViaInvite.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0">
            <Button variant="secondary" asChild className="w-full">
              <Link href="/auth/teacher/invite/accept">
                {t.teacher.onboarding.joinViaInvite.action}
                <ArrowRightIcon />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Help Section */}
      <div className="rounded-lg border border-border bg-surface-raised p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          {t.teacher.onboarding.help.title}
        </h2>
        <p className="text-body text-foreground-secondary">
          {t.teacher.onboarding.help.description}{" "}
          <Link href="/help" className="text-primary hover:underline">
            {t.teacher.onboarding.help.helpCenter}
          </Link>
        </p>
      </div>
    </section>
  );
}
