import { CheckCircle, XCircle, FileQuestion, ClipboardList, Sparkles, User } from "lucide-react";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireAreaAccess } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { t } from "@/lib/translations";
import {
  approveAdminTestDeletionRequest,
  rejectAdminTestDeletionRequest,
} from "@/modules/admins/actions";

async function approveDeletionAction(formData: FormData) {
  "use server";
  const requestId = formData.get("requestId") as string;
  if (!requestId) throw new Error("Request ID required");
  try {
    await approveAdminTestDeletionRequest(requestId);
    revalidatePath("/admin/test-deletion-requests");
    redirect("/admin/test-deletion-requests?approved=true");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const errorMessage = error instanceof Error ? error.message : "Failed to approve deletion request";
    redirect(`/admin/test-deletion-requests?error=${encodeURIComponent(errorMessage)}`);
  }
}

async function rejectDeletionAction(formData: FormData) {
  "use server";
  const requestId = formData.get("requestId") as string;
  const reason = formData.get("reason") as string;
  if (!requestId) throw new Error("Request ID required");
  try {
    await rejectAdminTestDeletionRequest(requestId, reason);
    revalidatePath("/admin/test-deletion-requests");
    redirect("/admin/test-deletion-requests?rejected=true");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const errorMessage = error instanceof Error ? error.message : "Failed to reject deletion request";
    redirect(`/admin/test-deletion-requests?error=${encodeURIComponent(errorMessage)}`);
  }
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listAdminPendingTestDeletionRequests } from "@/modules/admins/server-data";

interface PendingDeletionRequest {
  requestId: string;
  testId: string;
  title: string;
  description: string | null;
  scopeType: string;
  ownerTeacherId: string;
  reason: string | null;
  decision: string;
  questionCount?: number;
  requestedBy: {
    userId: string;
    email: string;
    displayName: string;
  } | null;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
}

export default async function AdminTestDeletionRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAreaAccess("admin");

  const requests: PendingDeletionRequest[] = await listAdminPendingTestDeletionRequests();
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const message = typeof params.approved === "string"
    ? t.admin.testDeletionRequests.approvedMessage
    : typeof params.rejected === "string"
      ? t.admin.testDeletionRequests.rejectedMessage
      : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.admin.testDeletionRequests.heading}
          </p>
          <CardTitle className="text-h1">{t.admin.testDeletionRequests.title}</CardTitle>
          <CardDescription>
            {t.admin.testDeletionRequests.description}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card elevation="sm" className="bg-primary-subtle/30 border-primary-subtle">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">{t.admin.testDeletionRequests.pendingRequests}</p>
                <p className="text-2xl font-bold text-foreground">{requests.length}</p>
              </div>
              <Badge variant="primary" size="md">
                {requests.length}
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

      {/* Pending Deletion Requests List */}
      <div className="grid gap-4">
        {requests.length === 0 ? (
          <Card elevation="sm">
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title={t.admin.testDeletionRequests.noPendingRequests}
              description={t.admin.testDeletionRequests.allReviewed}
            />
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.requestId} elevation="sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-semibold text-foreground">
                        {request.title}
                      </h2>
                      <StatusChip status="warning" size="sm">
                        {t.admin.testDeletionRequests.pendingReview}
                      </StatusChip>
                    </div>
                    <p className="mt-1 text-sm text-foreground-secondary">
                      {request.requestedBy?.displayName ?? t.admin.testDeletionRequests.unknown} · {request.requestedBy?.email ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Deletion reason */}
                {request.reason && (
                  <div className="mt-4 rounded-lg border border-warning-subtle bg-warning-subtle/30 p-3">
                    <p className="text-sm font-medium text-warning">{t.admin.testDeletionRequests.deletionReason}</p>
                    <p className="mt-1 text-sm text-foreground-secondary">
                      {request.reason}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-foreground-secondary">
                  {request.questionCount != null && (
                    <Badge variant="info" size="sm">
                      <FileQuestion className="h-3 w-3 mr-1" />
                      {t.admin.testDeletionRequests.questionsCount(request.questionCount)}
                    </Badge>
                  )}
                  <Badge variant={request.scopeType === "organization" ? "info" : "default"} size="sm">
                    {request.scopeType === "organization" ? (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        {t.admin.testDeletionRequests.organization}
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3 mr-1" />
                        {t.admin.testDeletionRequests.personal}
                      </>
                    )}
                  </Badge>
                  <span className="text-foreground-secondary">
                    {t.admin.testDeletionRequests.requestedAt(new Date(request.requestedAt).toLocaleString())}
                  </span>
                </div>

                <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Approve Deletion Form */}
                  <form action={approveDeletionAction}>
                    <input type="hidden" name="requestId" value={request.requestId} />
                    <Button type="submit" variant="destructive" leftIcon={<CheckCircle className="h-4 w-4" />}>
                      {t.admin.testDeletionRequests.approveDeletion}
                    </Button>
                  </form>

                  {/* Reject Form */}
                  <form action={rejectDeletionAction} className="flex w-full max-w-xl flex-col gap-3 md:items-end">
                    <input type="hidden" name="requestId" value={request.requestId} />
                    <div className="w-full grid gap-2">
                      <label htmlFor={`reason-${request.requestId}`} className="text-sm font-medium text-foreground">
                        {t.admin.testDeletionRequests.rejectionReason}
                      </label>
                      <textarea
                        id={`reason-${request.requestId}`}
                        name="reason"
                        required
                        minLength={3}
                        rows={3}
                        className="w-full rounded-control-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        placeholder={t.admin.testDeletionRequests.rejectionPlaceholder}
                      />
                    </div>
                    <Button type="submit" variant="secondary" leftIcon={<XCircle className="h-4 w-4" />}>
                      {t.admin.testDeletionRequests.rejectWithReason}
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
