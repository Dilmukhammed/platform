"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { t } from "@/lib/translations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { QuestionImageManager } from "../QuestionImageUpload";

type QuestionType = "multiple_choice" | "short_answer";
type ScopeType = "personal" | "organization";

interface MultipleChoiceOption {
  text: string;
  images: string[];
}

interface QuestionDraft {
  questionType: QuestionType;
  prompt: string;
  explanation: string;
  answer: string;
  options: MultipleChoiceOption[];
  correctOptionIndex: number;
  images: string[];
  scopeType: ScopeType;
}

interface BankQuestionData {
  questionId: string;
  questionType: string;
  prompt: string;
  optionsJson: Record<string, unknown> | null;
  answerJson: Record<string, unknown>;
  explanation: string | null;
  images: string[];
  scopeType: ScopeType;
  createdAt: string;
  updatedAt: string;
}

interface SelectedOrganization {
  organizationId: string;
  organizationName: string;
}

interface FormErrors {
  general?: string;
  prompt?: string;
  answer?: string;
  options?: string;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const DEFAULT_OPTION_SLOTS = 4;

function createEmptyDraft(): QuestionDraft {
  return {
    questionType: "multiple_choice",
    prompt: "",
    explanation: "",
    answer: "",
    options: Array.from({ length: DEFAULT_OPTION_SLOTS }, () => ({ text: "", images: [] })),
    correctOptionIndex: 0,
    images: [],
    scopeType: "personal",
  };
}

function normalizeOptions(variants: string[], optionImages?: Array<string[]>): MultipleChoiceOption[] {
  const result = variants.map((v, i) => ({ text: v, images: optionImages?.[i] ?? [] }));
  while (result.length < DEFAULT_OPTION_SLOTS) {
    result.push({ text: "", images: [] });
  }
  return result;
}

function buildDraftFromQuestion(q: BankQuestionData): QuestionDraft {
  const variants = (q.optionsJson?.variants as string[] | undefined) ?? [];
  const optionImages = (q.optionsJson?.optionImages as Array<string[]> | undefined) ?? [];
  const correctIndex = (q.answerJson?.correctIndex as number | undefined) ?? 0;
  const answerText = (q.answerJson?.text as string | undefined) ?? "";

  return {
    questionType: q.questionType === "short_answer" ? "short_answer" : "multiple_choice",
    prompt: q.prompt,
    explanation: q.explanation ?? "",
    answer: answerText,
    options: normalizeOptions(variants, optionImages),
    correctOptionIndex: correctIndex,
    images: q.images ?? [],
    scopeType: q.scopeType,
  };
}

interface BankQuestionFormProps {
  initialQuestions: BankQuestionData[];
  selectedOrganization: SelectedOrganization | null;
}

export function BankQuestionForm({ initialQuestions, selectedOrganization }: BankQuestionFormProps) {
  const router = useRouter();

  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestionDraft>(createEmptyDraft());
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteInForm, setConfirmDeleteInForm] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  // ── Mode transitions ──────────────────────────────────────────────

  const handleStartCreate = () => {
    setDraft(createEmptyDraft());
    setErrors({});
    setEditingQuestionId(null);
    setMode("create");
    setConfirmDeleteInForm(false);
  };

  const handleStartEdit = (question: BankQuestionData) => {
    setDraft(buildDraftFromQuestion(question));
    setErrors({});
    setEditingQuestionId(question.questionId);
    setMode("edit");
    setDeleteConfirmId(null);
    setConfirmDeleteInForm(false);
  };

  const handleCancel = () => {
    setMode("list");
    setDraft(createEmptyDraft());
    setErrors({});
    setEditingQuestionId(null);
    setConfirmDeleteInForm(false);
  };

  // ── Draft helpers ─────────────────────────────────────────────────

