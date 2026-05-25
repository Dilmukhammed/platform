import Link from "next/link";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";

import { t } from "@/lib/translations";
import { apiGet } from "@/lib/api/server-fetch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusAlert } from "@/components/ui/status-alert";
import { CreateAiDraftForm } from "./CreateAiDraftForm";
import { DraftEditor } from "./DraftEditor";
import {
  type SelectedOrganization,
  type TeacherTestDetail,
  type TeacherTestSummary,
  getDraftStatusConfig,
} from "./types";

export default async function TeacherAiDraftTestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [selectedOrganization, testsResponse] = await Promise.all([
    apiGet<SelectedOrganization | null>("/api/v1/teacher/organizations/selected"),
    apiGet<{ data: TeacherTestSummary[] }>("/api/v1/teacher/tests", {
      paginated: true,
      params: { origin: "ai_draft", scopeType: "personal" },
    }),
  ]);

  const drafts = testsResponse.data;
  const params = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const draftId = typeof params.draftId === "string" ? params.draftId : drafts[0]?.testId;

  let selectedDraft: TeacherTestDetail | null = null;
  if (draftId) {
    try {
      selectedDraft = await apiGet<TeacherTestDetail>(`/api/v1/teacher/tests/${draftId}`);
    } catch {
      selectedDraft = null;
    }
  }

  const message =
    typeof params.created === "string"
      ? "Deterministic AI draft created as a personal teacher draft. Review and edit before any submission."
      : typeof params.saved === "string"
        ? "Draft saved. School visibility still requires submission and admin approval."
        : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="space-y-6">
      <Card elevation="sm">
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.teacher.tests.actions.aiWorkspace}
          </p>
          <CardTitle className="text-h1">{t.teacher.tests.libraryTitle}</CardTitle>
          <CardDescription>
            {t.teacher.tests.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            <Link href="/teacher/tests">{t.teacher.layout.nav.tests}</Link>
          </Button>
        </CardContent>
      </Card>

      {message ? <StatusAlert tone="success">{message}</StatusAlert> : null}
      {error ? <StatusAlert tone="error">{error}</StatusAlert> : null}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.2fr]">
        <Card elevation="sm">
          <CardHeader>
            <CardTitle>{t.teacher.tests.actions.createAiDraft}</CardTitle>
            <CardDescription>
              {t.teacher.tests.myTests.emptyDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CreateAiDraftForm />

            <div className="border-t border-border pt-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                {t.teacher.tests.myTests.title}
              </h3>
              {drafts.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  title={t.teacher.tests.myTests.emptyTitle}
                  description={t.teacher.tests.myTests.emptyDescription}
                />
              ) : (
                <div className="space-y-2">
                  {drafts.map((draft: TeacherTestSummary) => (
                    <DraftRecordLink
                      key={draft.testId}
                      draft={draft}
                      isSelected={selectedDraft?.testId === draft.testId}
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardContent className="p-6">
            {selectedDraft ? (
              <DraftEditor
                draft={selectedDraft}
                organizationId={selectedOrganization?.organizationId ?? null}
              />
            ) : (
              <EmptyState
                icon={<Sparkles className="h-6 w-6" />}
                title={t.teacher.tests.myTests.emptyTitle}
                description={t.teacher.tests.myTests.emptyDescription}
                action={
                  <Button asChild variant="primary">
                    <Link href="/teacher/tests/ai-draft">
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t.teacher.tests.actions.createAiDraft}
                    </Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DraftRecordLink({
  draft,
  isSelected,
}: {
  draft: Pick<TeacherTestSummary, "testId" | "title" | "questionCount"> & {
    status: TeacherTestSummary["status"];
    pendingApproval: TeacherTestSummary["pendingApproval"];
    lastDecision?: TeacherTestSummary["lastDecision"];
  };
  isSelected: boolean;
}) {
  const config = getDraftStatusConfig(draft);

  return (
    <Link
      href={`/teacher/tests/ai-draft?draftId=${draft.testId}`}
      className={`block rounded-lg border p-3 text-sm transition-colors ${
        isSelected
          ? "border-primary bg-primary-subtle"
          : "border-border bg-surface-raised hover:bg-surface-muted"
      }`}
    >
      <div className="truncate font-medium text-foreground">{draft.title}</div>
      <div className="mt-1 flex items-center gap-2 text-foreground-secondary">
        <StatusChip status={config.status} label={config.label} size="sm" />
        <span>· {t.teacher.tests.myTests.questionCount("", draft.questionCount)}</span>
      </div>
    </Link>
  );
}
