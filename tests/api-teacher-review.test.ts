import { beforeEach, describe, expect, mock, test } from "bun:test";

import { GET as teacherReviewGet, POST as teacherReviewSavePost } from "@/app/api/v1/teacher/assignment-results/[assignmentResultId]/review/route";
import { POST as teacherReviewReleasePost } from "@/app/api/v1/teacher/assignment-results/[assignmentResultId]/review/release/route";

type AuthenticatedSession = {
  userId: string;
  role: "student" | "teacher" | "admin";
  displayName: string;
  loginIdentifier?: string;
};

let currentSupabaseClient: Record<string, unknown> = {};
let currentSession: AuthenticatedSession | null = null;

mock.module("@/lib/auth/session", () => ({
  getAuthSession: mock(() => Promise.resolve(currentSession)),
  writeAuthSession: mock(() => Promise.resolve()),
  clearAuthSession: mock(() => Promise.resolve()),
}));

mock.module("@/lib/supabase/server-client", () => ({
  createServerClient: () => currentSupabaseClient,
}));

function buildTeacherReviewSupabase(config: {
  resultData?: Record<string, unknown> | null;
  pubClassData?: Record<string, unknown> | null;
  classTeacher?: Record<string, unknown> | null;
  reviewData?: Record<string, unknown> | null;
  gradeRecord?: Record<string, unknown> | null;
  submissionFiles?: Array<Record<string, unknown>>;
  testAttempt?: Record<string, unknown> | null;
  existingPrimaryComment?: Record<string, unknown> | null;
  createdReview?: Record<string, unknown> | null;
  calls?: {
    reviewUpdates?: Array<Record<string, unknown>>;
    resultUpdates?: Array<Record<string, unknown>>;
    commentUpdates?: Array<Record<string, unknown>>;
    commentInserts?: Array<Record<string, unknown>>;
    reviewInserts?: Array<Record<string, unknown>>;
    notifications?: Array<Record<string, unknown>>;
  };
}) {
  return {
    from: mock((table: string) => {
      if (table === "assignment_results") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          is: mock(function () { return selectChain; }),
          maybeSingle: mock(() => Promise.resolve({ data: config.resultData ?? null, error: null })),
        };

        return {
          select: mock(() => selectChain),
          update: mock((payload: Record<string, unknown>) => ({
            eq: mock(() => {
              config.calls?.resultUpdates?.push(payload);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }

      if (table === "assignment_publication_classes") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          maybeSingle: mock(() => Promise.resolve({ data: config.pubClassData ?? null, error: null })),
        };

        return {
          select: mock(() => selectChain),
        };
      }

      if (table === "class_teachers") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          is: mock(function () { return selectChain; }),
          maybeSingle: mock(() => Promise.resolve({ data: config.classTeacher ?? null, error: null })),
        };

        return {
          select: mock(() => selectChain),
        };
      }

      if (table === "submission_reviews") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          is: mock(function () { return selectChain; }),
          maybeSingle: mock(() => Promise.resolve({ data: config.reviewData ?? null, error: null })),
        };

        return {
          select: mock(() => selectChain),
          insert: mock((payload: Record<string, unknown>) => {
            config.calls?.reviewInserts?.push(payload);
            return {
              select: mock(() => ({
                single: mock(() => Promise.resolve({
                  data: config.createdReview ?? { id: "review-new", created_at: "2026-01-01T00:00:00Z" },
                  error: null,
                })),
              })),
            };
          }),
          update: mock((payload: Record<string, unknown>) => ({
            eq: mock(() => {
              config.calls?.reviewUpdates?.push(payload);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }

      if (table === "review_comments") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          is: mock(function () { return selectChain; }),
          order: mock(() => ({
            limit: mock(() => ({
              maybeSingle: mock(() => Promise.resolve({ data: config.existingPrimaryComment ?? null, error: null })),
            })),
          })),
        };

        return {
          select: mock(() => selectChain),
          update: mock((payload: Record<string, unknown>) => ({
            eq: mock(() => {
              config.calls?.commentUpdates?.push(payload);
              return Promise.resolve({ error: null });
            }),
          })),
          insert: mock((payload: Record<string, unknown>) => {
            config.calls?.commentInserts?.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
      }

      if (table === "grade_records") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          is: mock(function () { return selectChain; }),
          maybeSingle: mock(() => Promise.resolve({ data: config.gradeRecord ?? null, error: null })),
        };

        return {
          select: mock(() => selectChain),
        };
      }

      if (table === "submission_files") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          is: mock(function () { return selectChain; }),
          order: mock(() => Promise.resolve({ data: config.submissionFiles ?? [], error: null })),
        };

        return {
          select: mock(() => selectChain),
        };
      }

      if (table === "test_attempts") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          is: mock(function () { return selectChain; }),
          maybeSingle: mock(() => Promise.resolve({ data: config.testAttempt ?? null, error: null })),
        };

        return {
          select: mock(() => selectChain),
        };
      }

      if (table === "notifications") {
        return {
          insert: mock((payload: Record<string, unknown>) => {
            config.calls?.notifications?.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    }),
  };
}

describe("Teacher review APIs", () => {
  beforeEach(() => {
    currentSession = {
      userId: "20000000-0000-4000-8000-000000000002",
      role: "teacher",
      displayName: "Demo Teacher",
      loginIdentifier: "teacher@platform.local",
    };
  });

  test("GET review returns classInfo and practiceSubmittedAt", async () => {
    currentSupabaseClient = buildTeacherReviewSupabase({
      resultData: {
        id: "result-1",
        assignment_publication_class_id: "pub-class-1",
        practice_submitted_at: "2026-01-16T08:40:00Z",
        test_submitted_at: null,
        class_enrollments: {
          student_profiles: {
            id: "student-1",
            display_name: "Mira Volkova",
            student_login: "ST-100002",
          },
        },
      },
      pubClassData: {
        class_id: "class-1",
        classes: { id: "class-1", title: "Engineering Graphics 8A" },
        assignment_publications: {
          assignment_templates: {
            id: "template-1",
            title: "Orthographic Projection Basics",
            description: "Deterministic fixture assignment",
            linked_test_id: null,
          },
        },
      },
      classTeacher: { id: "teacher-link-1" },
      reviewData: null,
      gradeRecord: null,
      submissionFiles: [],
      testAttempt: null,
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-results/result-1/review");
    const context = { params: Promise.resolve({ assignmentResultId: "result-1" }) };
    const response = await teacherReviewGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect((data.classInfo as Record<string, unknown>).title).toBe("Engineering Graphics 8A");
    expect(data.practiceSubmittedAt).toBe("2026-01-16T08:40:00Z");
  });

  test("POST review creates draft review and primary teacher comment", async () => {
    const calls = {
      reviewInserts: [] as Array<Record<string, unknown>>,
      commentInserts: [] as Array<Record<string, unknown>>,
    };

    currentSupabaseClient = buildTeacherReviewSupabase({
      resultData: { id: "result-1", assignment_publication_class_id: "pub-class-1" },
      pubClassData: { class_id: "class-1" },
      classTeacher: { id: "teacher-link-1" },
      reviewData: null,
      existingPrimaryComment: null,
      createdReview: { id: "review-new", created_at: "2026-01-01T00:00:00Z" },
      calls,
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-results/result-1/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "Teacher draft comment" }),
    });
    const context = { params: Promise.resolve({ assignmentResultId: "result-1" }) };
    const response = await teacherReviewSavePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(calls.reviewInserts).toHaveLength(1);
    expect(calls.commentInserts).toHaveLength(1);
    expect(calls.commentInserts[0].body).toBe("Teacher draft comment");
  });

  test("POST review clears existing primary teacher comment when comment is empty", async () => {
    const calls = {
      commentUpdates: [] as Array<Record<string, unknown>>,
    };

    currentSupabaseClient = buildTeacherReviewSupabase({
      resultData: { id: "result-1", assignment_publication_class_id: "pub-class-1" },
      pubClassData: { class_id: "class-1" },
      classTeacher: { id: "teacher-link-1" },
      reviewData: { id: "review-1", status: "draft", reviewed_by_teacher_id: currentSession!.userId, created_at: "2026-01-01T00:00:00Z" },
      existingPrimaryComment: { id: "comment-1" },
      calls,
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-results/result-1/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "" }),
    });
    const context = { params: Promise.resolve({ assignmentResultId: "result-1" }) };
    const response = await teacherReviewSavePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(calls.commentUpdates).toHaveLength(1);
    expect(calls.commentUpdates[0].deleted_at).toBeDefined();
  });

  test("POST release updates review, assignment result, and clears comment when comment is empty", async () => {
    const calls = {
      reviewUpdates: [] as Array<Record<string, unknown>>,
      resultUpdates: [] as Array<Record<string, unknown>>,
      commentUpdates: [] as Array<Record<string, unknown>>,
      notifications: [] as Array<Record<string, unknown>>,
    };

    currentSupabaseClient = buildTeacherReviewSupabase({
      resultData: {
        id: "result-1",
        assignment_publication_class_id: "pub-class-1",
        class_enrollments: {
          student_profiles: { id: "student-1", display_name: "Mira Volkova" },
        },
      },
      pubClassData: { class_id: "class-1" },
      classTeacher: { id: "teacher-link-1" },
      reviewData: { id: "review-1", status: "draft", reviewed_by_teacher_id: currentSession!.userId },
      existingPrimaryComment: { id: "comment-1" },
      calls,
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-results/result-1/review/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyStudent: true, comment: "" }),
    });
    const context = { params: Promise.resolve({ assignmentResultId: "result-1" }) };
    const response = await teacherReviewReleasePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(calls.reviewUpdates).toHaveLength(1);
    expect(calls.reviewUpdates[0].status).toBe("released");
    expect(calls.resultUpdates).toHaveLength(1);
    expect(calls.resultUpdates[0].status).toBe("released");
    expect(calls.commentUpdates).toHaveLength(1);
    expect(calls.commentUpdates[0].deleted_at).toBeDefined();
    expect(calls.notifications).toHaveLength(1);
    expect(calls.notifications[0].type).toBe("review_released");
  });
});
