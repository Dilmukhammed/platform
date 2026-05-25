"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Save, Send } from "lucide-react";

import { t } from "@/lib/translations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Textarea } from "@/components/ui/textarea";
import { QuestionImageManager } from "../QuestionImageUpload";
import {
  canEditDraft,
  getDraftStatusConfig,
  getGenerationPrompt,
  getQuestionAnswerText,
  type TeacherTestDetail,
  type TeacherTestQuestion,
} from "./types";

type ApiEnvelope<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { code: string; message: string } };

type EditableOption = {
  text: string;
  images: string[];
};

type EditableQuestionState = {
  questionId: string;
  questionType: string;
  prompt: string;
  answer: string;
  explanation: string;
  images: string[];
  // multiple_choice
  options: EditableOption[];
  correctOptionIndex: number;
};

function getQuestionOptions(question: TeacherTestQuestion): EditableOption[] {
  const variants = question.optionsJson?.variants;
  const optionImages = question.optionsJson?.optionImages as Array<string[]> | undefined;
  if (Array.isArray(variants)) {
    return variants.map((v: unknown, i: number) => ({
      text: typeof v === "string" ? v : String(v),
      images: optionImages?.[i] ?? [],
    }));
  }
  return [];
}

function getCorrectOptionIndex(question: TeacherTestQuestion): number {
  const idx = question.answerJson?.correctIndex;
  return typeof idx === "number" ? idx : 0;
}

function buildQuestionState(draft: TeacherTestDetail): EditableQuestionState[] {
  return draft.questions.map((question) => ({
    questionId: question.questionId,
    questionType: question.questionType,
    prompt: question.prompt,
    answer: getQuestionAnswerText(question.answerJson),
    explanation: question.explanation ?? "",
    images: question.images ?? [],
    options: getQuestionOptions(question),
    correctOptionIndex: getCorrectOptionIndex(question),
  }));
}

function formatAnswerDisplay(question: TeacherTestQuestion): string {
  if (question.questionType === "multiple_choice") {
    const variants = getQuestionOptions(question);
    const correctIdx = getCorrectOptionIndex(question);
    const correctVariant = variants[correctIdx]?.text ?? "—";
    const letter = String.fromCharCode(65 + correctIdx);
    return `${letter}) ${correctVariant}`;
  }
  return getQuestionAnswerText(question.answerJson);
}

