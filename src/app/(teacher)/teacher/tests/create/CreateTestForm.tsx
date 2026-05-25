"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";

import { t } from "@/lib/translations";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QuestionImageManager } from "../QuestionImageUpload";
import { ImportFromBankModal } from "../bank/ImportFromBankModal";

type QuestionType = "multiple_choice" | "short_answer";

interface MultipleChoiceOption {
  text: string;
  images: string[];
}

interface QuestionDraft {
  questionType: QuestionType;
  prompt: string;
  explanation: string;
  // short_answer
  answer: string;
  // multiple_choice
  options: MultipleChoiceOption[];
  correctOptionIndex: number;
  // image
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

const MAX_QUESTIONS = 20;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

function createEmptyQuestion(): QuestionDraft {
  return {
    questionType: "multiple_choice",
    prompt: "",
    explanation: "",
    answer: "",
    options: [
      { text: "", images: [] },
      { text: "", images: [] },
      { text: "", images: [] },
      { text: "", images: [] },
    ],
    correctOptionIndex: 0,
    images: [],
  };
}

function createEmptyErrors(count: number): FormErrors["questions"] {
  return Array.from({ length: count }, () => ({}));
}

export function CreateTestForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [showResults, setShowResults] = useState<"immediate" | "after_review" | "never">("after_review");
  const [questions, setQuestions] = useState<QuestionDraft[]>([createEmptyQuestion()]);
  const [errors, setErrors] = useState<FormErrors>({ questions: createEmptyErrors(1) });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  const addQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) {
      return;
    }

    setErrors((currentErrors) => ({
      ...currentErrors,
      questions: [...currentErrors.questions, {}],
    }));

    setQuestions((currentQuestions) => [...currentQuestions, createEmptyQuestion()]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) {
      return;
    }

    setErrors((currentErrors) => ({
      ...currentErrors,
      questions: currentErrors.questions.filter((_, currentIndex) => currentIndex !== index),
    }));

    setQuestions((currentQuestions) => currentQuestions.filter((_, currentIndex) => currentIndex !== index));
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
        const newOptions = [...question.options];
        newOptions[optionIndex] = { ...question.options[optionIndex], text };
        return { ...question, options: newOptions };
      }),
    );
  };

  const addOption = (questionIndex: number) => {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) return question;
        if (question.options.length >= MAX_OPTIONS) return question;
        return { ...question, options: [...question.options, { text: "", images: [] }] };
      }),
    );
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question, currentIndex) => {
        if (currentIndex !== questionIndex) return question;
        if (question.options.length <= MIN_OPTIONS) return question;
        const newOptions = question.options.filter((_, i) => i !== optionIndex);
        // Adjust correctOptionIndex if needed
        let newCorrectIndex = question.correctOptionIndex;
        if (optionIndex < question.correctOptionIndex) {
          newCorrectIndex--;
        } else if (optionIndex === question.correctOptionIndex) {
          newCorrectIndex = 0;
        }
        return { ...question, options: newOptions, correctOptionIndex: newCorrectIndex };
      }),
    );
  };

  const validateForm = () => {
    const trimmedTitle = title.trim();
    const nextErrors: FormErrors = {
      questions: questions.map((question) => {
        const qErrors: FormErrors["questions"][number] = {};

        if (!question.prompt.trim()) {
          qErrors.prompt = "Prompt is required.";
        }

        if (question.questionType === "short_answer") {
          if (!question.answer.trim()) {
            qErrors.answer = "Answer is required.";
          }
        } else {
          // multiple_choice: at least 2 options filled, correct index valid
          const filledOptions = question.options.filter((o) => o.text.trim());
          if (filledOptions.length < MIN_OPTIONS) {
            qErrors.options = `At least ${MIN_OPTIONS} options are required.`;
          }
          if (question.correctOptionIndex >= question.options.length) {
            qErrors.options = "Select a correct answer.";
          }
        }

        return qErrors;
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

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors((currentErrors) => ({
      ...currentErrors,
      general: undefined,
    }));

    try {
      const response = await fetch("/api/v1/teacher/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          shuffleQuestions,
          shuffleOptions,
          showResults,
          scopeType: "personal",
          origin: "manual",
          questions: questions.map((question, index) => {
            if (question.questionType === "multiple_choice") {
              // Filter out empty options and recalculate correctIndex
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
              // Fallback: first filled option is correct if original was empty
              if (newCorrectIndex === -1 && filledVariants.length > 0) {
                newCorrectIndex = 0;
              }

              return {
                orderIndex: index,
                questionType: "multiple_choice",
                prompt: question.prompt.trim(),
                images: question.images.length > 0 ? question.images : undefined,
                optionsJson: {
                  variants: filledVariants,
                  optionImages: filledOptionImages,
                },
                answerJson: { correctIndex: newCorrectIndex },
                explanation: question.explanation.trim() || undefined,
              };
            }
            // short_answer
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

      const payload = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: {
              message?: string;
            };
          }
        | null;

      if (!response.ok || !payload?.success) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          general: payload?.error?.message ?? "Failed to create test.",
        }));
        setIsSubmitting(false);
        return;
      }

      router.push("/teacher/tests");
      router.refresh();
    } catch {
      setErrors((currentErrors) => ({
        ...currentErrors,
        general: "An unexpected error occurred.",
      }));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
        <Link href="/teacher/tests">{t.teacher.tests.buttons.backToTests}</Link>
      </Button>

      <Card elevation="sm">
        <CardHeader>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
            {t.teacher.tests.title}
          </p>
          <CardTitle className="text-h1">{t.teacher.tests.actions?.createManual ?? "Qoʻlda test yaratish"}</CardTitle>
          <CardDescription>
            Koʻp tanlovli yoki qisqa javob savollari bilan test yarating. {MAX_QUESTIONS} ta gacha savol.
          </CardDescription>
        </CardHeader>
      </Card>

      {errors.general ? (
        <div className="rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
          {errors.general}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card elevation="sm">
          <CardHeader>
            <CardTitle>Test tafsilotlari</CardTitle>
            <CardDescription>
              Test uchun oʻqituvchi tomonidan koʻrinadigan nom va ixtiyoriy tavsifni qoʻshing.
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
              <FormField label={t.teacher.tests.formLabels.showResultsToStudents} htmlFor="show-results">
                <Select
                  id="show-results"
                  value={showResults}
                  onChange={(e) => setShowResults(e.target.value as "immediate" | "after_review" | "never")}
                  disabled={isSubmitting}
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
                  Quyida savollarni qoʻshing. Har biri uchun koʻp tanlovli yoki qisqa javob tanlang.
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
                          onChange={(e) => {
                            const newType = e.target.value as QuestionType;
                            updateQuestion(index, "questionType", newType);
                            if (newType === "multiple_choice") {
                              updateQuestion(index, "options", [
                                { text: "", images: [] },
                                { text: "", images: [] },
                                { text: "", images: [] },
                                { text: "", images: [] },
                              ]);
                              updateQuestion(index, "correctOptionIndex", 0);
                            }
                          }}
                          disabled={isSubmitting}
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
                          disabled={isSubmitting || questions.length === 1}
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
                        disabled={isSubmitting}
                        state={questionErrors.prompt ? "error" : "default"}
                        rows={3}
                        placeholder={t.teacher.tests.formPlaceholders.prompt}
                      />
                    </FormField>

                    <QuestionImageManager
                      images={question.images}
                      onImagesChange={(paths) => updateQuestion(index, "images", paths)}
                      disabled={isSubmitting}
                    />

                    {/* Multiple Choice Options */}
                    {question.questionType === "multiple_choice" ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground-secondary">
                            Javob variantlari
                          </p>
                          {questionErrors.options && (
                            <p className="text-xs text-error">{questionErrors.options}</p>
                          )}
                        </div>
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="space-y-1">
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 shrink-0">
                                <input
                                  type="radio"
                                  name={`correct-${index}`}
                                  checked={question.correctOptionIndex === optionIndex}
                                  onChange={() => updateQuestion(index, "correctOptionIndex", optionIndex)}
                                  disabled={isSubmitting}
                                  className="h-4 w-4 accent-primary"
                                />
                                <span className="text-xs font-semibold uppercase text-foreground-secondary">
                                  {String.fromCharCode(65 + optionIndex)}
                                </span>
                              </label>
                              <Input
                                value={option.text}
                                onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                                disabled={isSubmitting}
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
                                disabled={isSubmitting}
                                variant="compact"
                                maxImages={1}
                              />
                              {question.options.length > MIN_OPTIONS && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOption(index, optionIndex)}
                                  disabled={isSubmitting}
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
                        htmlFor={`question-${index}-answer`}
                        required
                        error={questionErrors.answer}
                      >
                        <Textarea
                          id={`question-${index}-answer`}
                          value={question.answer}
                          onChange={(event) => updateQuestion(index, "answer", event.target.value)}
                          disabled={isSubmitting}
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
                        disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  {t.teacher.tests.buttons.addQuestion}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsBankModalOpen(true)}
                  disabled={isSubmitting}
                >
                  {t.teacher.tests.buttons.addFromBank}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            leftIcon={<Save className="h-4 w-4" />}
          >
            {isSubmitting ? t.teacher.tests.buttons.creatingTest : t.teacher.tests.buttons.createTest}
          </Button>
          <Button asChild variant="ghost" disabled={isSubmitting}>
            <Link href="/teacher/tests">{t.teacher.tests.buttons.cancel}</Link>
          </Button>
        </div>
      </form>

      <ImportFromBankModal
        open={isBankModalOpen}
        onOpenChange={setIsBankModalOpen}
        onImport={(importedQuestions) => {
          setQuestions((current) => [...current, ...importedQuestions]);
          setErrors((currentErrors) => ({
            ...currentErrors,
            questions: [
              ...currentErrors.questions,
              ...importedQuestions.map(() => ({})),
            ],
          }));
        }}
      />
    </div>
  );
}
