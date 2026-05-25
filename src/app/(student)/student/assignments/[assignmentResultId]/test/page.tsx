"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/translations";

// Test flow state machine types
type TestFlowState =
  | "loading"
  | "ready"
  | "in-progress"
  | "submitted"
  | "locked"
  | "unavailable"
  | "error";

interface TestQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  questionType: "multiple_choice" | "text" | "drawing";
  options?: Array<{ id: string; text: string }>;
}

interface TestData {
  testId: string;
  testTitle: string;
  testDescription: string | null;
  timeLimitMinutes: number | null;
  questionCount: number;
  maxAttempts: number;
  currentAttempt: number;
  questions: TestQuestion[];
}

interface TestAttempt {
  id: string;
  isCurrent: boolean;
  submittedAt: string | null;
  responsesJson: Record<string, unknown> | null;
}

interface AssignmentDetail {
  assignmentResultId: string;
  assignmentTitle: string;
  status: string;
  hasTest: boolean;
  linkedTestId: string | null;
  testStartedAt: string | null;
  testSubmittedAt: string | null;
  testAttempts?: TestAttempt[];
}

interface StudentTestReadQuestion {
  id: string;
  questionText: string;
  questionNumber: number;
  type: string;
  options?: unknown;
}

interface StudentTestReadData {
  testId: string;
  title: string;
  timeLimitMinutes?: number;
  questions?: StudentTestReadQuestion[];
}

interface CreateAttemptResponse {
  attemptId: string;
  attemptNumber?: number;
}

interface QuestionResult {
  questionId: string;
  questionText: string;
  questionType: "multiple_choice" | "short_answer";
  studentAnswer: string;
  isCorrect: boolean | null;
  score: number | null;
  status: "correct" | "incorrect" | "pending_review";
}

interface TestResultsData {
  testId?: string;
  title?: string;
  scoreRaw: number | null;
  totalQuestions: number;
  questionResults?: QuestionResult[];
  status?: string;
  noDetails?: boolean;
  noResults?: boolean;
}

function normalizeQuestionType(type: string): TestQuestion["questionType"] {
  if (type === "multiple_choice" || type === "drawing") {
    return type;
  }

  return "text";
}

function normalizeQuestionOptions(options: unknown): Array<{ id: string; text: string }> | undefined {
  if (!Array.isArray(options)) {
    return undefined;
  }

  return options.map((option, index) => {
    if (typeof option === "string") {
      return {
        id: option,
        text: option,
      };
    }

    if (option && typeof option === "object") {
      const record = option as Record<string, unknown>;
      const id = record.id ?? record.value ?? `option-${index + 1}`;
      const text = record.text ?? record.label ?? record.value ?? `Option ${index + 1}`;

      return {
        id: String(id),
        text: String(text),
      };
    }

    return {
      id: `option-${index + 1}`,
      text: `Option ${index + 1}`,
    };
  });
}

function mapStudentTestData(test: StudentTestReadData): TestData {
  const mappedQuestions = (test.questions ?? []).map((question, index) => ({
    id: question.id,
    questionNumber:
      typeof question.questionNumber === "number" && Number.isFinite(question.questionNumber)
        ? question.questionNumber
        : index + 1,
    questionText: question.questionText,
    questionType: normalizeQuestionType(question.type),
    options: normalizeQuestionOptions(question.options),
  }));

  return {
    testId: test.testId,
    testTitle: test.title,
    testDescription: null,
    timeLimitMinutes: test.timeLimitMinutes ?? null,
    questionCount: mappedQuestions.length,
    maxAttempts: 1,
    currentAttempt: 0,
    questions: mappedQuestions,
  };
}

// Progress bar component for visual feedback
function ProgressBar({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label?: string;
}) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="w-full">
      {label && (
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-foreground-secondary">{label}</span>
          <span className="font-medium text-foreground">
            {current} of {total}
          </span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={label || "Progress"}
        />
      </div>
    </div>
  );
}

// Timer component for timed tests
function TestTimer({
  timeLimitMinutes,
  onTimeUp,
}: {
  timeLimitMinutes: number;
  onTimeUp: () => void;
}) {
  const [secondsRemaining, setSecondsRemaining] = React.useState(timeLimitMinutes * 60);
  const [isWarning, setIsWarning] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        // Show warning when less than 5 minutes remain
        if (prev <= 300 && !isWarning) {
          setIsWarning(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLimitMinutes, onTimeUp, isWarning]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
        isWarning ? "bg-warning-subtle text-warning" : "bg-surface-muted text-foreground-secondary"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span className={`font-mono font-medium ${isWarning ? "animate-pulse" : ""}`}>
        {formattedTime}
      </span>
    </div>
  );
}

