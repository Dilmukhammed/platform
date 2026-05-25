"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, Plus, Save, Send, Trash2 } from "lucide-react";

import { t } from "@/lib/translations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QuestionImageManager } from "../../QuestionImageUpload";
import { ImportFromBankModal } from "../../bank/ImportFromBankModal";

type QuestionType = "multiple_choice" | "short_answer";

interface QuestionDraft {
  questionType: QuestionType;
  prompt: string;
  explanation: string;
  answer: string;
  options: Array<{ text: string; images: string[] }>;
  correctOptionIndex: number;
  images: string[];
}

interface FormErrors {
  title?: string;
  general?: string;
  questions: Array<{
    prompt?: string;
    answer?: string;
    options?: string;
  }>;
}

interface EditTestFormProps {
  testId: string;
  initialData: {
    title: string;
    description: string | null;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: "immediate" | "after_review" | "never" | null;
    hasAttempts?: boolean;
    status: string;
    questions: Array<{
      questionId: string;
      questionType: string;
      prompt: string;
      images: string[];
      optionsJson: Record<string, unknown> | null;
      answerJson: Record<string, unknown> | null;
      explanation: string | null;
    }>;
  };
}

type ApiEnvelope<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { code: string; message: string } };

const MAX_QUESTIONS = 20;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const DEFAULT_OPTION_SLOTS = 4;

function createEmptyErrors(count: number): FormErrors["questions"] {
  return Array.from({ length: count }, () => ({}));
}

function normalizeOptions(variants: string[], optionImages?: Array<string[]>): Array<{ text: string; images: string[] }> {
  const nextOptions = variants.map((variant, i) => ({ text: variant, images: optionImages?.[i] ?? [] }));

  while (nextOptions.length < DEFAULT_OPTION_SLOTS) {
    nextOptions.push({ text: "", images: [] });
  }

  return nextOptions;
}

function buildInitialQuestions(initialData: EditTestFormProps["initialData"]): QuestionDraft[] {
  return initialData.questions.map((q) => {
    const variants = (q.optionsJson?.variants as string[] | undefined) ?? [];
    const images = (q.optionsJson?.images as Array<string | null> | undefined) ?? [];
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
      images: (q.images as string[] | undefined) ?? [],
    };
  });
}

