import Image from "next/image";
import { CheckCircle, XCircle, FileQuestion, ClipboardList, Sparkles, User } from "lucide-react";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { requireAreaAccess } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { t } from "@/lib/translations";
import {
  approveAdminTestApproval,
  rejectAdminTestApproval,
} from "@/modules/admins/actions";

async function approveSchoolTestAction(formData: FormData) {
  "use server";
  const approvalId = formData.get("approvalId") as string;
  if (!approvalId) throw new Error("Approval ID required");
  try {
    await approveAdminTestApproval(approvalId);
    revalidatePath("/admin/test-approvals");
    redirect("/admin/test-approvals?approved=true");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const errorMessage = error instanceof Error ? error.message : "Failed to approve test";
    redirect(`/admin/test-approvals?error=${encodeURIComponent(errorMessage)}`);
  }
}

async function rejectSchoolTestAction(formData: FormData) {
  "use server";
  const approvalId = formData.get("approvalId") as string;
  const reason = formData.get("reason") as string;
  if (!approvalId) throw new Error("Approval ID required");
  try {
    await rejectAdminTestApproval(approvalId, reason);
    revalidatePath("/admin/test-approvals");
    redirect("/admin/test-approvals?rejected=true");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const errorMessage = error instanceof Error ? error.message : "Failed to reject test";
    redirect(`/admin/test-approvals?error=${encodeURIComponent(errorMessage)}`);
  }
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listAdminPendingTestApprovals } from "@/modules/admins/server-data";

interface TestQuestion {
  questionId: string;
  questionType: string;
  prompt: string;
  images: string[];
  optionsJson: Record<string, unknown> | null;
  answerJson: Record<string, unknown> | null;
  explanation: string | null;
}

interface PendingTestApproval {
  approvalId: string;
  testId: string;
  title: string;
  description: string | null;
  scopeType: string;
  origin: string;
  ownerTeacherId: string;
  ownerOrganizationId: string | null;
  testStatus: string;
  decision: string;
  questions: TestQuestion[];
  isReapproval: boolean;
  previousQuestions: TestQuestion[] | null;
  requestedBy: {
    userId: string;
    email: string;
    displayName: string;
  } | null;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

type QuestionWithDiff = TestQuestion & {
  diffType: "new" | "modified" | "deleted" | "unchanged";
  previousQuestion?: TestQuestion | null;
};

function computeQuestionDiff(current: TestQuestion[], previous: TestQuestion[]): QuestionWithDiff[] {
  const prevPrompts = new Map(previous.map((q) => [q.prompt, q]));
  const currentPrompts = new Set(current.map((q) => q.prompt));

  const result: QuestionWithDiff[] = current.map((q) => {
    const prev = prevPrompts.get(q.prompt);
    if (!prev) return { ...q, diffType: "new" as const, previousQuestion: null };
    const isModified =
      JSON.stringify(q.images) !== JSON.stringify(prev.images) ||
      JSON.stringify(q.optionsJson) !== JSON.stringify(prev.optionsJson) ||
      JSON.stringify(q.answerJson) !== JSON.stringify(prev.answerJson) ||
      q.explanation !== prev.explanation;
    return {
      ...q,
      diffType: isModified ? ("modified" as const) : ("unchanged" as const),
      previousQuestion: isModified ? prev : null,
    };
  });

  const deleted: QuestionWithDiff[] = previous
    .filter((q) => !currentPrompts.has(q.prompt))
    .map((q) => ({ ...q, diffType: "deleted" as const, previousQuestion: null }));

  return [...result, ...deleted];
}

export default async function AdminTestApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAreaAccess("admin");

