"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/translations";

interface SubmitTestButtonProps {
  testId: string;
  organizationId: string;
}

export function SubmitTestButton({ testId, organizationId }: SubmitTestButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/teacher/tests/${testId}/submit-to-organization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: { message: string };
      } | null;

      if (!response.ok || !data?.success) {
        alert(data?.error?.message ?? "Failed to submit test for approval.");
        setIsSubmitting(false);
        return;
      }

      router.push("/teacher/tests?submitted=true");
      router.refresh();
    } catch {
      alert("An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="primary"
      size="sm"
      onClick={handleSubmit}
      loading={isSubmitting}
      leftIcon={!isSubmitting ? <Send className="h-3 w-3" /> : undefined}
    >
      {isSubmitting ? t.teacher.tests.buttons.submitting : t.teacher.tests.buttons.submitForApproval}
    </Button>
  );
}
