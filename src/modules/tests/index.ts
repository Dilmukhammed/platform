export const testsModule = {
  scope: "tests",
  status: "supabase-migrated",
  phase: "t6-ready",
} as const;

export * from "./types";

// Legacy compat: assignments service still imports getTestsState.
// Returns empty state — real test data lives in Supabase now.
import type {
  TestsState,
  TestRecord,
  TeacherTestSummary,
  TeacherTestDetail,
  PendingSchoolTestApproval,
  SchoolLibraryTest,
} from "./types";

export function getTestsState(): TestsState {
  return { tests: [] };
}

// ── Test compatibility stubs ──
// These are in-memory stubs to keep test imports from breaking.
// Real implementations use Supabase via server-data.ts.

let _tests: TestRecord[] = [];

export function resetTestsState(): void {
  _tests = [];
}

export function createAiDraftTest(input: { teacherId: string; prompt: string; questionCount: number }): TestRecord {
  const now = new Date().toISOString();
  const questions = Array.from({ length: input.questionCount }, (_, i) => ({
    id: `q-${crypto.randomUUID()}`,
    prompt: `Question ${i + 1} about: ${input.prompt}`,
    answer: `Sample answer for question ${i + 1}`,
    explanation: null as string | null,
  }));
  const record: TestRecord = {
    id: crypto.randomUUID(),
    teacherId: input.teacherId,
    organizationId: "30000000-0000-4000-8000-000000000001",
    source: "ai_stub",
    aiProvider: "deterministic-local-stub",
    aiPrompt: input.prompt,
    title: `AI Draft: ${input.prompt.slice(0, 40)}`,
    description: null,
    status: "personal_draft",
    questions,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    approvedAt: null,
    approvedByAdminId: null,
    rejectedAt: null,
    rejectedByAdminId: null,
    rejectionReason: null,
  };
  _tests.push(record);
  return record;
}

export function submitTestToSchool(input: { teacherId: string; testId: string }): void {
  const test = _tests.find((t) => t.id === input.testId);
  if (test) {
    test.status = "pending_school";
    test.submittedAt = new Date().toISOString();
  }
}

export function approveSchoolTest(input: { testId: string; adminId: string }): void {
  const test = _tests.find((t) => t.id === input.testId);
  if (test) {
    test.status = "approved_school";
    test.approvedAt = new Date().toISOString();
    test.approvedByAdminId = input.adminId;
  }
}

export function updateTeacherDraftTest(input: {
  teacherId: string;
  testId: string;
  title: string;
  description: string;
  questions: Array<{ prompt: string; answer: string; explanation: string }>;
}): void {
  const test = _tests.find((t) => t.id === input.testId);
  if (test) {
    test.title = input.title;
    test.description = input.description;
    test.questions = input.questions.map((q, i) => ({
      id: test.questions[i]?.id ?? `q-${crypto.randomUUID()}`,
      ...q,
    }));
    test.updatedAt = new Date().toISOString();
  }
}

export function listTeacherTests(_teacherId: string): TeacherTestSummary[] {
  return _tests.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    organizationId: t.organizationId,
    organizationName: "Demo School",
    source: t.source,
    aiProvider: t.aiProvider,
    status: t.status,
    questionCount: t.questions.length,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    submittedAt: t.submittedAt,
    approvedAt: t.approvedAt,
    rejectedAt: t.rejectedAt,
    rejectionReason: t.rejectionReason,
    canEdit: t.status === "personal_draft",
    canSubmitToSchool: t.status === "personal_draft",
    visibleInSchoolLibrary: t.status === "approved_school",
  }));
}

export function listPendingSchoolTestApprovals(): PendingSchoolTestApproval[] {
  return _tests
    .filter((t) => t.status === "pending_school")
    .map((t) => ({
      testId: t.id,
      title: t.title,
      description: t.description,
      organizationId: t.organizationId,
      organizationName: "Demo School",
      requestedByTeacherId: t.teacherId,
      requestedByTeacherName: "Demo Teacher",
      requestedByTeacherEmail: "teacher@platform.local",
      submittedAt: t.submittedAt!,
      questionCount: t.questions.length,
      source: t.source,
    }));
}

export function listTeacherSchoolLibraryTests(_teacherId: string): SchoolLibraryTest[] {
  return _tests
    .filter((t) => t.status === "approved_school")
    .map((t) => ({
      testId: t.id,
      title: t.title,
      description: t.description,
      organizationId: t.organizationId,
      organizationName: "Demo School",
      ownerTeacherId: t.teacherId,
      ownerTeacherName: "Demo Teacher",
      approvedAt: t.approvedAt!,
      questionCount: t.questions.length,
    }));
}

export function getTeacherTestDetail(input: { teacherId: string; testId: string }): TeacherTestDetail {
  const test = _tests.find((t) => t.id === input.testId);
  if (!test) throw new Error(`Test not found: ${input.testId}`);
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    organizationId: test.organizationId,
    organizationName: "Demo School",
    source: test.source,
    aiProvider: test.aiProvider,
    status: test.status,
    questionCount: test.questions.length,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    submittedAt: test.submittedAt,
    approvedAt: test.approvedAt,
    rejectedAt: test.rejectedAt,
    rejectionReason: test.rejectionReason,
    canEdit: test.status === "personal_draft",
    canSubmitToSchool: test.status === "personal_draft",
    visibleInSchoolLibrary: test.status === "approved_school",
    aiPrompt: test.aiPrompt,
    questions: test.questions,
  };
}
