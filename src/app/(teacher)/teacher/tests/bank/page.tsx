import { apiGet } from "@/lib/api/server-fetch";
import { TestsTabBar } from "@/components/ui/tests-tab-bar";
import { BankQuestionForm } from "./BankQuestionForm";

interface BankQuestionData {
  questionId: string;
  questionType: string;
  prompt: string;
  optionsJson: Record<string, unknown> | null;
  answerJson: Record<string, unknown>;
  explanation: string | null;
  images: string[];
  scopeType: "personal" | "organization";
  createdAt: string;
  updatedAt: string;
}

interface SelectedOrganization {
  organizationId: string;
  organizationName: string;
}

/**
 * Question Bank Page
 *
 * Displays reusable bank questions with create/edit/delete capabilities.
 */
export default async function QuestionBankPage() {
  const [questions, selectedOrganization] = await Promise.all([
    apiGet<BankQuestionData[]>("/api/v1/teacher/question-bank"),
    apiGet<SelectedOrganization | null>("/api/v1/teacher/organizations/selected"),
  ]);

  return (
    <div className="space-y-6">
      <TestsTabBar />
      <BankQuestionForm
        initialQuestions={questions}
        selectedOrganization={selectedOrganization}
      />
    </div>
  );
}
