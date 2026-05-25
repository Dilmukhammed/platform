import { redirect } from "next/navigation";

import { requireAreaAccess } from "@/lib/auth/guards";
import { clearAuthSession } from "@/lib/auth/session";
import { t } from "@/lib/translations";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";

const adminNav = [
  ["/admin", t.admin.layout.overview],
  ["/admin/organizations", t.admin.layout.organizations],
  ["/admin/teachers", t.admin.layout.teachers],
  ["/admin/students", t.admin.layout.students],
  ["/admin/classes", t.admin.layout.classes],
  ["/admin/assignments", t.admin.layout.assignments],
  ["/admin/material-approvals", t.admin.layout.materialApprovals],
  ["/admin/test-approvals", t.admin.layout.testApprovals],
  ["/admin/test-deletion-requests", t.admin.layout.deletionRequests],
  ["/admin/organization-approvals", t.admin.layout.organizationApprovals],
  ["/admin/notifications", t.admin.layout.notifications],
  ["/admin/system", t.admin.layout.system],
  ["/admin/settings", t.admin.layout.settings],
] as const;

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAreaAccess("admin");

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-surface p-6 md:border-b-0 md:border-r">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">{t.admin.layout.admin}</span>
          <RoleBadge role="admin" size="sm" />
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
              {t.admin.layout.signOut}
            </Button>
          </form>
        </div>
        <SidebarNav navItems={adminNav} role="admin" />
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