  const updateDraft = <K extends keyof QuestionDraft>(field: K, value: QuestionDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateOption = (optionIndex: number, text: string) => {
    setDraft((prev) => {
      const next = [...prev.options];
      next[optionIndex] = { ...prev.options[optionIndex], text };
      return { ...prev, options: next };
    });
  };

  const addOption = () => {
    setDraft((prev) => {
      if (prev.options.length >= MAX_OPTIONS) return prev;
      return { ...prev, options: [...prev.options, { text: "", images: [] }] };
    });
  };

  const removeOption = (optionIndex: number) => {
    setDraft((prev) => {
      if (prev.options.length <= MIN_OPTIONS) return prev;
      const next = prev.options.filter((_, i) => i !== optionIndex);
      let nextCorrect = prev.correctOptionIndex;
      if (optionIndex < prev.correctOptionIndex) {
        nextCorrect -= 1;
      } else if (optionIndex === prev.correctOptionIndex) {
        nextCorrect = 0;
      }
      return { ...prev, options: next, correctOptionIndex: nextCorrect };
    });
  };

  // ── Validation ────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const next: FormErrors = {};

    if (!draft.prompt.trim()) {
      next.prompt = "Prompt is required.";
    }

    if (draft.questionType === "short_answer") {
      if (!draft.answer.trim()) {
        next.answer = "Answer is required.";
      }
    } else {
      const filled = draft.options.filter((o) => o.text.trim());
      if (filled.length < MIN_OPTIONS) {
        next.options = `At least ${MIN_OPTIONS} options are required.`;
      }
      if (draft.correctOptionIndex >= draft.options.length) {
        next.options = "Select a correct answer.";
      }
    }

    setErrors(next);
    return !next.prompt && !next.answer && !next.options;
  };

  // ── Payload builder ───────────────────────────────────────────────

