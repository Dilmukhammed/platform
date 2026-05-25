import { requireAreaAccess } from "@/lib/auth/guards";
import { apiPost } from "@/lib/api/server-fetch";
import { clearAuthSession, getSessionExpiration } from "@/lib/auth/session";
import { t } from "@/lib/translations";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { SessionExpirationWarning } from "@/components/session-expiration-warning";

const studentNav = [
  ["/student", t.student.layout.nav.overview],
  ["/student/classes", t.student.layout.nav.classes],
  ["/student/assignments", t.student.layout.nav.assignments],
  ["/student/results", t.student.layout.nav.results],
  ["/student/notifications", t.student.layout.nav.notifications],
  ["/student/profile", t.student.layout.nav.profile],
] as const;

export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAreaAccess("student");
  const expiration = await getSessionExpiration();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-surface p-6 md:border-b-0 md:border-r">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">{t.student.layout.role}</span>
          <RoleBadge role="student" size="sm" />
        </div>
        <div className="mb-6 rounded-container-md bg-surface-raised p-4">
          <div className="min-w-0 overflow-hidden">
            <p className="truncate font-medium text-foreground">{session.displayName}</p>
            <p className="truncate text-sm text-foreground-secondary">{session.loginIdentifier}</p>
          </div>
          <form action={async () => {
            "use server";
            await apiPost("/api/v1/student/auth/logout", {});
            await clearAuthSession();
          }} className="mt-3">
            <Button type="submit" variant="ghost" size="sm">
              {t.student.layout.signOut}
            </Button>
          </form>
        </div>
        <SidebarNav navItems={studentNav} role="student" />
      </aside>
      <main className="p-6">{children}</main>
      {expiration && (
        <SessionExpirationWarning
          expiresAt={expiration.toISOString()}
          loginUrl="/auth/student/login"
        />
      )}
    </div>
  );
}
