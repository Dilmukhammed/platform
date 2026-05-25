import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ArrowLeft, Building2, CheckCircle, XCircle } from "lucide-react";

import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  approveAdminOrganization,
  rejectAdminOrganizationApproval,
} from "@/modules/admins/actions";
import { listAdminPendingOrganizationApprovals } from "@/modules/admins/server-data";

interface PendingOrganizationApproval {
  organizationId: string;
  organizationName: string;
  slug: string;
  type: string;
  description: string | null;
  requestedByTeacherName: string;
  requestedByTeacherEmail: string;
  requestedAt: string;
}

// Server action to approve organization
async function approveOrganizationAction(formData: FormData) {
  "use server";
  const organizationId = formData.get("organizationId") as string;
  try {
    await approveAdminOrganization(organizationId);

    revalidatePath("/admin/organization-approvals");
    redirect("/admin/organization-approvals?approved=true");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const errorMessage = error instanceof Error ? error.message : "Failed to approve organization";
    redirect(`/admin/organization-approvals?error=${encodeURIComponent(errorMessage)}`);
  }
}

// Server action to reject organization
async function rejectOrganizationAction(formData: FormData) {
  "use server";
  const organizationId = formData.get("organizationId") as string;
  const reason = formData.get("reason") as string;
  try {
    await rejectAdminOrganizationApproval(organizationId, reason);

    revalidatePath("/admin/organization-approvals");
    redirect("/admin/organization-approvals?rejected=true");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const errorMessage = error instanceof Error ? error.message : "Failed to reject organization";
    redirect(`/admin/organization-approvals?error=${encodeURIComponent(errorMessage)}`);
  }
}

export default async function AdminPendingOrganizationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAreaAccess("admin");

  const pendingApprovals: PendingOrganizationApproval[] = await listAdminPendingOrganizationApprovals();
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const message = typeof params.approved === "string"
    ? t.admin.organizationApprovals.approvedMessage
    : typeof params.rejected === "string"
      ? t.admin.organizationApprovals.rejectedMessage
      : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.admin.organizationApprovals.heading}
          </p>
          <CardTitle className="text-h1">{t.admin.organizationApprovals.title}</CardTitle>
          <CardDescription>
            {t.admin.organizationApprovals.description}
          </CardDescription>
          <div className="pt-2">
            <Button variant="ghost" size="sm" asChild leftIcon={<ArrowLeft className="h-4 w-4" />}>
              <Link href="/admin/organizations">{t.admin.organizationApprovals.backToAllOrganizations}</Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card elevation="sm" className="bg-primary-subtle/30 border-primary-subtle">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">{t.admin.organizationApprovals.pendingRequests}</p>
                <p className="text-2xl font-bold text-foreground">{pendingApprovals.length}</p>
              </div>
              <Badge variant="primary" size="md">
                {pendingApprovals.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="rounded-xl border border-success-subtle bg-success-subtle/50 px-4 py-3 text-sm text-success">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {message}
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      {/* Pending Approvals List */}
      <div className="grid gap-4">
        {pendingApprovals.length === 0 ? (
          <Card elevation="sm">
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title={t.admin.organizationApprovals.noPendingRequests}
              description={t.admin.organizationApprovals.allReviewed}
            />
          </Card>
        ) : (
          pendingApprovals.map((organization) => (
            <Card key={organization.organizationId} elevation="sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-semibold text-foreground">
                        {organization.organizationName}
                      </h2>
                      <StatusChip status="warning" size="sm">
                        {t.admin.organizationApprovals.pending}
                      </StatusChip>
                    </div>
                    <p className="mt-1 text-sm text-foreground-secondary">
                      {t.admin.organizationApprovals.requestedBy(organization.requestedByTeacherName)} · {organization.requestedByTeacherEmail}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-foreground-secondary">
                  <Badge variant="default" size="sm">
                    {new Date(organization.requestedAt).toLocaleDateString()}
                  </Badge>
                  <span>{t.admin.organizationApprovals.atTime(new Date(organization.requestedAt).toLocaleTimeString())}</span>
                </div>

                <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Approve Form */}
                  <form action={approveOrganizationAction}>
                    <input type="hidden" name="organizationId" value={organization.organizationId} />
                    <Button type="submit" variant="primary" leftIcon={<CheckCircle className="h-4 w-4" />}>
                      {t.admin.organizationApprovals.approveRequest}
                    </Button>
                  </form>

                  {/* Reject Form */}
                  <form action={rejectOrganizationAction} className="flex w-full max-w-xl flex-col gap-3 md:items-end">
                    <input type="hidden" name="organizationId" value={organization.organizationId} />
                    <div className="w-full grid gap-2">
                      <label htmlFor={`reason-${organization.organizationId}`} className="text-sm font-medium text-foreground">
                        {t.admin.organizationApprovals.rejectionReason}
                      </label>
                      <textarea
                        id={`reason-${organization.organizationId}`}
                        name="reason"
                        required
                        minLength={3}
                        rows={3}
                        className="w-full rounded-control-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        placeholder={t.admin.organizationApprovals.rejectionPlaceholder}
                      />
                    </div>
                    <Button type="submit" variant="destructive" leftIcon={<XCircle className="h-4 w-4" />}>
                      {t.admin.organizationApprovals.rejectWithReason}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