export function EditTestForm({ testId, initialData }: EditTestFormProps) {
  const router = useRouter();
  const hasRequestedEdit = useRef(false);
  const isResultsLocked = initialData.hasAttempts ?? false;

  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description ?? "");
  const [shuffleQuestions, setShuffleQuestions] = useState(initialData.shuffleQuestions ?? false);
  const [shuffleOptions, setShuffleOptions] = useState(initialData.shuffleOptions ?? false);
  const [showResults, setShowResults] = useState<"immediate" | "after_review" | "never">(
    initialData.showResults ?? "after_review",
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => buildInitialQuestions(initialData));
  const [errors, setErrors] = useState<FormErrors>({
    questions: createEmptyErrors(initialData.questions.length),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparingEdit, setIsPreparingEdit] = useState(initialData.status === "active");
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  useEffect(() => {
    if (initialData.status !== "active" || hasRequestedEdit.current) {
      return;
    }

    hasRequestedEdit.current = true;

    const requestEdit = async () => {
      try {
        const response = await fetch(`/api/v1/teacher/tests/${testId}/request-edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const payload = (await response.json().catch(() => null)) as ApiEnvelope<{ testId: string }> | null;

        if (!response.ok || (payload && !payload.success)) {
          setErrors((currentErrors) => ({
            ...currentErrors,
            general: payload && !payload.success ? payload.error.message : "Failed to prepare test for editing.",
          }));
          return;
        }

        setErrors((currentErrors) => ({
          ...currentErrors,
          general: undefined,
        }));
      } catch {
        setErrors((currentErrors) => ({
          ...currentErrors,
          general: "Failed to prepare test for editing.",
        }));
      } finally {
        setIsPreparingEdit(false);
      }
    };

    void requestEdit();
  }, [initialData.status, testId]);

  const addQuestion = () => {
    setQuestions((currentQuestions) => {
      if (currentQuestions.length >= MAX_QUESTIONS) {
        return currentQuestions;
      }

      setErrors((currentErrors) => ({
        ...currentErrors,
        questions: [...currentErrors.questions, {}],
      }));

      return [
        ...currentQuestions,
        {
          questionType: "multiple_choice",
          prompt: "",
          explanation: "",
          answer: "",
          options: normalizeOptions([]),
          correctOptionIndex: 0,
          images: [],
        },
      ];
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions((currentQuestions) => {
      if (currentQuestions.length <= 1) {
        return currentQuestions;
      }

      setErrors((currentErrors) => ({
        ...currentErrors,
        questions: currentErrors.questions.filter((_, currentIndex) => currentIndex !== index),
      }));

      return currentQuestions.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const updateQuestion = <K extends keyof QuestionDraft>(index: number, field: K, value: QuestionDraft[K]) => {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question, currentIndex) =>
        currentIndex === index ? { ...question, [field]: value } : question,
      ),
    );
  };

  const updateOption = (questionIndex: number, optionIndex: number, text: string) => {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) return question;
        const nextOptions = [...question.options];
        nextOptions[optionIndex] = { ...question.options[optionIndex], text };
        return { ...question, options: nextOptions };
      }),
    );
  };

  const addOption = (questionIndex: number) => {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question, currentIndex) => {
        if (currentIndex !== questionIndex || question.options.length >= MAX_OPTIONS) {
          return question;
        }

        return { ...question, options: [...question.options, { text: "", images: [] }] };
      }),
    );
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question, currentIndex) => {
        if (currentIndex !== questionIndex || question.options.length <= MIN_OPTIONS) {
          return question;
        }

        const nextOptions = question.options.filter((_, index) => index !== optionIndex);
        let nextCorrectIndex = question.correctOptionIndex;

        if (optionIndex < question.correctOptionIndex) {
          nextCorrectIndex -= 1;
        } else if (optionIndex === question.correctOptionIndex) {
          nextCorrectIndex = 0;
        }

        return { ...question, options: nextOptions, correctOptionIndex: nextCorrectIndex };
      }),
    );
  };

  const validateForm = () => {
    const trimmedTitle = title.trim();
    const nextErrors: FormErrors = {
      questions: questions.map((question) => {
        const questionErrors: FormErrors["questions"][number] = {};

        if (!question.prompt.trim()) {
          questionErrors.prompt = "Prompt is required.";
        }

        if (question.questionType === "short_answer") {
          if (!question.answer.trim()) {
            questionErrors.answer = "Answer is required.";
          }
        } else {
          const filledOptions = question.options.filter((option) => option.text.trim());
          if (filledOptions.length < MIN_OPTIONS) {
            questionErrors.options = `At least ${MIN_OPTIONS} options are required.`;
          }
          if (question.correctOptionIndex >= question.options.length) {
            questionErrors.options = "Select a correct answer.";
          }
        }

        return questionErrors;
      }),
    };

    if (!trimmedTitle) {
      nextErrors.title = "Title is required.";
    }

    const hasQuestionErrors = nextErrors.questions.some(
      (questionErrors) => questionErrors.prompt || questionErrors.answer || questionErrors.options,
    );

    if (hasQuestionErrors) {
      nextErrors.general = "Complete all required fields for every question before saving.";
    }

    setErrors(nextErrors);

    return !nextErrors.title && !hasQuestionErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isPreparingEdit || !validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors((currentErrors) => ({
      ...currentErrors,
      general: undefined,
    }));

    try {
      const response = await fetch(`/api/v1/teacher/tests/${testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          shuffleQuestions,
          shuffleOptions,
          showResults,
          questions: questions.map((question, index) => {
            if (question.questionType === "multiple_choice") {
              const filledVariants: string[] = [];
              const filledOptionImages: Array<string[]> = [];
              let newCorrectIndex = -1;

              question.options.forEach((option, optionIndex) => {
                const trimmed = option.text.trim();
                if (trimmed) {
                  if (optionIndex === question.correctOptionIndex) {
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
                images: question.images.length > 0 ? question.images : undefined,
                optionsJson: { variants: filledVariants, optionImages: filledOptionImages },
                answerJson: { correctIndex: newCorrectIndex },
                explanation: question.explanation.trim() || undefined,
              };
            }

            return {
              orderIndex: index,
              questionType: "short_answer",
              prompt: question.prompt.trim(),
              answerJson: { text: question.answer.trim() },
              explanation: question.explanation.trim() || undefined,
              images: question.images.length > 0 ? question.images : undefined,
            };
          }),
        }),
      });

      const payload = (await response.json().catch(() => null)) as ApiEnvelope<{ testId: string }> | null;

      if (!response.ok || !payload?.success) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          general: payload && !payload.success ? payload.error.message : "Failed to save test changes.",
        }));
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      setIsSaved(true);
    } catch {
      setErrors((currentErrors) => ({
        ...currentErrors,
        general: "An unexpected error occurred.",
      }));
      setIsSubmitting(false);
    }
  };

  const handleSubmitToOrganization = async () => {
    setIsSubmittingApproval(true);

    try {
      const orgResponse = await fetch("/api/v1/teacher/organizations/selected");
      const orgData = (await orgResponse.json().catch(() => null)) as {
        success?: boolean;
        data?: { organizationId: string } | null;
      } | null;

      const organizationId = orgData?.data?.organizationId;

      if (!organizationId) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          general: "No organization selected. Select an organization first.",
        }));
        setIsSubmittingApproval(false);
        return;
      }

      const response = await fetch(`/api/v1/teacher/tests/${testId}/submit-to-organization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const data = (await response.json().catch(() => null)) as ApiEnvelope<{ testId: string }> | null;

      if (!response.ok || !data?.success) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          general: data && !data.success ? data.error.message : "Failed to submit test for approval.",
        }));
        setIsSubmittingApproval(false);
        return;
      }

      router.push("/teacher/tests?submitted=true");
      router.refresh();
    } catch {
      setErrors((currentErrors) => ({
        ...currentErrors,
        general: "An unexpected error occurred while submitting.",
      }));
      setIsSubmittingApproval(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
        <Link href="/teacher/tests">Back to Tests</Link>
      </Button>

      <Card elevation="sm">
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.teacher.tests.title}
          </p>
          <CardTitle className="text-h1">{t.teacher.tests.myTests.editDraft}</CardTitle>
          <CardDescription>
            Test savollarini yangilang va tasdiqlash uchun qayta yuboring.
          </CardDescription>
        </CardHeader>
      </Card>

      {isPreparingEdit ? (
        <div className="rounded-lg border border-warning-subtle bg-warning-subtle/40 px-4 py-3 text-sm text-warning">
          Tasdiqlangan test tahrirlash va qayta tasdiqlash uchun tayyorlanmoqda...
        </div>
      ) : null}

      {errors.general ? (
        <div className="rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
          {errors.general}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card elevation="sm">
          <CardHeader>
            <CardTitle>{t.teacher.tests.formLabels?.testDetails ?? "Test Details"}</CardTitle>
            <CardDescription>
              Test uchun oʻqituvchi tomonidan koʻrinadigan nom va ixtiyoriy tavsifni yangilang.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              label={t.teacher.tests.formLabels.title}
              htmlFor="test-title"
              required
              hint={t.teacher.tests.formHints.titleRequired}
              error={errors.title}
            >
              <Input
                id="test-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSubmitting || isPreparingEdit}
                state={errors.title ? "error" : "default"}
                placeholder={t.teacher.tests.formPlaceholders.title}
              />
            </FormField>

            <FormField
              label={t.teacher.tests.formLabels.description}
              htmlFor="test-description"
              hint={t.teacher.tests.formHints.descriptionOptional}
            >
              <Textarea
                id="test-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSubmitting || isPreparingEdit}
                rows={4}
                placeholder={t.teacher.tests.formPlaceholders.description}
              />
            </FormField>

            <div className="rounded-lg border border-border bg-surface-raised/50 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Tasodifiylashtirish sozlamalari</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="shuffle-questions"
                    checked={shuffleQuestions}
                    onChange={setShuffleQuestions}
                    disabled={isSubmitting || isPreparingEdit}
                  />
                  <div>
                    <label htmlFor="shuffle-questions" className="text-sm font-medium text-foreground cursor-pointer select-none">
                      Savollarni tasodifiy tartibda chiqarish
                    </label>
                    <p className="text-caption text-foreground-muted">
                      Savollar har bir talaba uchun tasodifiy tartibda chiqadi
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="shuffle-options"
                    checked={shuffleOptions}
                    onChange={setShuffleOptions}
                    disabled={isSubmitting || isPreparingEdit}
                  />
                  <div>
                    <label htmlFor="shuffle-options" className="text-sm font-medium text-foreground cursor-pointer select-none">
                      Javob variantlarini tasodifiy tartibda chiqarish
                    </label>
                    <p className="text-caption text-foreground-muted">
                      Koʻp tanlovli variantlar har bir talaba uchun tasodifiy tartibda chiqadi
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-raised/50 p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Natijalarni koʻrsatish</p>
              <FormField
                label={t.teacher.tests.formLabels.showResultsToStudents}
                htmlFor="show-results"
                hint={isResultsLocked ? t.teacher.tests.formHints.resultsLocked : undefined}
              >
                <Select
                  id="show-results"
                  value={showResults}
                  onChange={(e) => setShowResults(e.target.value as "immediate" | "after_review" | "never")}
                  disabled={isSubmitting || isPreparingEdit || isResultsLocked}
                >
                  <option value="after_review">Oʻqituvchi tekshirgandan keyin</option>
                  <option value="immediate">Topshirgandan keyin darhol</option>
                  <option value="never">Hech qachon</option>
                </Select>
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card elevation="sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Savollar</CardTitle>
                <CardDescription>
                  Quyida savollarni yangilang. Har biri uchun koʻp tanlovli yoki qisqa javob tanlang.
                </CardDescription>
              </div>
              <Badge variant="default" size="sm">
                {questions.length} / {MAX_QUESTIONS}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((question, index) => {
              const questionErrors = errors.questions[index] ?? {};

              return (
                <Card key={`question-${index}`} elevation="sm" className="border-border">
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground-secondary">
                          Savol {index + 1}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Select
                          value={question.questionType}
                          onChange={(event) => {
                            const newType = event.target.value as QuestionType;
                            updateQuestion(index, "questionType", newType);
                            if (newType === "multiple_choice") {
                              updateQuestion(index, "options", normalizeOptions([]));
                              updateQuestion(index, "correctOptionIndex", 0);
                              updateQuestion(index, "answer", "");
                            } else {
                              updateQuestion(index, "options", normalizeOptions([]));
                              updateQuestion(index, "correctOptionIndex", 0);
                            }
                          }}
                          disabled={isSubmitting || isPreparingEdit}
                          className="w-auto"
                        >
                          <option value="multiple_choice">{t.teacher.tests.questionType.multipleChoice}</option>
                          <option value="short_answer">{t.teacher.tests.questionType.shortAnswer}</option>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 className="h-4 w-4" />}
                          onClick={() => removeQuestion(index)}
                          disabled={isSubmitting || isPreparingEdit || questions.length === 1}
                        >
                          {t.teacher.tests.buttons.delete}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      label={t.teacher.tests.formLabels.prompt}
                      htmlFor={`question-${index}-prompt`}
                      required
                      error={questionErrors.prompt}
                    >
                      <Textarea
                        id={`question-${index}-prompt`}
                        value={question.prompt}
                        onChange={(event) => updateQuestion(index, "prompt", event.target.value)}
                        disabled={isSubmitting || isPreparingEdit}
                        state={questionErrors.prompt ? "error" : "default"}
                        rows={3}
                        placeholder={t.teacher.tests.formPlaceholders.prompt}
                      />
                    </FormField>

                    <QuestionImageManager
                      images={question.images}
                      onImagesChange={(paths) => updateQuestion(index, "images", paths)}
                      disabled={isSubmitting || isPreparingEdit}
                    />

                    {question.questionType === "multiple_choice" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground-secondary">Javob variantlari</p>
                          {questionErrors.options && <p className="text-xs text-error">{questionErrors.options}</p>}
                        </div>
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="space-y-1">
                            <div className="flex items-center gap-3">
                              <label className="flex shrink-0 items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${index}`}
                                  checked={question.correctOptionIndex === optionIndex}
                                  onChange={() => updateQuestion(index, "correctOptionIndex", optionIndex)}
                                  disabled={isSubmitting || isPreparingEdit}
                                  className="h-4 w-4 accent-primary"
                                />
                                <span className="text-xs font-semibold uppercase text-foreground-secondary">
                                  {String.fromCharCode(65 + optionIndex)}
                                </span>
                              </label>
                              <Input
                                value={option.text}
                                onChange={(event) => updateOption(index, optionIndex, event.target.value)}
                                disabled={isSubmitting || isPreparingEdit}
                                placeholder={`Variant ${String.fromCharCode(65 + optionIndex)}`}
                                className="flex-1"
                              />
                              <QuestionImageManager
                                images={option.images}
                                onImagesChange={(paths) => {
                                  setQuestions((currentQuestions) =>
                                    currentQuestions.map((q, qi) =>
                                      qi === index
                                        ? {
                                            ...q,
                                            options: q.options.map((o, oi) =>
                                              oi === optionIndex ? { ...o, images: paths } : o,
                                            ),
                                          }
                                        : q,
                                    ),
                                  );
                                }}
                                disabled={isSubmitting || isPreparingEdit}
                                variant="compact"
                                maxImages={1}
                              />
                              {question.options.length > MIN_OPTIONS && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOption(index, optionIndex)}
                                  disabled={isSubmitting || isPreparingEdit}
                                  className="shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {question.options.length < MAX_OPTIONS && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addOption(index)}
                            disabled={isSubmitting || isPreparingEdit}
                            leftIcon={<Plus className="h-3 w-3" />}
                          >
                            {t.teacher.tests.buttons.addOption}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <FormField
                        label={t.teacher.tests.formLabels.correctAnswer}
                        htmlFor={`question-${index}-answer`}
                        required
                        error={questionErrors.answer}
                      >
                        <Textarea
                          id={`question-${index}-answer`}
                          value={question.answer}
                          onChange={(event) => updateQuestion(index, "answer", event.target.value)}
                          disabled={isSubmitting || isPreparingEdit}
                          state={questionErrors.answer ? "error" : "default"}
                          rows={3}
                          placeholder={t.teacher.tests.formPlaceholders.correctAnswer}
                        />
                      </FormField>
                    )}

                    <FormField
                      label={t.teacher.tests.formLabels.explanation}
                      htmlFor={`question-${index}-explanation`}
                      hint={t.teacher.tests.formHints.explanationOptional}
                    >
                      <Textarea
                        id={`question-${index}-explanation`}
                        value={question.explanation}
                        onChange={(event) => updateQuestion(index, "explanation", event.target.value)}
                        disabled={isSubmitting || isPreparingEdit}
                        rows={2}
                        placeholder={t.teacher.tests.formPlaceholders.explanation}
                      />
                    </FormField>
                  </CardContent>
                </Card>
              );
            })}

            {questions.length < MAX_QUESTIONS ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addQuestion}
                  disabled={isSubmitting || isPreparingEdit}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  {t.teacher.tests.buttons.addQuestion}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsBankModalOpen(true)}
                  disabled={isSubmitting || isPreparingEdit}
                >
                  {t.teacher.tests.buttons.addFromBank}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          {isSaved ? (
            <>
<div className="flex items-start gap-3 rounded-lg border border-info-subtle bg-info-subtle/30 px-4 py-3 w-full">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Oʻzgarishlar saqlandi!</p>
                  <p className="mt-1 text-foreground-secondary">
                    Testni maktab kutubxonasida koʻrinadigan qilish uchun admin tasdigʻiga yuboring.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="primary"
                loading={isSubmittingApproval}
                onClick={handleSubmitToOrganization}
                leftIcon={!isSubmittingApproval ? <Send className="h-4 w-4" /> : undefined}
              >
                {isSubmittingApproval ? t.teacher.tests.buttons.submitting : t.teacher.tests.buttons.submitForApproval}
              </Button>
              <Button asChild variant="ghost">
                <Link href="/teacher/tests">{t.teacher.tests.buttons.cancel}</Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isPreparingEdit}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {isSubmitting ? t.teacher.tests.buttons.savingChanges : t.teacher.tests.buttons.saveChanges}
              </Button>
              <Button asChild variant="ghost" disabled={isSubmitting || isPreparingEdit}>
                <Link href="/teacher/tests">{t.teacher.tests.buttons.cancel}</Link>
              </Button>
            </>
          )}
        </div>
      </form>

        <ImportFromBankModal
          open={isBankModalOpen}
          onOpenChange={setIsBankModalOpen}
          onImport={(importedQuestions) => {
            setQuestions((current) => [...current, ...importedQuestions]);
            setErrors((current) => ({
              ...current,
              questions: [
                ...current.questions,
                ...importedQuestions.map(() => ({})),
              ],
            }));
          }}
        />
      </div>
    );
}
