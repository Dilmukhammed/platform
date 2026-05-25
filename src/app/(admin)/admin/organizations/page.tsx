import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Building2, Users, GraduationCap, Settings, ChevronRight } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approveAdminOrganization } from "@/modules/admins/actions";
import { listAdminOrganizations } from "@/modules/admins/server-data";

interface OrganizationWithStats {
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  teacherCount: number;
  studentCount: number;
  createdAt: string;
}

// Server action to approve organization
async function approveOrganizationAction(formData: FormData) {
  "use server";
  const organizationId = formData.get("organizationId") as string;
  try {
    await approveAdminOrganization(organizationId);

    revalidatePath("/admin/organizations");
    redirect("/admin/organizations?approved=true");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t.admin.organizations.failedToApproveOrganization;
    redirect(`/admin/organizations?error=${encodeURIComponent(errorMessage)}`);
  }
}

export default async function AdminOrganizationsPage() {
  await requireAreaAccess("admin");

  const [organizations, pendingApprovals] = await Promise.all([
    listAdminOrganizations(),
    listAdminOrganizations("pending"),
  ]);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.admin.organizations.adminOrganizations}
          </p>
          <CardTitle className="text-h1">{t.admin.organizations.directory}</CardTitle>
          <CardDescription>
            {t.admin.organizations.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="default" size="md">
              {t.admin.organizations.total(organizations.length)}
            </Badge>
            <Badge variant="warning" size="md">
              {t.admin.organizations.pending(pendingApprovals.length)}
            </Badge>
            <Badge variant="success" size="md">
              {t.admin.organizations.active(organizations.filter((o) => o.status === "active").length)}
            </Badge>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/organization-approvals">
                {t.admin.organizations.viewApprovalQueue}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card elevation="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                All organizations
              </p>
              <CardTitle className="mt-2">Organization list</CardTitle>
            </div>
            <Badge variant="default" size="md">
              {organizations.length} entries
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {organizations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.admin.organizations.organization}</TableHead>
                  <TableHead>{t.admin.organizations.status}</TableHead>
                  <TableHead>{t.admin.students.student}</TableHead>
                  <TableHead>{t.admin.teachers.teacher}</TableHead>
                  <TableHead>{t.admin.organizations.created}</TableHead>
                  <TableHead>{t.admin.organizations.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.organizationId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-subtle/30">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{org.name}</p>
                          <p className="text-sm text-foreground-secondary">{org.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.status === "active" ? (
                        <StatusChip status="success" size="sm">
                          {t.admin.organizations.activeStatus}
                        </StatusChip>
                      ) : (
                        <StatusChip status="warning" size="sm">
                          {t.admin.organizations.pendingStatus}
                        </StatusChip>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-foreground-secondary" />
                        <span>{org.studentCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="h-4 w-4 text-foreground-secondary" />
                        <span>{org.teacherCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground-secondary">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/organizations/${org.organizationId}`}>
                            {t.admin.organizations.view}
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                        {org.status === "pending" && (
                          <form action={approveOrganizationAction}>
                            <input type="hidden" name="organizationId" value={org.organizationId} />
                            <Button type="submit" variant="primary" size="sm">
                              {t.admin.organizations.approve}
                            </Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title={t.admin.organizations.noOrganizationsYet}
              description={t.admin.organizations.organizationsAppearWhenCreated}
            />
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card elevation="sm" className="bg-primary-subtle/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-subtle/50">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{organizations.length}</p>
                <p className="text-sm text-foreground-secondary">{t.admin.organizations.totalOrganizations}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm" className="bg-warning-subtle/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-subtle/50">
                <Users className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingApprovals.length}</p>
                <p className="text-sm text-foreground-secondary">{t.admin.organizations.pendingApprovals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm" className="bg-success-subtle/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-subtle/50">
                <GraduationCap className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {organizations.filter((o) => o.status === "active").length}
                </p>
                <p className="text-sm text-foreground-secondary">{t.admin.organizations.activeOrganizations}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm" className="bg-info-subtle/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-subtle/50">
                <Settings className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {organizations.reduce((sum, org) => sum + org.teacherCount, 0)}
                </p>
                <p className="text-sm text-foreground-secondary">{t.admin.organizations.totalTeachers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