  const buildPayload = () => {
    if (draft.questionType === "multiple_choice") {
      const filledVariants: string[] = [];
      const filledOptionImages: Array<string[]> = [];
      let newCorrectIndex = -1;

      draft.options.forEach((option, optionIndex) => {
        const trimmed = option.text.trim();
        if (trimmed) {
          if (optionIndex === draft.correctOptionIndex) {
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
        questionType: "multiple_choice" as const,
        prompt: draft.prompt.trim(),
        images: draft.images.length > 0 ? draft.images : undefined,
        optionsJson: { variants: filledVariants, optionImages: filledOptionImages },
        answerJson: { correctIndex: newCorrectIndex },
        explanation: draft.explanation.trim() || undefined,
        scopeType: draft.scopeType,
        organizationId: draft.scopeType === "organization" ? selectedOrganization?.organizationId : undefined,
      };
    }

    return {
      questionType: "short_answer" as const,
      prompt: draft.prompt.trim(),
      answerJson: { text: draft.answer.trim() },
      explanation: draft.explanation.trim() || undefined,
      images: draft.images.length > 0 ? draft.images : undefined,
      scopeType: draft.scopeType,
      organizationId: draft.scopeType === "organization" ? selectedOrganization?.organizationId : undefined,
    };
  };

  // ── Mutations ────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors((prev) => ({ ...prev, general: undefined }));

    try {
      const response = await fetch("/api/v1/teacher/question-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.success) {
        setErrors((prev) => ({
          ...prev,
          general: payload?.error?.message ?? "Failed to create question.",
        }));
        setIsSubmitting(false);
        return;
      }

      setMode("list");
      router.refresh();
    } catch {
      setErrors((prev) => ({ ...prev, general: "An unexpected error occurred." }));
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!validateForm() || !editingQuestionId) return;

    setIsSubmitting(true);
    setErrors((prev) => ({ ...prev, general: undefined }));

    try {
      const response = await fetch(`/api/v1/teacher/question-bank/${editingQuestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.success) {
        setErrors((prev) => ({
          ...prev,
          general: payload?.error?.message ?? "Failed to update question.",
        }));
        setIsSubmitting(false);
        return;
      }

      setMode("list");
      setEditingQuestionId(null);
      router.refresh();
    } catch {
      setErrors((prev) => ({ ...prev, general: "An unexpected error occurred." }));
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/v1/teacher/question-bank/${questionId}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: { message?: string };
      } | null;

      if (!response.ok || !payload?.success) {
        setErrors((prev) => ({
          ...prev,
          general: payload?.error?.message ?? "Failed to delete question.",
        }));
        setIsDeleting(false);
        setDeleteConfirmId(null);
        setConfirmDeleteInForm(false);
        return;
      }

      setDeleteConfirmId(null);
      setConfirmDeleteInForm(false);

      if (mode === "edit" && editingQuestionId === questionId) {
        setMode("list");
        setEditingQuestionId(null);
      }

      router.refresh();
    } catch {
      setErrors((prev) => ({ ...prev, general: "An unexpected error occurred." }));
      setIsDeleting(false);
      setDeleteConfirmId(null);
      setConfirmDeleteInForm(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (mode === "create") {
      handleCreate();
    } else {
      handleUpdate();
    }
  };

  // ── List mode ────────────────────────────────────────────────────

  if (mode === "list") {
    return (
      <>
        <Card elevation="sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
                  {t.teacher.tests.title}
                </p>
                <CardTitle className="text-h1">{t.teacher.tests.bank.title}</CardTitle>
                <CardDescription>
                  {t.teacher.tests.bank.description}
                </CardDescription>
              </div>
              <Button
                variant="primary"
                onClick={handleStartCreate}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                {t.teacher.tests.buttons.createQuestion}
              </Button>
            </div>
          </CardHeader>
          {selectedOrganization && (
            <CardContent>
              <Badge variant="default" size="md">
                Active organization:{" "}
                <span className="ml-1 text-foreground">
                  {selectedOrganization.organizationName}
                </span>
              </Badge>
            </CardContent>
          )}
        </Card>

        {errors.general && (
          <div className="rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
            {errors.general}
          </div>
        )}

        {initialQuestions.length === 0 ? (
          <Card elevation="sm">
            <CardContent>
              <EmptyState
                icon={<Plus className="h-6 w-6" />}
                title={t.teacher.tests.bank.emptyTitle}
                description={t.teacher.tests.bank.emptyDescription}
                action={
                  <Button
                    variant="primary"
                    onClick={handleStartCreate}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    {t.teacher.tests.bank.createFirst}
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {initialQuestions.map((question) => {
              const isExpanded = expandedIds.has(question.questionId);
              const variants = (question.optionsJson?.variants as string[] | undefined) ?? [];
              const optionImages = (question.optionsJson?.optionImages as Record<string, string[]> | undefined) ?? {};
              const correctIndex = (question.answerJson?.correctIndex as number | undefined) ?? -1;
              const answerText = (question.answerJson?.text as string | undefined) ?? "";

              return (
                <Card key={question.questionId} elevation="sm" className={`border-border ${isExpanded ? "border-primary/40" : ""}`}>
                  <CardContent className="p-4">
                    {/* Header row — always visible */}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => toggleExpand(question.questionId)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={question.questionType === "multiple_choice" ? "default" : "info"}
                            size="sm"
                          >
                            {question.questionType === "multiple_choice"
                              ? t.teacher.tests.questionType.multipleChoice
                              : t.teacher.tests.questionType.shortAnswer}
                          </Badge>
                          <Badge
                            variant={question.scopeType === "organization" ? "success" : "default"}
                            size="sm"
                          >
                            {question.scopeType === "organization" ? t.teacher.tests.scope.organization : t.teacher.tests.scope.personal}
                          </Badge>
                          {question.images.length > 0 && (
                            <Badge variant="default" size="sm">
                              {t.teacher.tests.bank.images(question.images.length)}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-foreground">
                          {question.prompt}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-surface-secondary"
                          onClick={() => toggleExpand(question.questionId)}
                        >
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-foreground-secondary" />
                            : <ChevronDown className="h-4 w-4 text-foreground-secondary" />
                          }
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Pencil className="h-4 w-4" />}
                          onClick={() => handleStartEdit(question)}
                        >
                          {t.teacher.tests.buttons.editQuestion}
                        </Button>
                        {deleteConfirmId === question.questionId ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              loading={isDeleting}
                              onClick={() => handleDelete(question.questionId)}
                            >
                              {t.teacher.tests.buttons.confirm ?? " Tasdiqlash"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={isDeleting}
                            >
                              {t.teacher.tests.buttons.cancel}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 className="h-4 w-4" />}
                            onClick={() => setDeleteConfirmId(question.questionId)}
                          >
                            {t.teacher.tests.buttons.delete}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        {/* Question images */}
                        {question.images.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {question.images.map((path, i) => (
                              <img
                                key={i}
                                src={`/api/v1/uploads/signed-url?path=${encodeURIComponent(path)}`}
                                alt={`Question image ${i + 1}`}
                                className="h-20 max-w-[200px] rounded-md border border-border object-contain"
                              />
                            ))}
                          </div>
                        )}

                        {/* Multiple choice options */}
                        {question.questionType === "multiple_choice" && variants.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1.5">
                              {t.teacher.tests.bank.options}
                            </p>
                            <div className="space-y-1.5">
                              {variants.map((variant, i) => {
                                const isCorrect = i === correctIndex;
                                const imgs = optionImages[String(i)] ?? [];
                                return (
                                  <div
                                    key={i}
                                    className={`flex items-center gap-2 text-sm p-2 rounded ${
                                      isCorrect
                                        ? "bg-success-subtle/30 border border-success/30"
                                        : "bg-surface-secondary/50"
                                    }`}
                                  >
                                    <span className="font-semibold text-foreground-secondary shrink-0">
                                      {String.fromCharCode(65 + i)}:
                                    </span>
                                    <span className={isCorrect ? "font-medium text-foreground" : "text-foreground-secondary"}>
                                      {variant}
                                    </span>
                                    {isCorrect && (
                                      <Check className="h-3.5 w-3.5 text-success ml-auto shrink-0" />
                                    )}
                                    {imgs.length > 0 && (
                                      <div className="flex gap-1 ml-auto">
                                        {imgs.slice(0, 2).map((imgPath, j) => (
                                          <img
                                            key={j}
                                            src={`/api/v1/uploads/signed-url?path=${encodeURIComponent(imgPath)}`}
                                            alt={`Option image ${j + 1}`}
                                            className="h-6 w-6 rounded border border-border object-cover"
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Short answer */}
                        {question.questionType === "short_answer" && answerText && (
                          <div>
                            <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1.5">
                              {t.teacher.tests.bank.correctAnswer}
                            </p>
                            <p className="text-sm text-foreground bg-success-subtle/30 border border-success/30 rounded p-2">
                              {answerText}
                            </p>
                          </div>
                        )}

                        {/* Explanation */}
                        {question.explanation && (
                          <div>
                            <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1.5">
                              {t.teacher.tests.formLabels.explanation}
                            </p>
                            <p className="text-sm text-foreground-secondary italic">
                              {question.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // ── Create / Edit mode ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Card elevation="sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
                {t.teacher.tests.bank.title}
              </p>
              <CardTitle className="text-h1">
                {mode === "create" ? t.teacher.tests.buttons.createQuestion : t.teacher.tests.buttons.editQuestion}
              </CardTitle>
              <CardDescription>
                {mode === "create"
                  ? t.teacher.tests.bank.description
                  : "Savolni yangilang."}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              leftIcon={<X className="h-4 w-4" />}
            >
              {t.teacher.tests.buttons.cancel}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {errors.general && (
        <div className="rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card elevation="sm">
          <CardHeader>
            <CardTitle>Savol tafsilotlari</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <FormField label={t.teacher.tests.formLabels.questionType} htmlFor="question-type" required>
                <Select
                  id="question-type"
                  value={draft.questionType}
                  onChange={(e) => {
                    const newType = e.target.value as QuestionType;
                    updateDraft("questionType", newType);
                    if (newType === "multiple_choice") {
                      updateDraft("options", normalizeOptions([]));
                      updateDraft("correctOptionIndex", 0);
                      updateDraft("answer", "");
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-auto"
                >
                  <option value="multiple_choice">{t.teacher.tests.questionType.multipleChoice}</option>
                  <option value="short_answer">{t.teacher.tests.questionType.shortAnswer}</option>
                </Select>
              </FormField>

              <FormField label={t.teacher.tests.formLabels.scope} htmlFor="question-scope" required>
                <Select
                  id="question-scope"
                  value={draft.scopeType}
                  onChange={(e) => updateDraft("scopeType", e.target.value as ScopeType)}
                  disabled={isSubmitting}
                  className="w-auto"
                >
                  <option value="personal">{t.teacher.tests.scope.personal}</option>
                  <option value="organization" disabled={!selectedOrganization}>
                    {t.teacher.tests.scope.organization}{!selectedOrganization ? " (tashkilot tanlanmagan)" : ""}
                  </option>
                </Select>
              </FormField>
            </div>

            <FormField
              label={t.teacher.tests.formLabels.prompt}
              htmlFor="question-prompt"
              required
              error={errors.prompt}
            >
              <Textarea
                id="question-prompt"
                value={draft.prompt}
                onChange={(e) => updateDraft("prompt", e.target.value)}
                disabled={isSubmitting}
                state={errors.prompt ? "error" : "default"}
                rows={3}
                placeholder={t.teacher.tests.formPlaceholders.prompt}
              />
            </FormField>

            <QuestionImageManager
              images={draft.images}
              onImagesChange={(paths) => updateDraft("images", paths)}
              disabled={isSubmitting}
            />

            {/* Multiple Choice Options */}
            {draft.questionType === "multiple_choice" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground-secondary">Javob variantlari</p>
                  {errors.options && (
                    <p className="text-xs text-error">{errors.options}</p>
                  )}
                </div>
                {draft.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <label className="flex shrink-0 items-center gap-2">
                        <input
                          type="radio"
                          name="correct-option"
                          checked={draft.correctOptionIndex === optionIndex}
                          onChange={() => updateDraft("correctOptionIndex", optionIndex)}
                          disabled={isSubmitting}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="text-xs font-semibold uppercase text-foreground-secondary">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                      </label>
                      <Input
                        value={option.text}
                        onChange={(e) => updateOption(optionIndex, e.target.value)}
                        disabled={isSubmitting}
                        placeholder={`Variant ${String.fromCharCode(65 + optionIndex)}`}
                        className="flex-1"
                      />
                      <QuestionImageManager
                        images={option.images}
                        onImagesChange={(paths) => {
                          setDraft((prev) => ({
                            ...prev,
                            options: prev.options.map((o, oi) =>
                              oi === optionIndex ? { ...o, images: paths } : o,
                            ),
                          }));
                        }}
                        disabled={isSubmitting}
                        variant="compact"
                        maxImages={1}
                      />
                      {draft.options.length > MIN_OPTIONS && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(optionIndex)}
                          disabled={isSubmitting}
                          className="shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {draft.options.length < MAX_OPTIONS && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addOption}
                    disabled={isSubmitting}
                    leftIcon={<Plus className="h-3 w-3" />}
                  >
                    {t.teacher.tests.buttons.addOption}
                  </Button>
                )}
              </div>
            ) : (
              /* Short Answer */
              <FormField
                label={t.teacher.tests.formLabels.correctAnswer}
                htmlFor="question-answer"
                required
                error={errors.answer}
              >
                <Textarea
                  id="question-answer"
                  value={draft.answer}
                  onChange={(e) => updateDraft("answer", e.target.value)}
                  disabled={isSubmitting}
                  state={errors.answer ? "error" : "default"}
                  rows={3}
                  placeholder={t.teacher.tests.formPlaceholders.correctAnswer}
                />
              </FormField>
            )}

            <FormField
              label={t.teacher.tests.formLabels.explanation}
              htmlFor="question-explanation"
              hint={t.teacher.tests.formHints.explanationOptional}
            >
              <Textarea
                id="question-explanation"
                value={draft.explanation}
                onChange={(e) => updateDraft("explanation", e.target.value)}
                disabled={isSubmitting}
                rows={2}
                placeholder={t.teacher.tests.formPlaceholders.explanation}
              />
            </FormField>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            leftIcon={<Save className="h-4 w-4" />}
          >
            {isSubmitting
              ? mode === "create"
                ? t.teacher.tests.buttons.creating
                : t.teacher.tests.buttons.saving
              : mode === "create"
                ? t.teacher.tests.buttons.createQuestion
                : t.teacher.tests.buttons.saveChanges}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {t.teacher.tests.buttons.cancel}
          </Button>

          {/* Delete button in edit mode */}
          {mode === "edit" && editingQuestionId && (
            <>
              {confirmDeleteInForm ? (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-error">Bu savolni oʻchirish?</span>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={isDeleting}
                    onClick={() => handleDelete(editingQuestionId)}
                  >
                    Ha, oʻchirish
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDeleteInForm(false)}
                    disabled={isDeleting}
                  >
                    Yoʻq, saqlash
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setConfirmDeleteInForm(true)}
                  disabled={isSubmitting}
                  className="ml-auto text-error hover:text-error"
                >
                  {t.teacher.tests.buttons.delete}
                </Button>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  );
}
