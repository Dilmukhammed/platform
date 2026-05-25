import { revalidatePath } from "next/cache";
import { CheckCircle, XCircle, FileText, BookOpen, Download } from "lucide-react";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireAreaAccess } from "@/lib/auth/guards";
import { t } from "@/lib/translations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  approveAdminMaterialApproval,
  rejectAdminMaterialApproval,
} from "@/modules/admins/actions";
import { listAdminPendingMaterialApprovals } from "@/modules/admins/server-data";

interface PendingMaterialApproval {
  approvalId: string;
  materialId: string;
  title: string;
  description: string | null;
  sourceFilePath: string | null;
  organizationName: string;
  requestedByTeacherName: string;
  requestedByTeacherEmail: string;
  submittedAt: string;
}

// Server action to approve material
async function approveSchoolMaterialAction(formData: FormData) {
  "use server";
  const approvalId = formData.get("approvalId") as string;
  try {
    await approveAdminMaterialApproval(approvalId);

    revalidatePath("/admin/material-approvals");
    redirect("/admin/material-approvals?approved=true");
  } catch (error) {
    // Don't catch NEXT_REDIRECT - let it propagate
    if (isRedirectError(error)) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : "Failed to approve material";
    redirect(`/admin/material-approvals?error=${encodeURIComponent(errorMessage)}`);
  }
}

// Server action to reject material
async function rejectSchoolMaterialAction(formData: FormData) {
  "use server";
  const approvalId = formData.get("approvalId") as string;
  const reason = formData.get("reason") as string;
  try {
    await rejectAdminMaterialApproval(approvalId, reason);

    revalidatePath("/admin/material-approvals");
    redirect("/admin/material-approvals?rejected=true");
  } catch (error) {
    // Don't catch NEXT_REDIRECT - let it propagate
    if (isRedirectError(error)) {
      throw error;
    }
    const errorMessage = error instanceof Error ? error.message : "Failed to reject material";
    redirect(`/admin/material-approvals?error=${encodeURIComponent(errorMessage)}`);
  }
}

export default async function AdminMaterialApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAreaAccess("admin");

  const approvals: PendingMaterialApproval[] = await listAdminPendingMaterialApprovals();
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const message = typeof params.approved === "string"
    ? t.admin.materialApprovals.approvedMessage
    : typeof params.rejected === "string"
      ? t.admin.materialApprovals.rejectedMessage
      : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.admin.materialApprovals.heading}
          </p>
          <CardTitle className="text-h1">{t.admin.materialApprovals.title}</CardTitle>
          <CardDescription>
            {t.admin.materialApprovals.description}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card elevation="sm" className="bg-primary-subtle/30 border-primary-subtle">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">{t.admin.materialApprovals.pendingMaterials}</p>
                <p className="text-2xl font-bold text-foreground">{approvals.length}</p>
              </div>
              <Badge variant="primary" size="md">
                {approvals.length}
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
        {approvals.length === 0 ? (
          <Card elevation="sm">
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title={t.admin.materialApprovals.noPendingSubmissions}
              description={t.admin.materialApprovals.allReviewed}
            />
          </Card>
        ) : (
          approvals.map((approval) => (
            <Card key={approval.materialId} elevation="sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-semibold text-foreground">
                        {approval.title}
                      </h2>
                      <StatusChip status="warning" size="sm">
                        {t.admin.materialApprovals.pendingReview}
                      </StatusChip>
                    </div>
                    <p className="mt-1 text-sm text-foreground-secondary">
                      {approval.organizationName} · {approval.requestedByTeacherName} · {approval.requestedByTeacherEmail}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-surface p-3">
                  <p className="text-sm text-foreground-secondary">
                    {approval.description ?? t.admin.materialApprovals.noDescriptionProvided}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-foreground-secondary">
                  <Badge variant="default" size="sm">
                    <FileText className="h-3 w-3 mr-1" />
                    {t.admin.materialApprovals.material}
                  </Badge>
                  <span>{t.admin.materialApprovals.submittedAt(new Date(approval.submittedAt).toLocaleString())}</span>
                  {approval.sourceFilePath && (
                    <Button asChild variant="secondary" size="sm">
                      <a
                        href={`/api/v1/admin/materials/${approval.materialId}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        {t.admin.materialApprovals.viewFile}
                      </a>
                    </Button>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Approve Form */}
                  <form action={approveSchoolMaterialAction}>
                    <input type="hidden" name="approvalId" value={approval.approvalId} />
                    <Button type="submit" variant="primary" leftIcon={<CheckCircle className="h-4 w-4" />}>
                      {t.admin.materialApprovals.approveMaterial}
                    </Button>
                  </form>

                  {/* Reject Form */}
                  <form action={rejectSchoolMaterialAction} className="flex w-full max-w-xl flex-col gap-3 md:items-end">
                    <input type="hidden" name="approvalId" value={approval.approvalId} />
                    <div className="w-full grid gap-2">
                      <label htmlFor={`reason-${approval.approvalId}`} className="text-sm font-medium text-foreground">
                        {t.admin.materialApprovals.rejectionReason}
                      </label>
                      <textarea
                        id={`reason-${approval.approvalId}`}
                        name="reason"
                        required
                        minLength={3}
                        rows={3}
                        className="w-full rounded-control-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        placeholder={t.admin.materialApprovals.rejectionPlaceholder}
                      />
                    </div>
                    <Button type="submit" variant="destructive" leftIcon={<XCircle className="h-4 w-4" />}>
                      {t.admin.materialApprovals.rejectWithReason}
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