// Question renderer component
function QuestionCard({
  question,
  answer,
  onAnswer,
  isLast,
  onNext,
  onPrevious,
  currentIndex,
  totalQuestions,
}: {
  question: TestQuestion;
  answer: string | null;
  onAnswer: (value: string) => void;
  isLast: boolean;
  onNext: () => void;
  onPrevious: () => void;
  currentIndex: number;
  totalQuestions: number;
}) {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="default">{t.student.assignments.test.question.label(question.questionNumber)}</Badge>
          <span className="text-sm text-foreground-secondary">
            {t.student.assignments.test.question.of(currentIndex + 1, totalQuestions)}
          </span>
        </div>
        <CardTitle className="text-lg">{question.questionText}</CardTitle>
      </CardHeader>
      <CardContent>
        {question.questionType === "multiple_choice" && question.options && (
          <div className="flex flex-col gap-3">
            {question.options.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                  answer === option.id
                    ? "border-primary bg-primary-subtle"
                    : "border-border bg-surface-raised hover:border-border-hover"
                }`}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option.id}
                  checked={answer === option.id}
                  onChange={(e) => onAnswer(e.target.value)}
                  className="h-4 w-4 text-primary"
                />
                <span className="text-foreground">{option.text}</span>
              </label>
            ))}
          </div>
        )}

        {question.questionType === "text" && (
          <textarea
            value={answer || ""}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder={t.student.assignments.test.question.textPlaceholder}
            rows={4}
            className="w-full rounded-lg border border-border bg-surface-raised p-3 text-foreground placeholder:text-foreground-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus"
          />
        )}

        {question.questionType === "drawing" && (
          <div className="rounded-lg border border-dashed border-border bg-surface-muted p-8 text-center">
            <p className="text-foreground-secondary">
              {t.student.assignments.test.question.drawingInfo}
            </p>
            <p className="mt-2 text-sm text-foreground-muted">
              {t.student.assignments.test.question.drawingHint}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="secondary"
          onClick={onPrevious}
          disabled={currentIndex === 0}
        >
          {t.student.assignments.test.question.previous}
        </Button>
        <Button onClick={onNext} disabled={!answer && question.questionType !== "drawing"}>
          {isLast ? t.student.assignments.test.question.review : t.student.assignments.test.question.next}
        </Button>
      </CardFooter>
    </Card>
  );
}

// Main test-taking page component
export default function StudentTestPage() {
  const params = useParams();
  const assignmentResultId = typeof params?.assignmentResultId === "string" ? params.assignmentResultId : "";

  const [flowState, setFlowState] = React.useState<TestFlowState>("loading");
  const [assignment, setAssignment] = React.useState<AssignmentDetail | null>(null);
  const [testData, setTestData] = React.useState<TestData | null>(null);
  const [attemptId, setAttemptId] = React.useState<string | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [resultsData, setResultsData] = React.useState<TestResultsData | null>(null);
  const [resultsLoading, setResultsLoading] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAnswers = React.useRef<Record<string, string>>({});

  // Fetch assignment and test data on mount
  React.useEffect(() => {
    async function loadTest() {
      try {
        // Fetch assignment details
        const assignmentRes = await fetch(`/api/v1/student/assignments/${assignmentResultId}`);
        const assignmentEnvelope = await assignmentRes.json();

        if (!assignmentEnvelope.success) {
          if (assignmentEnvelope.error?.code === "RESOURCE_NOT_FOUND") {
            setFlowState("unavailable");
            return;
          }
          throw new Error(assignmentEnvelope.error?.message || "Failed to load assignment");
        }

        const assignmentData: AssignmentDetail = assignmentEnvelope.data;
        setAssignment(assignmentData);

        // Check if test is available
        if (!assignmentData.hasTest || !assignmentData.linkedTestId) {
          setFlowState("unavailable");
          return;
        }

        // Check if already submitted - resolve attemptId first
        if (assignmentData.testSubmittedAt) {
          // Find the current test attempt to get attemptId
          const currentAttempt = assignmentData.testAttempts?.find((a) => a.isCurrent);
          if (currentAttempt) {
            setAttemptId(currentAttempt.id);
            // Restore saved answers for consistency
            if (currentAttempt.responsesJson && Object.keys(currentAttempt.responsesJson).length > 0) {
              setAnswers(currentAttempt.responsesJson as Record<string, string>);
            }
          }
          setFlowState("submitted");
          return;
        }

        // Check if test is locked (deadline passed, etc.)
        if (assignmentData.status === "locked") {
          setFlowState("locked");
          return;
        }

        // Fetch test data
        const testRes = await fetch(`/api/v1/student/tests/${assignmentData.linkedTestId}`);
        const testEnvelope = await testRes.json();

        if (!testEnvelope.success) {
          throw new Error(testEnvelope.error?.message || "Failed to load test");
        }

        setTestData(mapStudentTestData(testEnvelope.data as StudentTestReadData));

        // Check for an existing current attempt (e.g. student revisits the page)
        const currentAttempt = assignmentData.testAttempts?.find((a) => a.isCurrent);
        if (currentAttempt) {
          setAttemptId(currentAttempt.id);

          // Restore saved answers if available
          if (currentAttempt.responsesJson && Object.keys(currentAttempt.responsesJson).length > 0) {
            setAnswers(currentAttempt.responsesJson as Record<string, string>);
          }

          // If the current attempt was already submitted, show submitted state
          if (currentAttempt.submittedAt) {
            setFlowState("submitted");
            return;
          }
        }

        // Determine initial state
        if (assignmentData.testStartedAt) {
          setFlowState("in-progress");
        } else {
          setFlowState("ready");
        }
      } catch (err) {
        console.error("[TestPage] Error loading test:", err);
        setErrorMessage(err instanceof Error ? err.message : "Failed to load test");
        setFlowState("error");
      }
    }

    loadTest();
  }, [assignmentResultId]);

  const createAttempt = React.useCallback(
    async (linkedTestId: string) => {
      const res = await fetch(
        `/api/v1/student/assignment-results/${assignmentResultId}/test-attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId: linkedTestId }),
        },
      );
      const envelope = await res.json();

      if (!envelope.success) {
        throw new Error(envelope.error?.message || "Failed to create test attempt");
      }

      const attempt = envelope.data as CreateAttemptResponse;
      setAttemptId(attempt.attemptId);
      setTestData((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          currentAttempt: attempt.attemptNumber ?? prev.currentAttempt ?? 1,
        };
      });

      return attempt.attemptId;
    },
    [assignmentResultId],
  );

  const ensureAttemptId = React.useCallback(async () => {
    if (attemptId) {
      return attemptId;
    }

    if (!assignment?.linkedTestId) {
      throw new Error("Test attempt is unavailable for this assignment.");
    }

    return createAttempt(assignment.linkedTestId);
  }, [assignment?.linkedTestId, attemptId, createAttempt]);

  // Start test handler
  const handleStartTest = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (!assignment?.linkedTestId) {
        throw new Error("Test is not available for this assignment.");
      }

      await ensureAttemptId();
      setFlowState("in-progress");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to start test");
      setFlowState("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit test handler
  const handleSubmitTest = React.useCallback(async () => {
    // Cancel pending auto-save to avoid race with submit
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const activeAttemptId = await ensureAttemptId();
      const res = await fetch(`/api/v1/student/test-attempts/${activeAttemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalResponsesJson: answers }),
      });
      const envelope = await res.json();

      if (!envelope.success) {
        throw new Error(envelope.error?.message || "Failed to submit test");
      }

      setFlowState("submitted");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit test");
      setFlowState("error");
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, ensureAttemptId]);

  // Handle time up
  const handleTimeUp = React.useCallback(() => {
    // Cancel pending auto-save to avoid race with submit
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    void handleSubmitTest();
  }, [handleSubmitTest]);

  // Fetch test results when submitted
  React.useEffect(() => {
    if (flowState !== "submitted" || !attemptId) {
      return;
    }

    let cancelled = false;

    async function fetchResults() {
      try {
        setResultsLoading(true);
        const res = await fetch(`/api/v1/student/test-attempts/${attemptId}/results`);
        const envelope = await res.json();

        if (cancelled) {
          return;
        }

        if (!envelope.success) {
          // If results fetch fails, still show submitted state without results
          console.error("[TestPage] Failed to fetch results:", envelope.error?.message);
          setResultsData(null);
          return;
        }

        setResultsData(envelope.data as TestResultsData);
      } catch (err) {
        if (!cancelled) {
          console.error("[TestPage] Error fetching results:", err);
          setResultsData(null);
        }
      } finally {
        if (!cancelled) {
          setResultsLoading(false);
        }
      }
    }

    fetchResults();

    return () => {
      cancelled = true;
    };
  }, [flowState, attemptId]);

  // Auto-save answers with 30s debounce (only during in-progress)
  React.useEffect(() => {
    if (flowState !== "in-progress" || !attemptId) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new 30s timer
    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/v1/student/test-attempts/${attemptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responsesJson: answers }),
        });
        const envelope = await res.json();
        if (envelope.success) {
          setSaveStatus("saved");
          lastSavedAnswers.current = { ...answers };
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [answers, flowState, attemptId]);

  // Warn before unload when unsaved changes exist
  React.useEffect(() => {
    if (flowState !== "in-progress") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnsavedChanges = JSON.stringify(answers) !== JSON.stringify(lastSavedAnswers.current);
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [answers, flowState]);

  // Answer handler
  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentQuestionIndex < (testData?.questions.length || 0) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  // Render based on flow state
  if (flowState === "loading") {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-foreground-secondary">{t.student.assignments.test.loading}</p>
      </div>
    );
  }

  if (flowState === "unavailable") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          title={t.student.assignments.test.unavailable.title}
          description={t.student.assignments.test.unavailable.description}
          action={
            <Button asChild>
              <Link href={`/student/assignments/${assignmentResultId}`}>
                {t.student.assignments.detail.back}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (flowState === "locked") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          }
          title={t.student.assignments.test.locked.title}
          description={t.student.assignments.test.locked.description}
          action={
            <Button asChild>
              <Link href={`/student/assignments/${assignmentResultId}`}>
                {t.student.assignments.detail.back}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (flowState === "error") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader>
            <StatusChip status="error">{t.student.assignments.test.error.status}</StatusChip>
            <CardTitle>{t.student.assignments.test.error.title}</CardTitle>
            <CardDescription>
              {errorMessage || t.student.assignments.test.error.title}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex gap-3">
            <Button onClick={() => window.location.reload()} variant="secondary">
              {t.common.tryAgain}
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/student/assignments/${assignmentResultId}`}>{t.student.assignments.detail.back}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (flowState === "ready" && testData) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-secondary">
          <Link href="/student/assignments" className="hover:text-foreground">
            {t.student.assignments.title}
          </Link>
          <span>/</span>
          <Link href={`/student/assignments/${assignmentResultId}`} className="hover:text-foreground">
            {assignment?.assignmentTitle || t.student.assignments.title}
          </Link>
          <span>/</span>
          <span className="text-foreground">{t.student.assignments.test.breadcrumbs.test}</span>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="primary">{t.student.assignments.test.ready.badge}</Badge>
              {testData.timeLimitMinutes && (
                <span className="text-sm text-foreground-secondary">
                  {t.student.assignments.test.timer.label} {testData.timeLimitMinutes} {t.student.assignments.test.timer.minutes}
                </span>
              )}
            </div>
            <CardTitle className="text-2xl">{testData.testTitle}</CardTitle>
            {testData.testDescription && (
              <CardDescription>{testData.testDescription}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 rounded-lg bg-surface-muted p-4 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-2xl font-semibold text-foreground">{testData.questionCount}</p>
                <p className="text-sm text-foreground-secondary">{t.student.assignments.test.ready.questions}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-foreground">
                  {testData.currentAttempt} / {testData.maxAttempts}
                </p>
                <p className="text-sm text-foreground-secondary">{t.student.assignments.test.ready.attempt}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-foreground">
                  {testData.timeLimitMinutes || t.student.assignments.test.timer.unlimited}
                </p>
                <p className="text-sm text-foreground-secondary">
                  {testData.timeLimitMinutes ? t.student.assignments.test.timer.minutes : t.student.assignments.test.timer.time}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-raised p-4">
              <h3 className="mb-2 font-medium text-foreground">{t.student.assignments.test.ready.beforeStart.title}</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-foreground-secondary">
                <li>{t.student.assignments.test.ready.beforeStart.item1}</li>
                <li>{t.student.assignments.test.ready.beforeStart.item2}</li>
                {testData.timeLimitMinutes && <li>{t.student.assignments.test.ready.beforeStart.item3}</li>}
                <li>{t.student.assignments.test.ready.beforeStart.item4}</li>
                <li>{t.student.assignments.test.ready.beforeStart.item5}</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button asChild variant="secondary">
              <Link href={`/student/assignments/${assignmentResultId}`}>{t.common.cancel}</Link>
            </Button>
            <Button onClick={handleStartTest} loading={isSubmitting} size="lg">
              {t.student.assignments.test.ready.beginTest}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (flowState === "in-progress" && testData) {
    const currentQuestion = testData.questions[currentQuestionIndex];
    const answeredCount = Object.keys(answers).length;
    const isLastQuestion = currentQuestionIndex === testData.questions.length - 1;

    return (
      <div className="mx-auto max-w-3xl py-8">
        {/* Header with progress and timer */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <ProgressBar
              current={answeredCount}
              total={testData.questions.length}
              label={t.student.assignments.test.progress.questionsAnswered}
            />
            {saveStatus === "saved" && (
              <span className="text-xs text-success">{t.student.assignments.test.autosave.saved}</span>
            )}
            {saveStatus === "saving" && (
              <span className="text-xs text-foreground-secondary">{t.student.assignments.test.autosave.saving}</span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-warning">{t.student.assignments.test.autosave.failed}</span>
            )}
          </div>
          {testData.timeLimitMinutes && (
            <TestTimer timeLimitMinutes={testData.timeLimitMinutes} onTimeUp={handleTimeUp} />
          )}
        </div>

        {/* Question card */}
        <QuestionCard
          question={currentQuestion}
          answer={answers[currentQuestion.id] || null}
          onAnswer={(value) => handleAnswer(currentQuestion.id, value)}
          isLast={isLastQuestion}
          onNext={handleNext}
          onPrevious={handlePrevious}
          currentIndex={currentQuestionIndex}
          totalQuestions={testData.questions.length}
        />

        {/* Submit section - shown when all questions viewed */}
        {answeredCount >= testData.questions.length && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <StatusChip status="success">{t.student.assignments.test.allAnswered}</StatusChip>
                <p className="text-foreground-secondary">
                  {t.student.assignments.test.allAnsweredDescription(testData.questions.length)}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center gap-3">
              <Button
                variant="secondary"
                onClick={() => setCurrentQuestionIndex(0)}
              >
                {t.student.assignments.test.question.review}
              </Button>
              <Button
                onClick={handleSubmitTest}
                loading={isSubmitting}
                variant="primary"
              >
                {t.student.assignments.test.submitTest}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Quick navigation */}
        <div className="mt-6 rounded-lg border border-border bg-surface-raised p-4">
          <p className="mb-3 text-sm font-medium text-foreground">{t.student.assignments.test.quickNavigation}</p>
          <div className="flex flex-wrap gap-2">
            {testData.questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                  idx === currentQuestionIndex
                    ? "bg-primary text-foreground-inverse"
                    : answers[q.id]
                      ? "bg-success-subtle text-success"
                      : "bg-surface-muted text-foreground-secondary hover:bg-surface"
                }`}
                aria-label={t.student.assignments.test.question.goToQuestion(q.questionNumber)}
              >
                {q.questionNumber}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (flowState === "submitted") {
    // Loading results
    if (resultsLoading) {
      return (
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-foreground-secondary">{t.student.assignments.test.results.loading}</p>
        </div>
      );
    }

    // show_results=never: no details available
    if (resultsData?.noDetails) {
      return (
        <div className="mx-auto max-w-2xl py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-info-subtle">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-info"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <CardTitle className="text-2xl">{t.student.assignments.test.submitted.title}</CardTitle>
              <CardDescription>
                {t.student.assignments.test.results.noDetailsDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <StatusChip status="info">{t.student.assignments.test.submitted.title}</StatusChip>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button asChild size="lg">
                <Link href={`/student/assignments/${assignmentResultId}`}>
                  {t.student.assignments.detail.back}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    // show_results=after_review, pending review: no results yet
    if (resultsData?.noResults) {
      return (
        <div className="mx-auto max-w-2xl py-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-subtle">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-warning"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <CardTitle className="text-2xl">{t.student.assignments.test.submitted.title}</CardTitle>
              <CardDescription>
                {t.student.assignments.test.results.awaitingTeacherReview}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <StatusChip status="warning">{t.student.assignments.test.submitted.awaitingReview}</StatusChip>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button asChild size="lg">
                <Link href={`/student/assignments/${assignmentResultId}`}>
                  {t.student.assignments.detail.back}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    // Results available: show per-question breakdown
    if (resultsData?.questionResults && resultsData.questionResults.length > 0) {
      const pendingCount = resultsData.questionResults.filter(
        (q) => q.status === "pending_review"
      ).length;
      const scoredCount = resultsData.questionResults.filter(
        (q) => q.status !== "pending_review"
      ).length;

      return (
        <div className="mx-auto max-w-3xl py-8">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-sm text-foreground-secondary">
            <Link href="/student/assignments" className="hover:text-foreground">
              {t.student.assignments.title}
            </Link>
            <span>/</span>
            <Link href={`/student/assignments/${assignmentResultId}`} className="hover:text-foreground">
              {assignment?.assignmentTitle || t.student.assignments.title}
            </Link>
            <span>/</span>
            <span className="text-foreground">{t.student.assignments.test.results.title}</span>
          </div>

          {/* Score Summary Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t.student.assignments.test.results.scoreSummary}</CardTitle>
                <StatusChip status={pendingCount > 0 ? "warning" : "success"}>
                  {pendingCount > 0 ? t.student.assignments.test.results.partialResults : t.student.assignments.test.results.complete}
                </StatusChip>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-surface-muted p-4">
                  <p className="text-sm text-foreground-secondary">{t.student.assignments.test.results.score}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {resultsData.scoreRaw !== null
                      ? `${resultsData.scoreRaw}/${resultsData.totalQuestions}`
                      : `—/${resultsData.totalQuestions}`}
                  </p>
                  {pendingCount > 0 && (
                    <p className="mt-1 text-sm text-foreground-secondary">
                      {t.student.assignments.test.results.scoredCount(scoredCount, pendingCount)}
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-surface-muted p-4">
                  <p className="text-sm text-foreground-secondary">{t.student.assignments.test.results.totalQuestions}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {resultsData.totalQuestions}
                  </p>
                  <p className="mt-1 text-sm text-foreground-secondary">
                    {resultsData.questionResults.filter((q) => q.questionType === "multiple_choice").length} {t.student.assignments.test.results.multipleChoice} · {resultsData.questionResults.filter((q) => q.questionType === "short_answer").length} {t.student.assignments.test.results.text}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Per-Question Breakdown */}
          <div className="space-y-4">
            {resultsData.questionResults.map((question, index) => (
              <Card key={question.questionId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant="default">{t.student.assignments.test.question.label(index + 1)}</Badge>
                    {question.status === "correct" && (
                      <Badge variant="success">{t.student.assignments.test.results.correct}</Badge>
                    )}
                    {question.status === "incorrect" && (
                      <Badge variant="error">{t.student.assignments.test.results.incorrect}</Badge>
                    )}
                    {question.status === "pending_review" && (
                      <Badge variant="warning">{t.student.assignments.test.results.awaitingTeacherReview}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-base">{question.questionText}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium text-foreground-secondary">
                        {t.student.assignments.test.results.yourAnswer}:
                      </span>
                      <span className="text-sm text-foreground">
                        {question.studentAnswer || <em className="text-foreground-muted">{t.student.assignments.test.results.noAnswer}</em>}
                      </span>
                    </div>
                    {question.score !== null && (
                      <div className="flex items-start gap-2">
                        <span className="text-sm font-medium text-foreground-secondary">
                          {t.student.assignments.test.results.points}:
                        </span>
                        <span className="text-sm text-foreground">
                          {question.score}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Back to Assignment */}
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg">
              <Link href={`/student/assignments/${assignmentResultId}`}>
                {t.student.assignments.test.backToAssignment}
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    // Fallback: no results data yet (e.g. fetch failed or no attemptId)
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-success"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <CardTitle className="text-2xl">{t.student.assignments.test.finalSuccess.title}</CardTitle>
            <CardDescription>
              {t.student.assignments.test.finalSuccess.submitted}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <StatusChip status="success">{t.student.assignments.test.finalSuccess.title}</StatusChip>
            <p className="mt-4 text-sm text-foreground-secondary">
              {t.student.assignments.test.finalSuccess.notificationMessage}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild size="lg">
              <Link href={`/student/assignments/${assignmentResultId}`}>
                {t.student.assignments.test.backToAssignment}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Fallback
  return null;
}
