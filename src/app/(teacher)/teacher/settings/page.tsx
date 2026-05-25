import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, School, Bell, Shield, Palette } from "lucide-react";
import { PasswordChangeModal } from "./password-change-modal";
import { ProfileEditor } from "./ProfileEditor";
import { getTeacherSelectedOrganization } from "@/modules/teachers/server-data";
import { createServerClient } from "@/lib/supabase/server-client";

export default async function TeacherSettingsPage() {
  const session = await requireAreaAccess("teacher");
  const selectedOrganization = await getTeacherSelectedOrganization(session.userId);

  // Fetch avatar URL from database
  let initialAvatarUrl: string | null = null;
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("platform_users")
      .select("avatar_url")
      .eq("id", session.userId)
      .single();
    
    if (data?.avatar_url) {
      initialAvatarUrl = `/api/v1/teacher/profile/avatar?t=${Date.now()}`;
    }
  } catch {
    // Non-critical — proceed without avatar
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.teacher.settings.title}</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          {t.teacher.settings.description}
        </p>
      </div>

      {/* Profile Section */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>{t.teacher.settings.profile.title}</CardTitle>
          </div>
          <CardDescription>{t.teacher.settings.profile.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileEditor
            userId={session.userId}
            initialDisplayName={session.displayName}
            loginIdentifier={session.loginIdentifier}
            role={session.role}
            initialAvatarUrl={initialAvatarUrl}
          />
        </CardContent>
      </Card>

      {/* Organization Section */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <School className="h-5 w-5 text-primary" />
            <CardTitle>{t.teacher.settings.organization.title}</CardTitle>
          </div>
          <CardDescription>{t.teacher.settings.organization.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedOrganization.organizationId ? (
            <div className="flex items-center gap-3 p-3 bg-primary-subtle/30 rounded-lg border border-primary/20">
              <School className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">{selectedOrganization.organizationName}</p>
                <p className="text-xs text-foreground-secondary">{t.teacher.settings.organization.organizationId(selectedOrganization.organizationId)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-warning-subtle/30 rounded-lg border border-warning/20">
              <School className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium text-foreground">{t.teacher.settings.organization.noOrganizationSelected}</p>
                <p className="text-xs text-foreground-secondary">{t.teacher.settings.organization.noOrganizationDescription}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>{t.teacher.settings.notifications.title}</CardTitle>
          </div>
          <CardDescription>{t.teacher.settings.notifications.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-subtle/50 rounded-md">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{t.teacher.settings.notifications.inApp}</p>
                  <p className="text-xs text-foreground-secondary">{t.teacher.settings.notifications.inAppDescription}</p>
                </div>
              </div>
              <Badge variant="success" size="sm">{t.teacher.settings.notifications.enabled}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-surface-muted rounded-md">
                  <Mail className="h-4 w-4 text-foreground-secondary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{t.teacher.settings.notifications.email}</p>
                  <p className="text-xs text-foreground-secondary">{t.teacher.settings.notifications.emailDescription}</p>
                </div>
              </div>
              <Badge variant="default" size="sm">{t.teacher.settings.notifications.comingSoon}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Preferences */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>{t.teacher.settings.appearance.title}</CardTitle>
          </div>
          <CardDescription>{t.teacher.settings.appearance.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-subtle/50 rounded-md">
                  <Palette className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{t.teacher.settings.appearance.theme}</p>
                  <p className="text-xs text-foreground-secondary">{t.teacher.settings.appearance.systemDefaultLight}</p>
                </div>
              </div>
              <Badge variant="default" size="sm">{t.teacher.settings.appearance.light}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Section */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>{t.teacher.settings.security.title}</CardTitle>
          </div>
          <CardDescription>{t.teacher.settings.security.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-subtle/50 rounded-md">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{t.teacher.settings.security.password}</p>
                  <p className="text-xs text-foreground-secondary">{t.teacher.settings.security.passwordDescription}</p>
                </div>
              </div>
              <PasswordChangeModal userId={session.userId} />
            </div>
            <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-surface-muted rounded-md">
                  <Shield className="h-4 w-4 text-foreground-secondary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{t.teacher.settings.security.twoFactor}</p>
                  <p className="text-xs text-foreground-secondary">{t.teacher.settings.security.twoFactorDescription}</p>
                </div>
              </div>
              <Badge variant="default" size="sm">{t.teacher.settings.security.comingSoon}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Info Footer */}
      <div className="pt-4 border-t border-border">
        <p className="text-xs text-foreground-secondary text-center">
          {t.teacher.settings.footer.accountIdRole(session.userId, session.role)}
        </p>
      </div>
    </section>
  );
}
