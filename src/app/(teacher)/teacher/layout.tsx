import { redirect } from "next/navigation";

import { t } from "@/lib/translations";
import { requireAreaAccess } from "@/lib/auth/guards";
import { clearAuthSession, getSessionExpiration } from "@/lib/auth/session";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { SessionExpirationWarning } from "@/components/session-expiration-warning";
import { NotificationsBadge } from "@/components/notifications/NotificationsBadge";

const teacherNav = [
  ["/teacher", t.teacher.layout.nav.overview],
  ["/teacher/organizations", t.teacher.layout.nav.organizations],
  ["/teacher/classes", t.teacher.layout.nav.classes],
  ["/teacher/students", t.teacher.layout.nav.students],
  ["/teacher/materials", t.teacher.layout.nav.materials],
  ["/teacher/tests", t.teacher.layout.nav.tests],
  ["/teacher/assignments", t.teacher.layout.nav.assignments],
  ["/teacher/publications", t.teacher.layout.nav.publications],
  ["/teacher/reviews", t.teacher.layout.nav.reviews],
  ["/teacher/gradebook", t.teacher.layout.nav.gradebook],
  ["/teacher/library", t.teacher.layout.nav.library],
  ["/teacher/notifications", t.teacher.layout.nav.notifications],
  ["/teacher/settings", t.teacher.layout.nav.settings],
] as const;

export default async function TeacherLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAreaAccess("teacher");
  const expiration = await getSessionExpiration();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-surface p-6 md:border-b-0 md:border-r">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">{t.teacher.layout.role}</span>
          <RoleBadge role="teacher" size="sm" />
        </div>
        <div className="mb-6 rounded-container-md bg-surface-raised p-4">
          <div className="min-w-0 overflow-hidden">
            <p className="truncate font-medium text-foreground">{session.displayName}</p>
            <p className="truncate text-sm text-foreground-secondary">{session.loginIdentifier}</p>
          </div>
          <form action={async () => {
            "use server";
            await clearAuthSession();
            redirect("/auth/teacher/sign-in");
          }} className="mt-3">
            <Button type="submit" variant="ghost" size="sm">
              {t.teacher.layout.signOut}
            </Button>
          </form>
        </div>
        <SidebarNav
          navItems={teacherNav}
          role="teacher"
          notificationsSlot={
            <NotificationsBadge recipientType="teacher" recipientId={session.userId} />
          }
        />
      </aside>
      <main className="p-6">{children}</main>
      {expiration && (
        <SessionExpirationWarning
          expiresAt={expiration.toISOString()}
          loginUrl="/auth/teacher/sign-in"
        />
      )}
    </div>
  );
}
