"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import { t } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ApiEnvelope<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { code: string; message: string } };

type GenerateDraftResponse = {
  testId: string;
  title: string;
  providerLabel: string;
  questionCount: number;
};

export function CreateAiDraftForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [questionType, setQuestionType] = useState<"short_answer" | "multiple_choice">("short_answer");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();
    const parsedQuestionCount = Number(questionCount);

    if (trimmedPrompt.length < 8) {
      setErrorMessage(t.teacher.tests.aiDraft.minPromptLength);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/v1/teacher/test-drafts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          questionCount: parsedQuestionCount,
          questionType,
          difficulty,
        }),
      });

      const data = (await response.json().catch(() => null)) as ApiEnvelope<GenerateDraftResponse> | null;

      if (!response.ok || !data?.success) {
        setErrorMessage(data?.error?.message ?? t.common.tryAgain);
        setIsSubmitting(false);
        return;
      }

      router.push(`/teacher/tests/ai-draft?draftId=${data.data.testId}&created=true`);
      router.refresh();
    } catch {
      setErrorMessage(t.common.tryAgain);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage ? (
        <div className="rounded-lg border border-error-subtle bg-error-subtle/50 px-4 py-3 text-sm text-error">
          {errorMessage}
        </div>
      ) : null}

      <FormField
        label={t.teacher.tests.aiDraft.promptLabel}
        hint={t.teacher.tests.aiDraft.promptHint}
        required
      >
        <Textarea
          name="prompt"
          required
          minLength={8}
          rows={5}
          placeholder={t.teacher.tests.aiDraft.promptPlaceholder}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isSubmitting}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label={t.teacher.tests.aiDraft.questionCountLabel} required>
          <Select
            name="questionCount"
            value={questionCount}
            onChange={(event) => setQuestionCount(event.target.value)}
            disabled={isSubmitting}
          >
            <option value="3">{t.teacher.tests.aiDraft.questionCount(3)}</option>
            <option value="5">{t.teacher.tests.aiDraft.questionCount(5)}</option>
            <option value="10">{t.teacher.tests.aiDraft.questionCount(10)}</option>
            <option value="15">{t.teacher.tests.aiDraft.questionCount(15)}</option>
            <option value="20">{t.teacher.tests.aiDraft.questionCount(20)}</option>
          </Select>
        </FormField>

        <FormField label={t.teacher.tests.aiDraft.questionTypeLabel} required>
          <Select
            name="questionType"
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value as "short_answer" | "multiple_choice")}
            disabled={isSubmitting}
          >
            <option value="short_answer">{t.teacher.tests.aiDraft.shortAnswer}</option>
            <option value="multiple_choice">{t.teacher.tests.aiDraft.multipleChoice}</option>
          </Select>
        </FormField>

        <FormField label={t.teacher.tests.aiDraft.difficultyLabel} required>
          <Select
            name="difficulty"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as "beginner" | "intermediate" | "advanced")}
            disabled={isSubmitting}
          >
            <option value="beginner">{t.teacher.tests.aiDraft.beginner}</option>
            <option value="intermediate">{t.teacher.tests.aiDraft.intermediate}</option>
            <option value="advanced">{t.teacher.tests.aiDraft.advanced}</option>
          </Select>
        </FormField>
      </div>

      <Button type="submit" variant="primary" className="w-full" loading={isSubmitting}>
        {!isSubmitting ? <Sparkles className="h-4 w-4" /> : null}
        {isSubmitting ? t.common.sending : t.teacher.tests.actions.createAiDraft}
      </Button>
    </form>
  );
}
