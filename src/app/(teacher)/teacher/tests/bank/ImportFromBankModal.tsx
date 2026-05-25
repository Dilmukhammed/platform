"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Loader2, ChevronDown, ChevronUp, Check } from "lucide-react";

import { t } from "@/lib/translations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
} from "@/components/ui/modal";
import type { BankQuestion } from "@/app/api/v1/teacher/question-bank/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportedQuestion {
  questionType: "multiple_choice" | "short_answer";
  prompt: string;
  explanation: string;
  answer: string; // from answerJson.text
  options: Array<{ text: string; images: string[] }>; // from optionsJson.variants + optionImages
  correctOptionIndex: number; // from answerJson.correctIndex
  images: string[];
}

interface ImportFromBankModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (questions: ImportedQuestion[]) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapBankToImported(q: BankQuestion): ImportedQuestion {
  const answerJson = q.answerJson ?? {};
  const optionsJson = q.optionsJson ?? {};

  if (q.questionType === "multiple_choice") {
    const variants: string[] = Array.isArray(optionsJson.variants)
      ? (optionsJson.variants as string[])
      : [];
    const optionImages: Record<string, string[]> =
      typeof optionsJson.optionImages === "object" && optionsJson.optionImages !== null
        ? (optionsJson.optionImages as Record<string, string[]>)
        : {};

    const options = variants.map((text, i) => ({
      text,
      images: optionImages[String(i)] ?? [],
    }));

    return {
      questionType: "multiple_choice",
      prompt: q.prompt,
      explanation: q.explanation ?? "",
      answer: (answerJson.text as string) ?? "",
      options,
      correctOptionIndex: (answerJson.correctIndex as number) ?? 0,
      images: q.images ?? [],
    };
  }

