import { notFound } from "next/navigation";

import { t } from "@/lib/translations";
import { apiGet } from "@/lib/api/server-fetch";

import { EditTestForm } from "./EditTestForm";

export default async function EditTestPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;

  let testData = null;

  try {
    testData = await apiGet<{
      testId: string;
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
    }>(`/api/v1/teacher/tests/${testId}`);
  } catch {
    notFound();
  }

  if (!testData) notFound();

  return (
    <div className="space-y-6">
      <EditTestForm testId={testId} initialData={testData} />
    </div>
  );
}
