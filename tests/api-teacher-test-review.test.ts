import { beforeEach, describe, expect, mock, test } from "bun:test";

import { POST as completeReviewPost } from "@/app/api/v1/teacher/test-attempts/[attemptId]/complete-review/route";
import { ErrorCodes } from "@/lib/api/errors";

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

function buildSupabaseClient(config: {
  attempt?: Record<string, unknown> | null;
  pubClassData?: Record<string, unknown> | null;
  membership?: Record<string, unknown> | null;
  gradeRecord?: Record<string, unknown> | null;
  calls?: {
    attemptUpdates?: Array<Record<string, unknown>>;
    gradeUpdates?: Array<Record<string, unknown>>;
    gradeInserts?: Array<Record<string, unknown>>;
    resultUpdates?: Array<Record<string, unknown>>;
    notifications?: Array<Record<string, unknown>>;
  };
}) {
  return {
    from: mock((table: string) => {
      if (table === "test_attempts") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          is: mock(function () { return selectChain; }),
          maybeSingle: mock(() => Promise.resolve({ data: config.attempt ?? null, error: null })),
        };

        return {
          select: mock(() => selectChain),
          update: mock((payload: Record<string, unknown>) => ({
            eq: mock(() => {
              config.calls?.attemptUpdates?.push(payload);
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

      if (table === "organization_memberships") {
        const selectChain = {
          eq: mock(function () { return selectChain; }),
          is: mock(function () { return selectChain; }),
          maybeSingle: mock(() => Promise.resolve({ data: config.membership ?? null, error: null })),
        };

        return {
          select: mock(() => selectChain),
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
          update: mock((payload: Record<string, unknown>) => ({
            eq: mock(() => {
              config.calls?.gradeUpdates?.push(payload);
              return Promise.resolve({ error: null });
            }),
          })),
          insert: mock((payload: Record<string, unknown>) => {
            config.calls?.gradeInserts?.push(payload);
            return Promise.resolve({ error: null });
          }),
        };
      }

      if (table === "assignment_results") {
        return {
          update: mock((payload: Record<string, unknown>) => ({
            eq: mock(() => {
              config.calls?.resultUpdates?.push(payload);
              return Promise.resolve({ error: null });
            }),
          })),
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

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("Teacher test review completion API", () => {
  beforeEach(() => {
    currentSession = {
      userId: "20000000-0000-4000-8000-000000000002",
      role: "teacher",
      displayName: "Demo Teacher",
      loginIdentifier: "teacher@platform.local",
    };
  });

  test("rejects completion when text questions remain unscored", async () => {
    currentSupabaseClient = buildSupabaseClient({
      attempt: {
        id: "attempt-1",
        assignment_result_id: "result-1",
        submitted_at: "2026-01-01T00:00:00Z",
        review_completed_at: null,
        question_results: [
          { questionId: "q1", autoScored: false, score: null },
        ],
        assignment_results: {
          assignment_publication_class_id: "pub-class-1",
          class_enrollments: {
            student_profiles: { id: "student-1", display_name: "Mira Volkova" },
          },
        },
      },
      pubClassData: {
        assignment_publications: {
          assignment_templates: {
            tests: {
              id: "test-1",
              title: "Review Test",
              show_results: "after_review",
              scope_type: "personal",
              owner_teacher_id: currentSession!.userId,
              owner_organization_id: null,
            },
          },
        },
      },
    });

    const request = new Request("http://localhost/api/v1/teacher/test-attempts/attempt-1/complete-review", { method: "POST" });
    const context = { params: Promise.resolve({ attemptId: "attempt-1" }) };
    const response = await completeReviewPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("completes review, updates grade/result, and creates review_released notification when after_review", async () => {
    const calls = {
      attemptUpdates: [] as Array<Record<string, unknown>>,
      gradeUpdates: [] as Array<Record<string, unknown>>,
      gradeInserts: [] as Array<Record<string, unknown>>,
      resultUpdates: [] as Array<Record<string, unknown>>,
      notifications: [] as Array<Record<string, unknown>>,
    };

    currentSupabaseClient = buildSupabaseClient({
      attempt: {
        id: "attempt-1",
        assignment_result_id: "result-1",
        submitted_at: "2026-01-01T00:00:00Z",
        review_completed_at: null,
        question_results: [
          { questionId: "q1", autoScored: true, score: 1 },
          { questionId: "q2", autoScored: false, score: 1 },
        ],
        assignment_results: {
          assignment_publication_class_id: "pub-class-1",
          class_enrollments: {
            student_profiles: { id: "student-1", display_name: "Mira Volkova" },
          },
        },
      },
      pubClassData: {
        assignment_publications: {
          assignment_templates: {
            tests: {
              id: "test-1",
              title: "Review Test",
              show_results: "after_review",
              scope_type: "personal",
              owner_teacher_id: currentSession!.userId,
              owner_organization_id: null,
            },
          },
        },
      },
      gradeRecord: {
        id: "grade-1",
        test_score_raw: null,
      },
      calls,
    });

    const request = new Request("http://localhost/api/v1/teacher/test-attempts/attempt-1/complete-review", { method: "POST" });
    const context = { params: Promise.resolve({ attemptId: "attempt-1" }) };
    const response = await completeReviewPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).resultsReleased).toBe(true);
    expect(calls.attemptUpdates).toHaveLength(1);
    expect(calls.attemptUpdates[0].review_completed_at).toBeDefined();
    expect(calls.attemptUpdates[0].score_raw).toBe(2);
    expect(calls.gradeUpdates).toHaveLength(1);
    expect(calls.gradeUpdates[0].test_score_raw).toBe(2);
    expect(calls.resultUpdates).toHaveLength(1);
    expect(calls.resultUpdates[0].status).toBe("released");
    expect(calls.notifications).toHaveLength(1);
    expect(calls.notifications[0].type).toBe("review_released");
  });
});
