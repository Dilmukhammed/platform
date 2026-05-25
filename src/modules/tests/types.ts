export type TestStatus = "personal_draft" | "pending_school" | "approved_school" | "rejected_school";

export type TestSource = "manual" | "ai_stub";

export type TestQuestionRecord = {
  id: string;
  prompt: string;
  answer: string;
  explanation: string | null;
};

export type TestRecord = {
  id: string;
  teacherId: string;
  organizationId: string;
  source: TestSource;
  aiProvider: string | null;
  aiPrompt: string | null;
  title: string;
  description: string | null;
  status: TestStatus;
  questions: TestQuestionRecord[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedByAdminId: string | null;
  rejectedAt: string | null;
  rejectedByAdminId: string | null;
  rejectionReason: string | null;
};

export type TeacherTestSummary = {
  id: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  source: TestSource;
  aiProvider: string | null;
  status: TestStatus;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  canEdit: boolean;
  canSubmitToSchool: boolean;
  visibleInSchoolLibrary: boolean;
};

export type TeacherTestDetail = TeacherTestSummary & {
  aiPrompt: string | null;
  questions: TestQuestionRecord[];
};

export type PendingSchoolTestApproval = {
  testId: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  requestedByTeacherId: string;
  requestedByTeacherName: string;
  requestedByTeacherEmail: string;
  submittedAt: string;
  questionCount: number;
  source: TestSource;
};

export type SchoolLibraryTest = {
  testId: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  ownerTeacherId: string;
  ownerTeacherName: string;
  approvedAt: string;
  questionCount: number;
};

export type TestsState = {
  tests: TestRecord[];
};
