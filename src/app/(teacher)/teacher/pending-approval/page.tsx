import Link from "next/link";
import { redirect } from "next/navigation";

import { t } from "@/lib/translations";
import { requireAreaAccess } from "@/lib/auth/guards";
import { formatDate } from "@/lib/format-date";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import {
  getTeacherOnboardingState,
  listTeacherOrganizations,
} from "@/modules/teachers/server-data";

// ============================================================================
// Icon Components
// ============================================================================

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function InfoIcon() {
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
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function MailIcon() {
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
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================


function getEstimatedWaitTime(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    return t.teacher.pendingApproval.statusCard.lessThanDay;
  } else if (diffDays === 1) {
    return t.teacher.pendingApproval.statusCard.oneDay;
  } else if (diffDays < 7) {
    return t.teacher.pendingApproval.statusCard.days(diffDays);
  } else {
    return t.teacher.pendingApproval.statusCard.weeks(Math.floor(diffDays / 7));
  }
}

// ============================================================================
// Main Pending Approval Page Component
// ============================================================================

export default async function TeacherPendingApprovalPage() {
  const session = await requireAreaAccess("teacher");
  const [onboardingState, organizations] = await Promise.all([
    getTeacherOnboardingState(session.userId),
    listTeacherOrganizations(session.userId, { pageSize: 100 }),
  ]);

  if (onboardingState === "active") {
    redirect("/teacher");
  }

  if (onboardingState === "no_org") {
    redirect("/teacher/onboarding");
  }

  const pendingOrg = organizations.find(
    (organization) =>
      organization.status === "pending" || organization.membershipStatus === "pending",
  );

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
<div className="text-center">
        <h1 className="text-h1 font-bold text-foreground">
          {t.teacher.pendingApproval.title}
        </h1>
        <p className="mt-2 text-body text-foreground-secondary">
          {t.teacher.pendingApproval.description}
        </p>
      </div>

      {/* Status Card */}
<Card elevation="sm" className="border-warning-subtle">
        <CardHeader className="items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-warning-subtle text-warning">
            <ClockIcon />
          </div>
          <CardTitle>{t.teacher.pendingApproval.statusCard.title}</CardTitle>
          <CardDescription>
            {t.teacher.pendingApproval.statusCard.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingOrg && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-secondary">{t.teacher.pendingApproval.statusCard.organization}</span>
                  <span className="font-medium text-foreground">{pendingOrg.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-secondary">{t.teacher.pendingApproval.statusCard.submitted}</span>
                  <span className="font-medium text-foreground">
                    {formatDate(pendingOrg.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-secondary">{t.teacher.pendingApproval.statusCard.status}</span>
                  <StatusChip status="warning" size="sm">
                    {t.teacher.pendingApproval.statusCard.pendingApproval}
                  </StatusChip>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-secondary">{t.teacher.pendingApproval.statusCard.waitingFor}</span>
                  <span className="font-medium text-foreground">
                    {getEstimatedWaitTime(pendingOrg.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Estimated Time Badge */}
          <div className="flex items-center justify-center gap-2">
            <Badge variant="info" size="sm">
              <InfoIcon />
              {t.teacher.pendingApproval.statusCard.estimated}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* What Happens Next */}
<div className="rounded-lg border border-border bg-surface-raised p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t.teacher.pendingApproval.next.title}
        </h2>
        <ul className="space-y-3 text-body text-foreground-secondary">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-medium text-primary">
              1
            </span>
            <span>{t.teacher.pendingApproval.next.step1}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-medium text-primary">
              2
            </span>
            <span>{t.teacher.pendingApproval.next.step2}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-medium text-primary">
              3
            </span>
            <span>{t.teacher.pendingApproval.next.step3}</span>
          </li>
        </ul>
      </div>

      {/* Contact Support */}
<div className="text-center">
        <p className="text-sm text-foreground-secondary">
          {t.teacher.pendingApproval.contact.question}{" "}
          <Link
            href="/contact"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <MailIcon />
            {t.teacher.pendingApproval.contact.support}
          </Link>
        </p>
      </div>

      {/* Refresh Button */}
<div className="flex justify-center">
        <Button variant="secondary" asChild>
          <Link href="/teacher">{t.teacher.pendingApproval.checkStatus}</Link>
        </Button>
      </div>
    </section>
  );
}
