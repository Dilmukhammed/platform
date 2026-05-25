import { Suspense } from "react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
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
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

// ============================================================================
// Skeleton Components
// ============================================================================

function SettingsPageSkeleton() {
  return (
    <section className="space-y-6">
      {/* Header Skeleton */}
      <div>
        <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
        <div className="mt-2 h-8 w-64 animate-pulse rounded bg-surface-muted" />
        <div className="mt-3 h-4 w-96 animate-pulse rounded bg-surface-muted" />
      </div>

      {/* Cards Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Icon Components
// ============================================================================

function SettingsIcon() {
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UserIcon() {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BellIcon() {
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
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function ShieldIcon() {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

async function SettingsPageContent() {
  const session = await requireAreaAccess("admin");

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
          {t.admin.settings.heading}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-foreground">
          {t.admin.settings.title}
        </h1>
        <p className="mt-3 max-w-3xl text-body text-foreground-secondary">
          {t.admin.settings.description}
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Card */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="text-admin">
                <UserIcon />
              </div>
              <div>
                <CardTitle>{t.admin.settings.profile}</CardTitle>
                <CardDescription>{t.admin.settings.adminAccountInfo}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label={t.admin.settings.displayName}>
              <Input value={session.displayName} disabled />
            </FormField>
            <FormField label={t.admin.settings.userId}>
              <Input value={session.userId} disabled />
            </FormField>
            <FormField label={t.admin.settings.role}>
              <div className="flex items-center gap-2">
                <StatusChip status="success" size="sm">
                  {t.admin.settings.admin}
                </StatusChip>
              </div>
            </FormField>
          </CardContent>
        </Card>

        {/* Notifications Card */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="text-admin">
                <BellIcon />
              </div>
              <div>
                <CardTitle>{t.admin.settings.notifications}</CardTitle>
                <CardDescription>{t.admin.settings.manageNotificationPreferences}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium text-foreground">{t.admin.settings.inAppNotifications}</p>
                <p className="text-sm text-foreground-secondary">{t.admin.settings.receiveInPlatform}</p>
              </div>
              <Badge variant="success" size="sm">{t.admin.settings.enabled}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium text-foreground">{t.admin.settings.emailNotifications}</p>
                <p className="text-sm text-foreground-secondary">{t.admin.settings.receiveViaEmail}</p>
              </div>
              <Badge variant="default" size="sm">{t.admin.settings.comingSoon}</Badge>
            </div>
            <Button variant="secondary" size="sm" disabled>
              {t.admin.settings.savePreferences}
            </Button>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="text-admin">
                <ShieldIcon />
              </div>
              <div>
                <CardTitle>{t.admin.settings.security}</CardTitle>
                <CardDescription>{t.admin.settings.manageSecuritySettings}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium text-foreground">{t.admin.settings.password}</p>
                <p className="text-sm text-foreground-secondary">{t.admin.settings.changePassword}</p>
              </div>
              <Button variant="secondary" size="sm" disabled>
                {t.admin.settings.change}
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium text-foreground">{t.admin.settings.twoFactorAuth}</p>
                <p className="text-sm text-foreground-secondary">{t.admin.settings.extraLayerSecurity}</p>
              </div>
              <Badge variant="default" size="sm">{t.admin.settings.comingSoon}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* System Info Card */}
        <Card elevation="sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="text-admin">
                <SettingsIcon />
              </div>
              <div>
                <CardTitle>{t.admin.settings.systemInfo}</CardTitle>
                <CardDescription>{t.admin.settings.platformInformation}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-foreground-secondary">{t.admin.settings.platformVersion}</span>
              <span className="font-medium text-foreground">1.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground-secondary">{t.admin.settings.environment}</span>
              <Badge variant="success" size="sm">{t.admin.settings.production}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground-secondary">{t.admin.settings.adminAccess}</span>
              <StatusChip status="success" size="sm">{t.admin.settings.active}</StatusChip>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ============================================================================
// Page Export
// ============================================================================

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsPageContent />
    </Suspense>
  );
}
