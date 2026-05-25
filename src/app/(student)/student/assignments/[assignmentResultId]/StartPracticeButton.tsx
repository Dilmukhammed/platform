"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/translations";

interface StartPracticeButtonProps {
  assignmentResultId: string;
  variant?: "primary" | "secondary";
}

export function StartPracticeButton({
  assignmentResultId,
  variant = "primary",
}: StartPracticeButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleStartPractice = async () => {
    try {
      setIsLoading(true);

      const res = await fetch(
        `/api/v1/student/assignment-results/${assignmentResultId}/start-practice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      const envelope = await res.json();

      if (!envelope.success) {
        console.error("[StartPracticeButton] Error:", envelope.error?.message);
        // Still redirect to submit page - the submit page will handle the error
      }

      // Redirect to submit page
      router.push(`/student/assignments/${assignmentResultId}/submit`);
    } catch (err) {
      console.error("[StartPracticeButton] Unexpected error:", err);
      // Still redirect to submit page
      router.push(`/student/assignments/${assignmentResultId}/submit`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleStartPractice}
      loading={isLoading}
    >
      {t.student.assignments.detail.practicalCard.startPractice}
    </Button>
  );
}
