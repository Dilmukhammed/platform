export interface TeacherApprovalState {
  approvalId: string;
  decision: string | null;
  requestedAt?: string;
  reviewedAt?: string;
  decisionReason?: string | null;
}

export interface TeacherTestSummary {
  testId: string;
  title: string;
  description: string | null;
  scopeType: "personal" | "organization";
  ownerTeacherId: string | null;
  ownerOrganizationId: string | null;
  status: "draft" | "active" | "archived" | "deletion_requested";
  origin: "manual" | "ai_draft" | "imported";
  sourceFilePath: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  pendingApproval: TeacherApprovalState | null;
  lastDecision?: TeacherApprovalState | null;
}

export interface TeacherTestQuestion {
  questionId: string;
  orderIndex: number;
  questionType: string;
  prompt: string;
  images: string[];
  optionsJson?: Record<string, unknown>;
  answerJson: Record<string, unknown>;
  explanation?: string;
}

export interface TeacherTestDetail extends TeacherTestSummary {
  questions: TeacherTestQuestion[];
  lastDecision: TeacherApprovalState | null;
}

export interface SelectedOrganization {
  organizationId: string;
  organizationName: string;
}

export function getDraftStatusConfig(test: {
  status: TeacherTestSummary["status"];
  pendingApproval: TeacherTestSummary["pendingApproval"];
  lastDecision?: TeacherTestSummary["lastDecision"];
}): { status: "info" | "warning" | "success" | "error"; label: string } {
  if (test.pendingApproval?.decision === "pending") {
    return { status: "info", label: "Pending Review" };
  }

  if (test.lastDecision?.decision === "approved" || test.status === "active") {
    return { status: "success", label: "Approved" };
  }

  if (test.lastDecision?.decision === "rejected") {
    return { status: "error", label: "Rejected" };
  }

  return { status: "warning", label: "Draft" };
}

export function canEditDraft(draft: TeacherTestDetail): boolean {
  return draft.status === "draft" && draft.pendingApproval?.decision !== "pending";
}

export function getQuestionAnswerText(answerJson: Record<string, unknown>): string {
  const text = answerJson.text;
  return typeof text === "string" ? text : "";
}

export function getQuestionOptions(question: TeacherTestQuestion): string[] {
  const variants = question.optionsJson?.variants;
  if (Array.isArray(variants)) {
    return variants.map((v: unknown) => (typeof v === "string" ? v : String(v)));
  }
  return [];
}

export function getCorrectOptionIndex(question: TeacherTestQuestion): number {
  const idx = question.answerJson?.correctIndex;
  return typeof idx === "number" ? idx : 0;
}

export function getGenerationPrompt(draft: TeacherTestDetail): string | null {
  if (draft.origin !== "ai_draft") {
    return null;
  }

  const prompt = draft.description?.trim();
  return prompt ? prompt : null;
}
