"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Check, X, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { t } from "@/lib/translations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestionData {
  questionId: string;
  orderIndex: number;
  questionType: string;
  prompt: string;
  optionsJson: Record<string, unknown> | null;
  studentAnswer: string | null;
  correctAnswer: Record<string, unknown>;
  explanation: string | null;
  currentScore: number | null;
  isCorrect: boolean | null;
  autoScored: boolean;
}

interface TestQuestionReviewProps {
  attemptId: string;
  initialData: {
    testId: string;
    testTitle: string;
    showResults: string;
    studentInfo: { studentProfileId: string; studentName: string };
    questions: Array<QuestionData>;
    scoreRaw: number | null;
    submittedAt: string;
    reviewCompletedAt: string | null;
  };
  onComplete?: () => void;
}

// Local state for a question that may have its score updated
interface QuestionState extends QuestionData {
  localScore: number | null;
  isScoring: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve MC student answer like "option-1" to display text */
function resolveMcAnswer(
  studentAnswer: string | null,
  optionsJson: Record<string, unknown> | null
): string {
  if (!studentAnswer) return t.components.review.noAnswer;
  const variants: string[] = Array.isArray(optionsJson?.variants)
    ? (optionsJson!.variants as string[])
    : [];
  // Student answer is "option-N" (1-based)
  const match = studentAnswer.match(/^option-(\d+)$/);
  if (match) {
    const idx = parseInt(match[1], 10) - 1;
    if (idx >= 0 && idx < variants.length) {
      return `${String.fromCharCode(65 + idx)}: ${variants[idx]}`;
    }
  }
  return studentAnswer;
}

/** Resolve MC correct answer from correctIndex */
function resolveMcCorrectAnswer(
  correctAnswer: Record<string, unknown>,
  optionsJson: Record<string, unknown> | null
): string {
  const correctIndex = correctAnswer.correctIndex as number | undefined;
  const variants: string[] = Array.isArray(optionsJson?.variants)
    ? (optionsJson!.variants as string[])
    : [];
  if (correctIndex !== undefined && correctIndex >= 0 && correctIndex < variants.length) {
    return `${String.fromCharCode(65 + correctIndex)}: ${variants[correctIndex]}`;
  }
  return (correctAnswer.text as string) ?? t.components.review.correctAnswer;
}

/** Get reference answer text for text questions */
function resolveTextReferenceAnswer(correctAnswer: Record<string, unknown>): string {
  return (correctAnswer.text as string) ?? t.components.review.referenceAnswer;
}

// ---------------------------------------------------------------------------
// MC Question Card (Read-Only)
// ---------------------------------------------------------------------------

function McQuestionCard({ question }: { question: QuestionState }) {
  const studentDisplay = resolveMcAnswer(question.studentAnswer, question.optionsJson);
  const correctDisplay = resolveMcCorrectAnswer(question.correctAnswer, question.optionsJson);
  const isCorrect = question.isCorrect;

  return (
    <Card elevation="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-body font-semibold">
            Q{question.orderIndex + 1}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="info" size="sm">{t.components.review.text}</Badge>
            <Badge
              variant={isCorrect ? "success" : "error"}
              size="sm"
            >
              {isCorrect ? (
                <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> {t.components.review.autoScored}</span>
              ) : (
                <span className="inline-flex items-center gap-1"><X className="h-3 w-3" /> {t.components.review.autoScored}</span>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Prompt */}
        <p className="text-body text-foreground whitespace-pre-wrap">{question.prompt}</p>

        {/* Student answer */}
        <div className="rounded-control-md border border-border bg-surface p-default">
          <p className="text-caption font-medium uppercase tracking-wide text-foreground-secondary mb-1">
            {t.components.review.studentAnswer}
          </p>
          <p className={`text-body-sm ${isCorrect ? "text-success" : "text-error"}`}>
            {studentDisplay}
          </p>
        </div>

        {/* Correct answer */}
        <div className="rounded-control-md border border-success/30 bg-success-subtle/30 p-default">
          <p className="text-caption font-medium uppercase tracking-wide text-foreground-secondary mb-1">
            {t.components.review.correctAnswer}
          </p>
          <p className="text-body-sm text-foreground">{correctDisplay}</p>
        </div>

        {/* Explanation */}
        {question.explanation && (
          <div className="rounded-control-md border border-border bg-surface-muted p-default">
            <p className="text-caption font-medium uppercase tracking-wide text-foreground-secondary mb-1">
              {t.components.review.explanation}
            </p>
            <p className="text-body-sm text-foreground-secondary italic">{question.explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Text Question Card (Scorable)
// ---------------------------------------------------------------------------

interface TextQuestionCardProps {
  question: QuestionState;
  onScore: (questionId: string, score: 0 | 1) => Promise<void>;
}

function TextQuestionCard({ question, onScore }: TextQuestionCardProps) {
  const referenceAnswer = resolveTextReferenceAnswer(question.correctAnswer);
  const currentScore = question.localScore;

  const handleScore = async (score: 0 | 1) => {
    await onScore(question.questionId, score);
  };

  return (
    <Card elevation="sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-body font-semibold">
            Q{question.orderIndex + 1}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" size="sm">Text</Badge>
            {currentScore !== null && (
              <Badge
                variant={currentScore === 1 ? "success" : "error"}
                size="sm"
              >
                {currentScore === 1 ? "1 / 1" : "0 / 1"}
              </Badge>
            )}
            {currentScore === null && (
              <Badge variant="warning" size="sm">{t.components.review.pending}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Prompt */}
        <p className="text-body text-foreground whitespace-pre-wrap">{question.prompt}</p>

        {/* Student answer */}
        <div className="rounded-control-md border border-border bg-surface p-default">
          <p className="text-caption font-medium uppercase tracking-wide text-foreground-secondary mb-1">
            {t.components.review.studentAnswer}
          </p>
          <p className="text-body-sm text-foreground whitespace-pre-wrap">
            {question.studentAnswer ?? t.components.review.noAnswerProvided}
          </p>
        </div>

        {/* Reference answer */}
        <div className="rounded-control-md border border-info/30 bg-info-subtle/30 p-default">
          <p className="text-caption font-medium uppercase tracking-wide text-foreground-secondary mb-1">
            {t.components.review.referenceAnswer}
          </p>
          <p className="text-body-sm text-foreground whitespace-pre-wrap">{referenceAnswer}</p>
        </div>

        {/* Explanation */}
        {question.explanation && (
          <div className="rounded-control-md border border-border bg-surface-muted p-default">
            <p className="text-caption font-medium uppercase tracking-wide text-foreground-secondary mb-1">
              {t.components.review.explanation}
            </p>
            <p className="text-body-sm text-foreground-secondary italic">{question.explanation}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2 border-t border-border pt-4">
        <Button
          variant={currentScore === 1 ? "primary" : "secondary"}
          size="sm"
          loading={question.isScoring && currentScore !== 1}
          disabled={question.isScoring || currentScore === 1}
          onClick={() => handleScore(1)}
          aria-label={t.components.review.markQuestionCorrect.replace("{number}", String(question.orderIndex + 1))}
        >
          <Check className="h-3.5 w-3.5" />
          {t.components.review.correctScore}
        </Button>
        <Button
          variant={currentScore === 0 ? "destructive" : "secondary"}
          size="sm"
          loading={question.isScoring && currentScore !== 0}
          disabled={question.isScoring || currentScore === 0}
          onClick={() => handleScore(0)}
          aria-label={t.components.review.markQuestionIncorrect.replace("{number}", String(question.orderIndex + 1))}
        >
          <X className="h-3.5 w-3.5" />
          {t.components.review.incorrectScore}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Expandable Question Card Wrapper
// ---------------------------------------------------------------------------

interface ExpandableQuestionProps {
  question: QuestionState;
  onScore: (questionId: string, score: 0 | 1) => Promise<void>;
}

function ExpandableQuestionCard({ question, onScore }: ExpandableQuestionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div
      className={`rounded-card border transition-colors ${
        question.autoScored
          ? "border-border"
          : question.localScore !== null
            ? "border-success/40"
            : "border-warning/40"
      }`}
    >
      {/* Collapsible header */}
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-muted/50 transition-colors rounded-card"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-label={t.components.review.toggleQuestionDetails.replace("{number}", String(question.orderIndex + 1))}
      >
        <span className="text-body font-semibold text-foreground shrink-0">
          Q{question.orderIndex + 1}
        </span>
        <span className="text-body-sm text-foreground-secondary truncate flex-1">
          {question.prompt}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={question.questionType === "multiple_choice" ? "info" : "default"}
            size="sm"
          >
            {question.questionType === "multiple_choice" ? "MC" : t.components.review.text}
          </Badge>
          {question.autoScored ? (
            <Badge variant={question.isCorrect ? "success" : "error"} size="sm">
              {question.isCorrect ? "✅" : "❌"}
            </Badge>
          ) : question.localScore !== null ? (
            <Badge variant={question.localScore === 1 ? "success" : "error"} size="sm">
              {question.localScore === 1 ? "1/1" : "0/1"}
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">{t.components.review.pending}</Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-foreground-secondary shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-foreground-secondary shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border px-3 pb-3">
          {question.questionType === "multiple_choice" ? (
            <McQuestionCard question={question} />
          ) : (
            <TextQuestionCard question={question} onScore={onScore} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TestQuestionReview({
  attemptId,
  initialData,
  onComplete,
}: TestQuestionReviewProps) {
  const router = useRouter();
  // Initialize local question state from initialData
  const [questions, setQuestions] = useState<QuestionState[]>(
    initialData.questions.map((q) => ({
      ...q,
      localScore: q.currentScore,
      isScoring: false,
    }))
  );

  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeSuccess, setCompleteSuccess] = useState(false);
  const [resultsReleased, setResultsReleased] = useState(false);

  // Score a text question
  const handleScore = useCallback(
    async (questionId: string, score: 0 | 1) => {
      // Optimistic update: mark as scoring
      setQuestions((prev) =>
        prev.map((q) =>
          q.questionId === questionId ? { ...q, isScoring: true } : q
        )
      );

      try {
        const res = await fetch(
          `/api/v1/teacher/test-attempts/${attemptId}/questions/${questionId}/score`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score }),
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error?.message ?? t.components.review.failedToSaveScore);
        }

        // Update local state with the confirmed score
        setQuestions((prev) =>
          prev.map((q) =>
            q.questionId === questionId
              ? { ...q, localScore: score, isCorrect: score === 1, isScoring: false }
              : q
          )
        );
      } catch {
        // Revert optimistic update
        setQuestions((prev) =>
          prev.map((q) =>
            q.questionId === questionId ? { ...q, isScoring: false } : q
          )
        );
      }
    },
    [attemptId]
  );

  // Complete review
  const handleCompleteReview = async () => {
    setIsCompleting(true);
    setCompleteError(null);

    try {
      const res = await fetch(
        `/api/v1/teacher/test-attempts/${attemptId}/complete-review`,
        { method: "POST" }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? t.components.review.failedToCompleteReview);
      }

      const body = await res.json().catch(() => null);

      setCompleteSuccess(true);
      setResultsReleased(body?.data?.resultsReleased === true);
      onComplete?.();
      router.refresh();
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : t.components.review.failedToCompleteReview);
    } finally {
      setIsCompleting(false);
    }
  };

  // Compute summary stats
  const mcQuestions = questions.filter((q) => q.autoScored);
  const textQuestions = questions.filter((q) => !q.autoScored);

  const autoCorrect = mcQuestions.filter((q) => q.isCorrect === true).length;
  const autoTotal = mcQuestions.length;

  const manualScored = textQuestions.filter((q) => q.localScore !== null);
  const manualCorrect = manualScored.filter((q) => q.localScore === 1).length;
  const manualTotal = textQuestions.length;

  const totalCorrect = autoCorrect + manualCorrect;
  const totalQuestions = questions.length;

  const allTextScored = textQuestions.every((q) => q.localScore !== null);
  const reviewAlreadyCompleted = initialData.reviewCompletedAt !== null;

  return (
    <div className="space-y-6">
      {/* Score Summary Bar */}
      <Card elevation="sm">
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-4 text-body-sm">
            <div className="flex items-center gap-2">
              <span className="text-foreground-secondary">{t.components.review.autoScoredLabel}</span>
              <span className="font-semibold text-foreground">
                {autoCorrect}/{autoTotal}
              </span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground-secondary">{t.components.review.manuallyScoredLabel}</span>
              <span className="font-semibold text-foreground">
                {manualCorrect}/{manualTotal}
              </span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <span className="text-foreground-secondary">{t.components.review.totalLabel}</span>
              <span className="font-bold text-primary">
                {totalCorrect}/{totalQuestions}
              </span>
            </div>
            {initialData.scoreRaw !== null && (
              <>
                <span className="text-border">|</span>
                <div className="flex items-center gap-2">
                  <span className="text-foreground-secondary">{t.components.review.scoreLabel}</span>
                  <span className="font-bold text-primary">
                    {initialData.scoreRaw}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question List */}
      <div className="space-y-3">
        {questions.map((question) => (
          <ExpandableQuestionCard
            key={question.questionId}
            question={question}
            onScore={handleScore}
          />
        ))}
      </div>

      {/* Complete Review Section */}
      <Card elevation="sm">
        <CardContent className="pt-0">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-body font-semibold text-foreground">
                  {t.components.review.completeReview}
                </h3>
                <p className="text-body-sm text-foreground-secondary">
                  {reviewAlreadyCompleted
                    ? t.components.review.reviewAlreadyCompleted
                    : allTextScored
                      ? t.components.review.allTextQuestionsScored
                      : t.components.review.textQuestionsStillNeedScoring.replace("{count}", String(textQuestions.filter((q) => q.localScore === null).length))}
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                loading={isCompleting}
                disabled={
                  !allTextScored ||
                  isCompleting ||
                  reviewAlreadyCompleted ||
                  completeSuccess
                }
                onClick={handleCompleteReview}
                aria-label={t.components.review.completeReviewAria}
              >
                {completeSuccess
                  ? t.components.review.reviewCompleted
                  : reviewAlreadyCompleted
                    ? t.components.review.alreadyCompleted
                    : t.components.review.completeReviewAction}
              </Button>
            </div>

            {/* Error message */}
            {completeError && (
              <div className="rounded-control-md border border-error bg-error-subtle/30 p-default text-body-sm text-error">
                {completeError}
              </div>
            )}

            {/* Success message */}
            {completeSuccess && (
              <div className="rounded-control-md border border-success/30 bg-success-subtle/30 p-default text-body-sm text-success">
                {resultsReleased
                  ? t.components.review.successReleased
                  : t.components.review.successNotReleased
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