export function DraftEditor({
  draft,
  organizationId,
}: {
  draft: TeacherTestDetail;
  organizationId: string | null;
}) {
  const router = useRouter();
  const statusConfig = getDraftStatusConfig(draft);
  const editable = canEditDraft(draft);
  const generationPrompt = getGenerationPrompt(draft);

  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description ?? "");
  const [questions, setQuestions] = useState<EditableQuestionState[]>(() => buildQuestionState(draft));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle(draft.title);
    setDescription(draft.description ?? "");
    setQuestions(buildQuestionState(draft));
    setSaveError(null);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSaving(false);
    setIsSubmitting(false);
  }, [draft]);

  const normalizedInitialQuestions = useMemo(
    () => JSON.stringify(buildQuestionState(draft)),
    [draft],
  );

  const isUnchanged =
    title.trim() === draft.title.trim() &&
    description.trim() === (draft.description ?? "").trim() &&
    JSON.stringify(questions) === normalizedInitialQuestions;

  const updateQuestion = <K extends keyof EditableQuestionState>(
    index: number,
    field: K,
    value: EditableQuestionState[K],
  ) => {
    setQuestions((current) =>
      current.map((question, currentIndex) =>
        currentIndex === index ? { ...question, [field]: value } : question,
      ),
    );
  };

  const updateOption = (questionIndex: number, optionIndex: number, text: string) => {
    setQuestions((current) =>
      current.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) return question;
        const newOptions = [...question.options];
        newOptions[optionIndex] = { ...question.options[optionIndex], text };
        return { ...question, options: newOptions };
      }),
    );
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSaving(true);
    setSaveError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/v1/teacher/tests/${draft.testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          questions: questions.map((question, index) => {
            if (question.questionType === "multiple_choice") {
              // Filter out empty options and recalculate correctIndex
              const filledVariants: string[] = [];
              const filledOptionImages: Array<string[]> = [];
              let newCorrectIndex = -1;
              question.options.forEach((option, optIdx) => {
                const trimmed = option.text.trim();
                if (trimmed) {
                  if (optIdx === question.correctOptionIndex) {
                    newCorrectIndex = filledVariants.length;
                  }
                  filledVariants.push(trimmed);
                  filledOptionImages.push(option.images);
                }
              });
              if (newCorrectIndex === -1 && filledVariants.length > 0) {
                newCorrectIndex = 0;
              }

              return {
                orderIndex: index,
                questionType: "multiple_choice",
                prompt: question.prompt.trim(),
                images: question.images,
                optionsJson: { variants: filledVariants, optionImages: filledOptionImages },
                answerJson: { correctIndex: newCorrectIndex },
                explanation: question.explanation.trim() || undefined,
              };
            }
            return {
              orderIndex: index,
              questionType: "short_answer",
              prompt: question.prompt.trim(),
              images: question.images,
              answerJson: { text: question.answer.trim() },
              explanation: question.explanation.trim() || undefined,
            };
          }),
        }),
      });

      const data = (await response.json().catch(() => null)) as ApiEnvelope<{ testId: string }> | null;

      if (!response.ok || !data?.success) {
        setSaveError(data?.error?.message ?? t.common.tryAgain);
        setIsSaving(false);
        return;
      }

      router.push(`/teacher/tests/ai-draft?draftId=${draft.testId}&saved=true`);
      router.refresh();
    } catch {
      setSaveError(t.common.tryAgain);
      setIsSaving(false);
    }
  };

  const handleSubmitToOrganization = async () => {
    if (!organizationId) {
      setSubmitError(t.teacher.tests.myTests.awaitingAdminApproval);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/v1/teacher/tests/${draft.testId}/submit-to-organization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const data = (await response.json().catch(() => null)) as ApiEnvelope<{ message: string }> | null;

      if (!response.ok || !data?.success) {
        setSubmitError(data?.error?.message ?? t.common.tryAgain);
        setIsSubmitting(false);
        return;
      }

      router.push("/teacher/tests?submitted=true");
      router.refresh();
    } catch {
      setSubmitError(t.common.tryAgain);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
            {t.teacher.tests.source.aiDraft}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">{draft.title}</h2>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={draft.origin === "ai_draft" ? "info" : "default"} size="sm">
              {draft.origin === "ai_draft" ? t.teacher.tests.source.aiDraft : t.teacher.tests.source.manual}
            </Badge>
            <span className="text-sm text-foreground-secondary">{t.teacher.tests.myTests.questionCount("", draft.questionCount)}</span>
          </div>
        </div>
        <StatusChip status={statusConfig.status} label={statusConfig.label} />
      </div>

      {generationPrompt ? (
        <div className="rounded-lg border border-info-subtle bg-info-subtle/30 px-4 py-3 text-sm">
          <strong className="text-info">{t.teacher.tests.schoolVisible.addedBy("")}:</strong>{" "}
          <span className="text-foreground-secondary">{generationPrompt}</span>
        </div>
      ) : null}

      {draft.lastDecision?.decision === "rejected" && draft.lastDecision.decisionReason ? (
        <div className="rounded-lg border border-error-subtle bg-error-subtle/30 px-4 py-3 text-sm text-error">
          <strong>{t.teacher.materials.detail.reviewAndFileAccess.rejectionReason}:</strong> {draft.lastDecision.decisionReason}
        </div>
      ) : null}

      {editable ? (
        <div className="space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {successMessage ? (
              <div className="rounded-lg border border-success-subtle bg-success-subtle/50 px-4 py-3 text-sm text-success">
                {successMessage}
              </div>
            ) : null}
            {saveError ? (
              <div className="rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
                {saveError}
              </div>
            ) : null}

            <FormField label={t.teacher.tests.detail.created("")} required>
              <Input
                name="title"
                required
                minLength={3}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSaving || isSubmitting}
              />
            </FormField>

            <FormField label={t.teacher.tests.aiDraft.descriptionLabel} hint={t.teacher.tests.aiDraft.noDescription}>
              <Textarea
                name="description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSaving || isSubmitting}
              />
            </FormField>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                {t.teacher.tests.aiDraft.questions}
              </h3>
              {questions.map((question, index) => (
                <Card key={question.questionId} elevation="sm" className="border-border">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                        {t.teacher.tests.aiDraft.label(index + 1)}
                        <Badge variant={question.questionType === "multiple_choice" ? "info" : "default"} size="sm" className="ml-2">
                          {question.questionType === "multiple_choice" ? t.teacher.tests.aiDraft.questions : t.teacher.tests.aiDraft.practice}
                        </Badge>
                      </p>
                    </div>

                    <FormField label={t.teacher.tests.aiDraft.textPlaceholder} required htmlFor={`question-prompt-${index}`}>
                      <Textarea
                        name={`questionPrompt_${index}`}
                        required
                        minLength={8}
                        rows={3}
                        value={question.prompt}
                        onChange={(event) => updateQuestion(index, "prompt", event.target.value)}
                        disabled={isSaving || isSubmitting}
                      />
                    </FormField>

                    <QuestionImageManager
                      images={question.images}
                      onImagesChange={(paths) => updateQuestion(index, "images", paths)}
                      disabled={isSaving || isSubmitting}
                    />

                    {question.questionType === "multiple_choice" ? (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-foreground-secondary">{t.teacher.tests.aiDraft.option(1)}</p>
                        {question.options.map((option, optionIdx) => (
                          <div key={optionIdx} className="flex items-center gap-3">
                            <label className="flex items-center gap-2 shrink-0">
                              <input
                                type="radio"
                                name={`correct-${index}`}
                                checked={question.correctOptionIndex === optionIdx}
                                onChange={() => updateQuestion(index, "correctOptionIndex", optionIdx)}
                                disabled={isSaving || isSubmitting}
                                className="h-4 w-4 accent-primary"
                              />
                              <span className="text-xs font-semibold uppercase text-foreground-secondary">
                                {String.fromCharCode(65 + optionIdx)}
                              </span>
                            </label>
                            <Input
                              value={option.text}
                              onChange={(e) => updateOption(index, optionIdx, e.target.value)}
                              disabled={isSaving || isSubmitting}
                              placeholder={`${t.teacher.tests.aiDraft.option(String.fromCharCode(65 + optionIdx))}`}
                              className="flex-1"
                            />
                            <QuestionImageManager
                              images={option.images}
                              onImagesChange={(paths) => {
                                setQuestions((current) =>
                                  current.map((q, qi) =>
                                    qi === index
                                      ? {
                                          ...q,
                                          options: q.options.map((o, oi) =>
                                            oi === optionIdx ? { ...o, images: paths } : o,
                                          ),
                                        }
                                      : q,
                                  ),
                                );
                              }}
                              disabled={isSaving || isSubmitting}
                              variant="compact"
                              maxImages={1}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <FormField label={t.teacher.tests.aiDraft.resultsCorrect} required htmlFor={`question-answer-${index}`}>
                        <Textarea
                          name={`questionAnswer_${index}`}
                          required
                          minLength={3}
                          rows={2}
                          value={question.answer}
                          onChange={(event) => updateQuestion(index, "answer", event.target.value)}
                          disabled={isSaving || isSubmitting}
                        />
                      </FormField>
                    )}

                    <FormField
                      label={t.components.review.explanation}
                      hint={t.teacher.tests.aiDraft.drawingInfo}
                      htmlFor={`question-explanation-${index}`}
                    >
                      <Textarea
                        name={`questionExplanation_${index}`}
                        rows={2}
                        value={question.explanation}
                        onChange={(event) => updateQuestion(index, "explanation", event.target.value)}
                        disabled={isSaving || isSubmitting}
                      />
                    </FormField>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="secondary" loading={isSaving} disabled={isUnchanged || isSubmitting}>
                {!isSaving ? <Save className="h-4 w-4" /> : null}
                {isSaving ? t.common.sending : t.teacher.tests.alerts.edited}
              </Button>
            </div>
          </form>

          <div className="border-t border-border pt-6">
            {submitError ? (
              <div className="mb-4 rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
                {submitError}
              </div>
            ) : null}
            <div className="flex items-start gap-3 rounded-lg border border-info-subtle bg-info-subtle/30 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{t.teacher.tests.alerts.submitted.split(".")[0]}?</p>
                <p className="mt-1 text-foreground-secondary">
                  {t.teacher.tests.alerts.submitted}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              className="mt-4"
              onClick={handleSubmitToOrganization}
              loading={isSubmitting}
              disabled={isSaving || !organizationId}
            >
              {!isSubmitting ? <Send className="h-4 w-4" /> : null}
              {isSubmitting ? t.common.sending : t.teacher.tests.actions.aiWorkspace}
            </Button>
          </div>
        </div>
      ) : (
        <ReadOnlyDraftView draft={draft} />
      )}
    </div>
  );
}

function ReadOnlyDraftView({ draft }: { draft: TeacherTestDetail }) {
  const statusMessage =
    draft.pendingApproval?.decision === "pending"
      ? t.teacher.tests.myTests.awaitingAdminApproval
      : draft.lastDecision?.decision === "approved" || draft.status === "active"
        ? t.teacher.tests.myTests.visibleInSchoolScope
        : t.teacher.tests.myTests.hiddenFromSchoolScope;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-foreground-secondary">
        {statusMessage}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
          {t.teacher.tests.aiDraft.questions}
        </h3>
        {draft.questions.map((question, index) => (
          <Card key={question.questionId} elevation="sm" className="border-border">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                {t.teacher.tests.aiDraft.label(index + 1)}
                <Badge variant={question.questionType === "multiple_choice" ? "info" : "default"} size="sm" className="ml-2">
                  {question.questionType === "multiple_choice" ? t.teacher.tests.aiDraft.questions : t.teacher.tests.aiDraft.practice}
                </Badge>
              </p>
              <p className="text-sm font-medium text-foreground">{question.prompt}</p>
              {question.images && question.images.length > 0 && (
                <div className="mt-2 pl-6 flex flex-wrap gap-2">
                  {question.images.map((imgPath: string, imgIdx: number) => (
                    <img
                      key={imgIdx}
                      src={`/api/v1/uploads/signed-url?path=${encodeURIComponent(imgPath)}`}
                      alt={`${t.teacher.tests.aiDraft.label(index + 1)} image ${imgIdx + 1}`}
                      className="max-h-48 max-w-[240px] rounded-md border border-border object-contain"
                    />
                  ))}
                </div>
              )}
              {question.questionType === "multiple_choice" ? (
                <div className="space-y-1">
                  {getQuestionOptions(question).map((option, vIdx) => (
                    <div key={vIdx}>
                      <p
                        className={`text-sm ${vIdx === getCorrectOptionIndex(question) ? "font-semibold text-success" : "text-foreground-secondary"}`}
                      >
                        {String.fromCharCode(65 + vIdx)}) {option.text}
                        {vIdx === getCorrectOptionIndex(question) && " ✓"}
                      </p>
                      {option.images.length > 0 && (
                        <div className="ml-6 flex flex-wrap gap-1">
                          {option.images.map((imgPath: string, imgIdx: number) => (
                            <img
                              key={imgIdx}
                              src={`/api/v1/uploads/signed-url?path=${encodeURIComponent(imgPath)}`}
                              alt={`${t.teacher.tests.aiDraft.option(String.fromCharCode(65 + vIdx))} image`}
                              className="max-h-24 max-w-[120px] rounded border border-border object-contain"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground-secondary">
                  <strong className="text-foreground">{t.teacher.tests.aiDraft.resultsCorrect}:</strong> {getQuestionAnswerText(question.answerJson)}
                </p>
              )}
              {question.explanation ? (
                <p className="text-sm text-foreground-secondary">{question.explanation}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