  // short_answer
  return {
    questionType: "short_answer",
    prompt: q.prompt,
    explanation: q.explanation ?? "",
    answer: (answerJson.text as string) ?? "",
    options: [],
    correctOptionIndex: 0,
    images: q.images ?? [],
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

// ---------------------------------------------------------------------------
// Question Preview Component
// ---------------------------------------------------------------------------

interface QuestionPreviewProps {
  question: BankQuestion;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function QuestionPreview({
  question,
  isExpanded,
  onToggleExpand,
  isSelected,
  onToggleSelect,
}: QuestionPreviewProps) {
  const answerJson = question.answerJson ?? {};
  const optionsJson = question.optionsJson ?? {};
  const variants: string[] = Array.isArray(optionsJson.variants)
    ? (optionsJson.variants as string[])
    : [];
  const optionImages: Record<string, string[]> =
    typeof optionsJson.optionImages === "object" && optionsJson.optionImages !== null
      ? (optionsJson.optionImages as Record<string, string[]>)
      : {};
  const correctIndex = (answerJson.correctIndex as number) ?? 0;
  const answerText = (answerJson.text as string) ?? "";

  return (
    <div
      className={`
        rounded-card border transition-colors
        ${isSelected
          ? "border-primary bg-primary-subtle/30"
          : "border-border hover:border-primary/40"
        }
      `}
    >
      {/* Header row - always visible */}
      <div
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Checkbox - stops propagation to not trigger expand */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 h-4 w-4 rounded border-border accent-primary shrink-0"
          aria-label={`Select question: ${question.prompt}`}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug">
            {truncate(question.prompt, 150)}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge
              variant={question.questionType === "multiple_choice" ? "info" : "default"}
              size="sm"
            >
              {question.questionType === "multiple_choice" ? t.teacher.tests.bank.shortMultipleChoice : t.teacher.tests.bank.shortShortAnswer}
            </Badge>
            <Badge
              variant={question.scopeType === "organization" ? "primary" : "default"}
              size="sm"
            >
              {question.scopeType === "organization" ? t.teacher.tests.bank.shortOrganization : t.teacher.tests.bank.shortPersonal}
            </Badge>
            {question.images.length > 0 && (
              <Badge variant="default" size="sm">
                {question.images.length} img
              </Badge>
            )}
          </div>
        </div>

        {/* Expand/collapse icon */}
        <button
          type="button"
          className="shrink-0 p-1 rounded hover:bg-surface-secondary"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-foreground-secondary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-foreground-secondary" />
          )}
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border mt-1">
          {/* Question images */}
          {question.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {question.images.map((path, i) => (
                <img
                  key={i}
                  src={`/api/v1/uploads/signed-url?path=${encodeURIComponent(path)}`}
                  alt={`Question image ${i + 1}`}
                  className="h-16 w-16 rounded border border-border object-cover"
                />
              ))}
            </div>
          )}

          {/* Multiple choice options */}
          {question.questionType === "multiple_choice" && variants.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">
                Options
              </p>
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
                        {imgs.length > 2 && (
                          <span className="text-xs text-foreground-secondary">+{imgs.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Short answer */}
          {question.questionType === "short_answer" && answerText && (
            <div className="mt-3">
              <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1.5">
                Correct Answer
              </p>
              <p className="text-sm text-foreground bg-success-subtle/30 border border-success/30 rounded p-2">
                {answerText}
              </p>
            </div>
          )}

          {/* Explanation */}
          {question.explanation && (
            <div className="mt-3">
              <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1.5">
                Explanation
              </p>
              <p className="text-sm text-foreground-secondary italic">
                {question.explanation}
              </p>
            </div>
          )}

          {/* Quick select button */}
          <div className="mt-3 pt-2 border-t border-border/50">
            <Button
              variant={isSelected ? "secondary" : "primary"}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
            >
              {isSelected ? t.teacher.tests.buttons.deselectAll : "Savolni tanlash"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ImportFromBankModal({
  open,
  onOpenChange,
  onImport,
}: ImportFromBankModalProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch questions when modal opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    setExpandedIds(new Set());
    setSearch("");

    fetch("/api/v1/teacher/question-bank?limit=50")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch questions");
        return res.json();
      })
      .then((envelope) => {
        if (cancelled) return;
        if (!envelope.success) {
          setError(envelope.error?.message ?? "Failed to fetch questions");
          return;
        }
        setQuestions(envelope.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load questions. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Client-side search filter
  const filtered = search.trim()
    ? questions.filter((q) =>
        q.prompt.toLowerCase().includes(search.toLowerCase())
      )
    : questions;

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select / deselect all visible
  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allVisibleIds = filtered.map((q) => q.questionId);
      const allSelected = allVisibleIds.every((id) => prev.has(id));

      if (allSelected) {
        // Deselect all visible
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      }
      // Select all visible
      const next = new Set(prev);
      allVisibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, [filtered]);

  // Expand / collapse all
  const toggleExpandAll = useCallback(() => {
    setExpandedIds((prev) => {
      const allVisibleIds = filtered.map((q) => q.questionId);
      const allExpanded = allVisibleIds.every((id) => prev.has(id));

      if (allExpanded) {
        // Collapse all
        return new Set();
      }
      // Expand all visible
      return new Set(allVisibleIds);
    });
  }, [filtered]);

  // Import handler
  const handleImport = () => {
    const selected = questions.filter((q) => selectedIds.has(q.questionId));
    if (selected.length === 0) return;

    const imported = selected.map(mapBankToImported);
    onImport(imported);
    onOpenChange(false);
  };

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((q) => selectedIds.has(q.questionId));
  const allVisibleExpanded =
    filtered.length > 0 && filtered.every((q) => expandedIds.has(q.questionId));

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <ModalHeader>
          <ModalTitle>{t.teacher.tests.bank.importTitle}</ModalTitle>
          <ModalDescription>
            {t.teacher.tests.bank.importDescription}
          </ModalDescription>
        </ModalHeader>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-secondary pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.teacher.tests.buttons.searchQuestions}
            className="pl-9"
          />
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-foreground-secondary" />
              <span className="ml-2 text-foreground-secondary">{t.teacher.tests.bank.loading}</span>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-md border border-error bg-error-subtle/30 p-4 text-sm text-error">
              {error}
            </div>
          )}

          {!loading && !error && questions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-foreground-secondary">
              <p className="text-sm">{t.teacher.tests.bank.noQuestions}</p>
              <Link
                href="/teacher/tests/bank"
                className="mt-2 text-sm text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {t.teacher.tests.bank.goToBank}
              </Link>
            </div>
          )}

          {!loading && !error && questions.length > 0 && filtered.length === 0 && (
            <div className="flex items-center justify-center py-12 text-foreground-secondary">
              <p className="text-sm">{t.teacher.tests.bank.noMatch}</p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <>
              {/* Select all / Expand all toggles */}
              <div className="flex items-center justify-between gap-4 mb-2 px-1">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border accent-primary"
                    aria-label="Select all questions"
                  />
                  <span>{allVisibleSelected ? t.teacher.tests.buttons.deselectAll : t.teacher.tests.buttons.selectAll} ({filtered.length})</span>
                </button>
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  {allVisibleExpanded ? t.teacher.tests.buttons.collapseAll : t.teacher.tests.buttons.expandAll}
                </button>
              </div>

              {/* Question list */}
              <ul className="space-y-2">
                {filtered.map((q) => {
                  const isSelected = selectedIds.has(q.questionId);
                  const isExpanded = expandedIds.has(q.questionId);
                  return (
                    <li key={q.questionId}>
                      <QuestionPreview
                        question={q}
                        isExpanded={isExpanded}
                        onToggleExpand={() => toggleExpand(q.questionId)}
                        isSelected={isSelected}
                        onToggleSelect={() => toggleSelect(q.questionId)}
                      />
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary">{t.teacher.tests.buttons.cancel}</Button>
          </ModalClose>
          <Button
            onClick={handleImport}
            disabled={selectedIds.size === 0}
          >
            {t.teacher.tests.buttons.importSelected}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