  const approvals: PendingTestApproval[] = await listAdminPendingTestApprovals();
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const message = typeof params.approved === "string"
    ? t.admin.testApprovals.approvedMessage
    : typeof params.rejected === "string"
      ? t.admin.testApprovals.rejectedMessage
      : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Page Header */}
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.admin.testApprovals.heading}
          </p>
          <CardTitle className="text-h1">{t.admin.testApprovals.title}</CardTitle>
          <CardDescription>
            {t.admin.testApprovals.description}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card elevation="sm" className="bg-primary-subtle/30 border-primary-subtle">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-secondary">{t.admin.testApprovals.pendingTests}</p>
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
              icon={<ClipboardList className="h-6 w-6" />}
              title={t.admin.testApprovals.noPendingSubmissions}
              description={t.admin.testApprovals.allReviewed}
            />
          </Card>
        ) : (
          approvals.map((approval) => (
            <Card key={approval.testId} elevation="sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-semibold text-foreground">
                        {approval.title}
                      </h2>
                      <StatusChip status="warning" size="sm">
                        {t.admin.testApprovals.pendingReview}
                      </StatusChip>
                    </div>
                    <p className="mt-1 text-sm text-foreground-secondary">
                      {approval.requestedBy?.displayName ?? t.admin.testApprovals.unknown} · {approval.requestedBy?.email ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-surface p-3">
                  <p className="text-sm text-foreground-secondary">
                    {approval.description ?? t.admin.testApprovals.noDescriptionProvided}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-foreground-secondary">
                  <Badge variant="info" size="sm">
                    <FileQuestion className="h-3 w-3 mr-1" />
                    {t.admin.testApprovals.questionsCount(approval.questions.length)}
                  </Badge>
                  <Badge variant={approval.origin === "ai_draft" ? "info" : "default"} size="sm">
                    {approval.origin === "ai_draft" ? t.admin.testApprovals.aiDraft : approval.origin === "manual" ? t.admin.testApprovals.manual : approval.origin}
                  </Badge>
                  <Badge variant={approval.scopeType === "organization" ? "info" : "default"} size="sm">
                    {approval.scopeType === "organization" ? (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        {t.admin.testApprovals.organization}
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3 mr-1" />
                        {t.admin.testApprovals.personal}
                      </>
                    )}
                  </Badge>
                  <span className="text-foreground-secondary">
                    {t.admin.testApprovals.submittedAt(new Date(approval.requestedAt).toLocaleString())}
                  </span>
                </div>

                {/* Re-approval banner */}
                {approval.isReapproval && (
                  <div className="mt-3 rounded-md border border-warning-subtle bg-warning-subtle/30 px-3 py-2 text-sm text-warning">
                    {t.admin.testApprovals.resubmissionBanner}
                  </div>
                )}

                {/* Test Questions */}
                {approval.questions.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                      {t.admin.testApprovals.testContent}
                    </h3>
                    {(approval.isReapproval && approval.previousQuestions
                      ? computeQuestionDiff(approval.questions, approval.previousQuestions)
                      : approval.questions.map((q) => ({ ...q, diffType: "unchanged" as const, previousQuestion: null as TestQuestion | null }))
                    ).map((question, qIdx) => {
                      const isMultipleChoice = question.questionType === "multiple_choice";
                      const variants = (question.optionsJson?.variants as string[] | undefined) ?? [];
                      const correctIndex = (question.answerJson?.correctIndex as number | undefined) ?? -1;
                      const containerClassName =
                        question.diffType === "new"
                          ? "rounded-lg border border-border bg-surface p-3 border-l-4 border-l-success"
                          : question.diffType === "modified"
                            ? "rounded-lg border border-border bg-surface p-3 border-l-4 border-l-warning"
                            : question.diffType === "deleted"
                              ? "rounded-lg border border-border bg-surface p-3 border-l-4 border-l-error opacity-60"
                              : "rounded-lg border border-border bg-surface p-3";
                      const deletedTextClassName = question.diffType === "deleted" ? "line-through" : "";

                      return (
                        <div key={`${question.questionId}-${question.diffType}-${qIdx}`} className={containerClassName}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className={`text-sm font-medium text-foreground ${deletedTextClassName}`}>
                              <span className="text-foreground-secondary mr-2">{t.admin.testApprovals.questionNumber(qIdx + 1)}</span>
                              {question.prompt}
                            </p>
                            {question.diffType === "new" && <Badge variant="success" size="sm">{t.admin.testApprovals.new}</Badge>}
                            {question.diffType === "modified" && <Badge variant="warning" size="sm">{t.admin.testApprovals.modified}</Badge>}
                            {question.diffType === "deleted" && <Badge variant="error" size="sm">{t.admin.testApprovals.deleted}</Badge>}
                          </div>
                          {question.images.length > 0 && (
                            <div className="mt-2 pl-6 flex flex-wrap gap-2">
                              {question.images.map((imgPath, imgIdx) => (
                                <Image
                                  key={imgIdx}
                                  src={`/api/v1/uploads/signed-url?path=${encodeURIComponent(imgPath)}`}
                                  alt={t.admin.testApprovals.questionImage(imgIdx + 1)}
                                  width={240}
                                  height={180}
                                  unoptimized
                                  className="max-h-48 max-w-[240px] rounded-md border border-border object-contain"
                                />
                              ))}
                            </div>
                          )}
                          {isMultipleChoice && variants.length > 0 ? (
                            <div className="mt-2 space-y-1">
                              {variants.map((variant, vIdx) => (
                                <p
                                  key={vIdx}
                                  className={`pl-6 text-sm ${question.diffType === "deleted" ? "line-through text-foreground-secondary" : vIdx === correctIndex ? "font-semibold text-success" : "text-foreground-secondary"}`}
                                >
                                  {String.fromCharCode(65 + vIdx)}) {variant}
                                  {question.diffType !== "deleted" && vIdx === correctIndex && " ✓"}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className={`mt-1 pl-6 text-sm ${question.diffType === "deleted" ? "line-through text-foreground-secondary" : "text-foreground-secondary"}`}>
                              <strong className="text-foreground">{t.admin.testApprovals.answer}</strong>{" "}
                              {(question.answerJson?.text as string) ?? "—"}
                            </p>
                          )}
                          {question.explanation && (
                            <p className={`mt-1 pl-6 text-xs ${question.diffType === "deleted" ? "line-through text-foreground-secondary" : "text-foreground-secondary"}`}>
                              {t.admin.testApprovals.explanation}: {question.explanation}
                            </p>
                          )}
                          {question.diffType === "modified" && question.previousQuestion && (
                            <div className="mt-2 pl-6 text-xs text-foreground-secondary">
                              <p className="line-through">{question.previousQuestion.prompt}</p>
                              {question.previousQuestion.images.length > 0 && JSON.stringify(question.previousQuestion.images) !== JSON.stringify(question.images) && (
                                <div className="mt-2">
                                  <p className="text-xs text-foreground-secondary line-through">{t.admin.testApprovals.previousImages}</p>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {question.previousQuestion.images.map((imgPath, imgIdx) => (
                                      <Image
                                        key={imgIdx}
                                        src={`/api/v1/uploads/signed-url?path=${encodeURIComponent(imgPath)}`}
                                        alt={t.admin.testApprovals.previousImage(imgIdx + 1)}
                                        width={200}
                                        height={150}
                                        unoptimized
                                        className="max-h-32 max-w-[200px] rounded-md border border-border object-contain opacity-50 line-through-container"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              {question.previousQuestion.questionType === "multiple_choice" && (() => {
                                const prevVariants = (question.previousQuestion.optionsJson?.variants as string[] | undefined) ?? [];
                                return prevVariants.map((v, i) => (
                                  <p key={i} className="line-through">{String.fromCharCode(65 + i)}) {v}</p>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Approve Form */}
                  <form action={approveSchoolTestAction}>
                    <input type="hidden" name="approvalId" value={approval.approvalId} />
                    <Button type="submit" variant="primary" leftIcon={<CheckCircle className="h-4 w-4" />}>
                      {t.admin.testApprovals.approveTest}
                    </Button>
                  </form>

                  {/* Reject Form */}
                  <form action={rejectSchoolTestAction} className="flex w-full max-w-xl flex-col gap-3 md:items-end">
                    <input type="hidden" name="approvalId" value={approval.approvalId} />
                    <div className="w-full grid gap-2">
                      <label htmlFor={`reason-${approval.approvalId}`} className="text-sm font-medium text-foreground">
                        {t.admin.testApprovals.rejectionReason}
                      </label>
                      <textarea
                        id={`reason-${approval.approvalId}`}
                        name="reason"
                        required
                        minLength={3}
                        rows={3}
                        className="w-full rounded-control-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        placeholder={t.admin.testApprovals.rejectionPlaceholder}
                      />
                    </div>
                    <Button type="submit" variant="destructive" leftIcon={<XCircle className="h-4 w-4" />}>
                      {t.admin.testApprovals.rejectWithReason}
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
