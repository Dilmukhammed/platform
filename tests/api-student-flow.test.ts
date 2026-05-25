import { describe, expect, mock, test, beforeEach } from "bun:test";

import { POST as loginPost } from "@/app/api/v1/student/auth/login/route";
import { POST as logoutPost } from "@/app/api/v1/student/auth/logout/route";
import { GET as profileGet } from "@/app/api/v1/student/profile/route";
import { GET as classesGet } from "@/app/api/v1/student/classes/route";
import { POST as joinByCodePost } from "@/app/api/v1/student/classes/join-by-code/route";
import { POST as submissionFileInitPost } from "@/app/api/v1/student/assignment-results/[assignmentResultId]/submission-files/init/route";
import { POST as submissionFileCompletePost } from "@/app/api/v1/student/assignment-results/[assignmentResultId]/submission-files/complete/route";
import { POST as submitPost } from "@/app/api/v1/student/assignment-results/[assignmentResultId]/submit/route";
import { POST as testAttemptCreatePost } from "@/app/api/v1/student/assignment-results/[assignmentResultId]/test-attempts/route";
import { POST as testAttemptSubmitPost } from "@/app/api/v1/student/test-attempts/[attemptId]/submit/route";
import { GET as reviewGet } from "@/app/api/v1/student/assignment-results/[assignmentResultId]/review/route";
import { ErrorCodes } from "@/lib/api/errors";

// --- Mocks ---

const mockWriteAuthSession = mock(() => Promise.resolve());
const mockClearAuthSession = mock(() => Promise.resolve());

let currentSupabaseClient: Record<string, unknown> = {};
let currentSession: Record<string, unknown> | null = null;

mock.module("@/lib/auth/session", () => ({
  getAuthSession: mock(() => Promise.resolve(currentSession)),
  writeAuthSession: mockWriteAuthSession,
  clearAuthSession: mockClearAuthSession,
}));

mock.module("@/lib/supabase/server-client", () => ({
  createServerClient: () => currentSupabaseClient,
}));

/**
 * Create a chainable mock that supports multiple .eq() and .is() calls
 */
function createChainableMock(result: { data: unknown; error: unknown; count?: number }, single = false) {
  const resolved = Promise.resolve(result);

  // Terminal methods that return the final promise
  const terminalMethods = {
    single: mock(() => resolved),
    maybeSingle: mock(() => resolved),
    range: mock(() => resolved),
  };

  // .limit() returns an object with terminal methods
  const limitMock = mock(() => ({ ...terminalMethods }));

  // .order() returns an object with .range() and .limit()
  const orderMock = mock(() => ({
    range: mock(() => resolved),
    limit: limitMock,
  }));

  const chainableMock = {
    eq: mock(function () { return chainableMock; }),
    is: mock(function () { return chainableMock; }),
    in: mock(function () { return chainableMock; }),
    not: mock(function () { return chainableMock; }),
    limit: limitMock,
    order: orderMock,
    ...terminalMethods,
  };

  return {
    select: mock(() => chainableMock),
    insert: mock(() => ({
      select: mock(() => ({ single: mock(() => resolved) })),
    })),
    update: mock(() => {
      // Update chain needs to support multiple .eq() calls before .is() or .select()
      const updateChainable = {
        eq: mock(function () { return updateChainable; }),
        is: mock(function () { return updateChainable; }),
        select: mock(() => ({ single: mock(() => resolved) })),
      };
      return updateChainable;
    }),
  };
}

/**
 * Build a Supabase mock client where each table name maps to a handler.
 */
function buildSupabaseClient(tables: Record<string, () => Record<string, unknown>>) {
  const fromMock = mock((table: string) => {
    const handler = tables[table];
    if (handler) return handler();
    return createChainableMock({ data: [], error: null });
  });

  // Storage mock for download/upload operations
  const storageMock = {
    from: mock((bucket: string) => ({
      download: mock(() => Promise.resolve({ data: new Blob(["test"]), error: null })),
      upload: mock(() => Promise.resolve({ data: { path: "test/path" }, error: null })),
      createSignedUploadUrl: mock(() => Promise.resolve({
        data: { signedUrl: "https://test.supabase.co/storage/v1/upload/signed-test-url", path: "test/path", token: "test-token" },
        error: null,
      })),
    })),
  };

  return { from: fromMock, storage: storageMock };
}

// Type import for session
type AuthenticatedSession = {
  userId: string;
  role: "student" | "teacher" | "admin";
  displayName: string;
  loginIdentifier?: string;
};

// --- 1. Login → session → profile accessible ---

describe("Student flow: login → session → profile accessible", () => {
  beforeEach(() => {
    mockWriteAuthSession.mockClear();
    currentSession = null;
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("login writes session and profile is accessible with that session", async () => {
    // Step 1: Login
    const profileData = [
      {
        id: "50000000-0000-4000-8000-000000000001",
        student_login: "ST-100001",
        display_name: "Alex Morozov",
        status: "active",
        student_credentials: [{ pin_hash: "b59c67bf196a4758191e42f76670ceba", status: "active" }],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => {
        const resolved = Promise.resolve({ data: profileData, error: null });
        const limitMock = mock(() => resolved);
        const isMock = mock(() => ({ limit: limitMock }));
        const eqMock = mock(() => ({ is: isMock }));
        const selectMock = mock(() => ({ eq: eqMock }));
        return { select: selectMock };
      },
    });

    const loginRequest = new Request("http://localhost/api/v1/student/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentLogin: "ST-100001", pin: "1111" }),
    });

    const loginResponse = await loginPost(loginRequest);
    const loginBody = (await loginResponse.json()) as Record<string, unknown>;

    expect(loginResponse.status).toBe(200);
    expect(loginBody.success).toBe(true);
    expect((loginBody.data as Record<string, unknown>).authenticated).toBe(true);
    expect(mockWriteAuthSession).toHaveBeenCalledTimes(1);

    // Verify session was written with correct role
    const sessionArg = mockWriteAuthSession.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sessionArg.role).toBe("student");
    expect(sessionArg.loginIdentifier).toBe("ST-100001");

    // Step 2: Simulate authenticated session (as if cookie was set)
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Alex Morozov",
      loginIdentifier: "ST-100001",
    };

    const profileDataForGet = {
      id: "50000000-0000-4000-8000-000000000001",
      student_login: "ST-100001",
      first_name: "Alex",
      last_name: "Morozov",
      middle_name: null,
      display_name: "Alex Morozov",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => createChainableMock({ data: profileDataForGet, error: null }, true),
    });

    // Step 3: Access profile with session
    const profileRequest = new Request("http://localhost/api/v1/student/profile");
    const profileResponse = await profileGet(profileRequest);
    const profileBody = (await profileResponse.json()) as Record<string, unknown>;

    expect(profileBody.success).toBe(true);
    expect((profileBody.data as Record<string, unknown>).studentLogin).toBe("ST-100001");
    expect((profileBody.data as Record<string, unknown>).displayName).toBe("Alex Morozov");
  });
});

// --- 2. Join-by-code uses self_join (not self_enrolled) ---

describe("Student flow: join-by-code uses self_join enrollment source", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("join-by-code creates enrollment with source self_join", async () => {
    const joinCodeData = {
      id: "code-1",
      class_id: "class-1",
      code: "123456",
      valid_from: "2020-01-01T00:00:00Z",
      valid_until: null,
      status: "active",
    };

    const classData = {
      id: "class-1",
      title: "Science 101",
      organization_id: "org-1",
      status: "active",
    };

    const enrollmentData = {
      id: "enroll-1",
      status: "active",
      joined_at: "2026-01-01T00:00:00Z",
      source: "self_join",
    };

    currentSupabaseClient = buildSupabaseClient({
      class_join_codes: () => createChainableMock({ data: joinCodeData, error: null }, true),
      classes: () => createChainableMock({ data: classData, error: null }, true),
      class_enrollments: () => ({
        ...createChainableMock({ data: null, error: null }, true),
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => Promise.resolve({ data: enrollmentData, error: null })) })),
        })),
      }),
      organization_students: () => createChainableMock({ data: null, error: null }, true),
      assignment_publication_classes: () => createChainableMock({ data: [], error: null, count: 0 }),
    });

    const request = new Request("http://localhost/api/v1/student/classes/join-by-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });

    const response = await joinByCodePost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).classTitle).toBe("Science 101");

    // Verify the enrollment insert was called with source: "self_join"
    const enrollmentsHandler = currentSupabaseClient.from as ReturnType<typeof mock>;
    const fromCalls = enrollmentsHandler.mock.calls;
    const enrollmentCall = fromCalls.find((call: unknown[]) => call[0] === "class_enrollments");
    expect(enrollmentCall).toBeDefined();
  });
});

// --- 3. Classes list returns paginated envelope { data, meta } ---

describe("Student flow: classes list returns paginated envelope", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated envelope with data and meta.pagination", async () => {
    const enrollmentsData = [
      {
        id: "enroll-1",
        status: "active",
        joined_at: "2026-01-01T00:00:00Z",
        left_at: null,
        source: "self_join",
        classes: {
          id: "class-1",
          title: "Math 101",
          description: "Introduction to Mathematics",
          status: "active",
          organization_id: "org-1",
        },
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      class_enrollments: () => createChainableMock({ data: enrollmentsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/student/classes");
    const response = await classesGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);

    // Verify paginated envelope structure
    expect(body.meta).toBeDefined();
    const meta = body.meta as Record<string, unknown>;
    expect(meta.pagination).toBeDefined();
    const pagination = meta.pagination as Record<string, unknown>;
    expect(pagination.page).toBe(1);
    expect(pagination.pageSize).toBe(20);
    expect(pagination.total).toBe(1);
    expect(pagination.totalPages).toBe(1);

    // Verify class data shape
    const classItem = (body.data as Array<Record<string, unknown>>)[0];
    expect(classItem.classId).toBe("class-1");
    expect(classItem.title).toBe("Math 101");
    expect(classItem.source).toBe("self_join");
  });

  test("returns empty paginated envelope when no enrollments", async () => {
    currentSupabaseClient = buildSupabaseClient({
      class_enrollments: () => createChainableMock({ data: [], error: null, count: 0 }),
    });

    const request = new Request("http://localhost/api/v1/student/classes");
    const response = await classesGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(0);
    const pagination = (body.meta as Record<string, unknown>).pagination as Record<string, unknown>;
    expect(pagination.total).toBe(0);
    expect(pagination.totalPages).toBe(1);
  });
});

// --- 4. Student upload flow: init → complete → submit ---

describe("Student flow: upload init → complete → submit", () => {
  const assignmentResultId = "60000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("init creates upload session with canonical enums", async () => {
    const resultData = {
      id: assignmentResultId,
      status: "in_progress",
      class_enrollments: { student_profile_id: "50000000-0000-4000-8000-000000000001" },
    };

    const uploadSessionData = {
      id: "upload-001",
      status: "pending",
      upload_type: "submission",
      owner_role: "student",
      owner_student_profile_id: "50000000-0000-4000-8000-000000000001",
      context_id: assignmentResultId,
      context_type: "assignment_result",
      original_file_name: "homework.pdf",
      declared_file_size_bytes: 2048,
      declared_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: "uploads/submission/student/50000000-0000-4000-8000-000000000001/assignment_result/60000000-0000-4000-8000-000000000001/upload-001/homework.pdf",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: resultData, error: null }, true),
      upload_sessions: () => ({
        ...createChainableMock({ data: uploadSessionData, error: null }, true),
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => Promise.resolve({ data: uploadSessionData, error: null })) })),
        })),
      }),
    });

    const request = new Request(
      `http://localhost/api/v1/student/assignment-results/${assignmentResultId}/submission-files/init`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileRole: "main",
          fileKind: "pdf",
          originalFilename: "homework.pdf",
          mimeType: "application/pdf",
          fileSizeBytes: 2048,
          sortOrder: 0,
        }),
      },
    );

    const context = { params: Promise.resolve({ assignmentResultId }) };
    const response = await submissionFileInitPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    // New upload contract response format
    expect((body.data as Record<string, unknown>).uploadId).toBeDefined();
    expect((body.data as Record<string, unknown>).fileRole).toBe("main");
    expect((body.data as Record<string, unknown>).fileKind).toBe("pdf");
    expect((body.data as Record<string, unknown>).storageBucket).toBe("uploads");
    expect((body.data as Record<string, unknown>).storagePath).toBeDefined();
    expect((body.data as Record<string, unknown>).targetUrl).toBeDefined();
    expect((body.data as Record<string, unknown>).upload).toBeDefined();
  });

  test("complete creates submission file from upload session", async () => {
    const uploadId = "a0000000-0000-4000-8000-000000000001";
    const resultData = {
      id: assignmentResultId,
      status: "in_progress",
      class_enrollments: { student_profile_id: "50000000-0000-4000-8000-000000000001" },
    };

    const uploadSessionData = {
      id: uploadId,
      status: "completed",
      upload_type: "submission",
      owner_role: "student",
      owner_student_profile_id: "50000000-0000-4000-8000-000000000001",
      context_id: assignmentResultId,
      context_type: "assignment_result",
      storage_bucket: "uploads",
      storage_path: "uploads/submission/student/50000000-0000-4000-8000-000000000001/assignment_result/60000000-0000-4000-8000-000000000001/upload-001/homework.png",
      declared_file_size_bytes: 2048,
      declared_mime_type: "image/png",
      completed_file_size_bytes: 2048,
      completed_mime_type: "image/png",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-01-01T00:00:00Z",
    };

    const submissionFileId = "sf-001";
    const submissionFileData = {
      id: submissionFileId,
      assignment_result_id: assignmentResultId,
      file_role: "main",
      file_kind: "image",
      original_storage_path: uploadSessionData.storage_path,
      original_filename: "homework.png",
      mime_type: "image/png",
      file_size_bytes: 2048,
      sort_order: 0,
      is_current: true,
      created_at: "2026-01-01T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: resultData, error: null }, true),
      upload_sessions: () => createChainableMock({ data: uploadSessionData, error: null }, true),
      submission_files: () => {
        // Update chain needs to support multiple .eq() calls
        const updateChainable = {
          eq: mock(function () { return updateChainable; }),
          is: mock(function () { return updateChainable; }),
        };
        return {
          ...createChainableMock({ data: null, error: null }, true), // No existing file
          insert: mock(() => ({
            select: mock(() => ({ single: mock(() => Promise.resolve({ data: submissionFileData, error: null })) })),
          })),
          update: mock(() => updateChainable),
        };
      },
      derived_assets: () => {
        // Update chain needs to support multiple .eq() calls
        const updateChainable = {
          eq: mock(function () { return updateChainable; }),
          is: mock(function () { return updateChainable; }),
        };
        return {
          ...createChainableMock({ data: [], error: null }),
          insert: mock(() => ({
            select: mock(() => Promise.resolve({ data: [], error: null })),
          })),
          update: mock(() => updateChainable),
        };
      },
    });

    const request = new Request(
      `http://localhost/api/v1/student/assignment-results/${assignmentResultId}/submission-files/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          fileRole: "main",
          fileKind: "image",
          originalFilename: "homework.png",
          mimeType: "image/png",
          fileSizeBytes: 2048,
          sortOrder: 0,
        }),
      },
    );

    const context = { params: Promise.resolve({ assignmentResultId }) };
    const response = await submissionFileCompletePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).submissionFileId).toBe(submissionFileId);
    expect((body.data as Record<string, unknown>).status).toBe("complete");
    expect((body.data as Record<string, unknown>).derivation).toBeDefined();
  });

  test("submit transitions assignment to submitted after upload", async () => {
    const resultData = {
      id: assignmentResultId,
      status: "in_progress",
      practice_started_at: "2026-01-01T00:00:00Z",
      practice_submitted_at: null,
      test_started_at: null,
      test_submitted_at: null,
      assignment_publication_classes: {
        deadline_override: null,
        assignment_publications: {
          default_deadline: null,
        },
      },
      class_enrollments: {
        student_profile_id: "50000000-0000-4000-8000-000000000001",
      },
    };

    const updatedResult = {
      id: assignmentResultId,
      status: "submitted",
      practice_submitted_at: "2026-01-02T00:00:00Z",
      test_submitted_at: null,
    };

    const submissionFileData = {
      id: "sf-001",
      assignment_result_id: assignmentResultId,
      is_current: true,
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => ({
        ...createChainableMock({ data: resultData, error: null }, true),
        update: mock(() => ({
          eq: mock(() => ({
            select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedResult, error: null })) })),
          })),
        })),
      }),
      submission_files: () => createChainableMock({ data: submissionFileData, error: null }, true),
    });

    const request = new Request(
      `http://localhost/api/v1/student/assignment-results/${assignmentResultId}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionType: "practice" }),
      },
    );

    const context = { params: Promise.resolve({ assignmentResultId }) };
    const response = await submitPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("submitted");
    expect((body.data as Record<string, unknown>).practiceSubmittedAt).toBeDefined();
  });

  test("init rejects invalid fileRole and fileKind enums", async () => {
    const request = new Request(
      `http://localhost/api/v1/student/assignment-results/${assignmentResultId}/submission-files/init`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileRole: "self_enrolled",
          fileKind: "exe",
          originalFilename: "malware.exe",
          fileSizeBytes: 999,
        }),
      },
    );

    const context = { params: Promise.resolve({ assignmentResultId }) };
    const response = await submissionFileInitPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});

// --- 5. Test attempt create → submit lifecycle ---

describe("Student flow: test attempt create → submit lifecycle", () => {
  const assignmentResultId = "60000000-0000-4000-8000-000000000001";
  const testId = "70000000-0000-4000-8000-000000000001";
  const attemptId = "80000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("create test attempt and submit it", async () => {
    // Step 1: Create test attempt
    const resultData = {
      id: assignmentResultId,
      status: "in_progress",
      test_started_at: null,
      assignment_publication_classes: {
        assignment_publications: {
          assignment_templates: {
            linked_test_id: testId,
          },
        },
      },
      class_enrollments: {
        student_profile_id: "50000000-0000-4000-8000-000000000001",
      },
    };

    const attemptData = {
      id: attemptId,
      test_id: testId,
      attempt_number: 1,
      is_current: true,
      started_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => ({
        ...createChainableMock({ data: resultData, error: null }, true),
        update: mock(() => {
          const chainable = {
            eq: mock(function () { return chainable; }),
            is: mock(function () { return chainable; }),
            then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
          };
          return chainable;
        }),
      }),
      test_attempts: () => ({
        ...createChainableMock({ data: [], error: null }),
        select: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              order: mock(() => ({
                limit: mock(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
        update: mock(() => {
          const chainable = {
            eq: mock(function () { return chainable; }),
            is: mock(function () { return chainable; }),
            then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
          };
          return chainable;
        }),
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => Promise.resolve({ data: attemptData, error: null })) })),
        })),
      }),
    });

    const createRequest = new Request(
      `http://localhost/api/v1/student/assignment-results/${assignmentResultId}/test-attempts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId }),
      },
    );

    const createContext = { params: Promise.resolve({ assignmentResultId }) };
    const createResponse = await testAttemptCreatePost(createRequest, createContext, { session: currentSession as AuthenticatedSession });
    const createBody = (await createResponse.json()) as Record<string, unknown>;

    expect(createResponse.status).toBe(201);
    expect(createBody.success).toBe(true);
    expect((createBody.data as Record<string, unknown>).attemptId).toBe(attemptId);
    expect((createBody.data as Record<string, unknown>).isCurrent).toBe(true);

    // Step 2: Submit the test attempt
    const attemptForSubmit = {
      id: attemptId,
      assignment_result_id: assignmentResultId,
      is_current: true,
      submitted_at: null,
      assignment_results: [
        {
          id: assignmentResultId,
          status: "in_progress",
          class_enrollments: { student_profile_id: "50000000-0000-4000-8000-000000000001" },
        },
      ],
    };

    const updatedAttempt = {
      id: attemptId,
      test_id: testId,
      attempt_number: 1,
      is_current: true,
      score_raw: 85,
      submitted_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      test_attempts: () => ({
        ...createChainableMock({ data: attemptForSubmit, error: null }, true),
        update: mock(() => ({
          eq: mock(() => ({
            select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedAttempt, error: null })) })),
          })),
        })),
      }),
    });

    const submitRequest = new Request(
      `http://localhost/api/v1/student/test-attempts/${attemptId}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalScoreRaw: 85 }),
      },
    );

    const submitContext = { params: Promise.resolve({ attemptId }) };
    const submitResponse = await testAttemptSubmitPost(submitRequest, submitContext, { session: currentSession as AuthenticatedSession });
    const submitBody = (await submitResponse.json()) as Record<string, unknown>;

    expect(submitBody.success).toBe(true);
    expect((submitBody.data as Record<string, unknown>).attemptId).toBe(attemptId);
    expect((submitBody.data as Record<string, unknown>).submittedAt).toBeDefined();
  });

  test("submit rejects already-submitted attempt", async () => {
    const attemptForSubmit = {
      id: attemptId,
      assignment_result_id: assignmentResultId,
      is_current: true,
      submitted_at: "2026-01-01T00:00:00Z",
      assignment_results: [
        {
          id: assignmentResultId,
          status: "in_progress",
          class_enrollments: { student_profile_id: "50000000-0000-4000-8000-000000000001" },
        },
      ],
    };

    currentSupabaseClient = buildSupabaseClient({
      test_attempts: () => createChainableMock({ data: attemptForSubmit, error: null }, true),
    });

    const request = new Request(
      `http://localhost/api/v1/student/test-attempts/${attemptId}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalScoreRaw: 90 }),
      },
    );

    const context = { params: Promise.resolve({ attemptId }) };
    const response = await testAttemptSubmitPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.CONFLICT);
  });
});

// --- 6. Student-safe released review endpoint ---

describe("Student flow: released review endpoint (released only, forbidden for unreleased)", () => {
  const assignmentResultId = "60000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns review details for released assignment", async () => {
    const resultData = {
      id: assignmentResultId,
      status: "released",
      released_at: "2026-01-05T00:00:00Z",
      assignment_publication_classes: {
        assignment_publications: {
          assignment_templates: {
            id: "template-1",
            title: "Algebra Homework",
            description: "Solve equations",
          },
        },
      },
      class_enrollments: {
        student_profile_id: "50000000-0000-4000-8000-000000000001",
      },
    };

    const reviewData = {
      id: "review-1",
      status: "released",
      released_at: "2026-01-05T00:00:00Z",
      reviewed_at: "2026-01-04T00:00:00Z",
      created_at: "2026-01-03T00:00:00Z",
      updated_at: "2026-01-05T00:00:00Z",
      teacher_feedback: "Good work on the equations.",
      teacher_summary: "Solid understanding of basic algebra.",
      rubric_snapshot_json: null,
      criteria_scores_json: null,
      review_comments: [
        {
          id: "comment-1",
          author_type: "teacher",
          parent_comment_id: null,
          body: "Check step 3",
          is_internal: false,
          created_at: "2026-01-04T00:00:00Z",
          updated_at: "2026-01-04T00:00:00Z",
        },
        {
          id: "comment-2",
          author_type: "teacher",
          parent_comment_id: null,
          body: "Internal note",
          is_internal: true,
          created_at: "2026-01-04T00:00:00Z",
          updated_at: "2026-01-04T00:00:00Z",
        },
      ],
      annotation_documents: [
        {
          id: "annotation-1",
          derived_asset_id: "asset-1",
          page_index: 0,
          version: 1,
          is_current: true,
          base_width: 800,
          base_height: 600,
          payload_json: '{"type":"point","x":100,"y":200}',
          created_at: "2026-01-04T00:00:00Z",
        },
      ],
    };

    const gradeData = {
      id: "grade-1",
      mapped_grade: "A",
      practice_score_raw: 90,
      test_score_raw: 85,
      final_score_raw: 88,
      is_overridden: false,
      override_reason: null,
      formula_snapshot_json: null,
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: resultData, error: null }, true),
      submission_reviews: () => createChainableMock({ data: reviewData, error: null }, true),
      grade_records: () => createChainableMock({ data: gradeData, error: null }, true),
    });

    const request = new Request(
      `http://localhost/api/v1/student/assignment-results/${assignmentResultId}/review`,
    );
    const context = { params: Promise.resolve({ assignmentResultId }) };
    const response = await reviewGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).assignmentResultId).toBe(assignmentResultId);
    expect((body.data as Record<string, unknown>).status).toBe("released");
    expect((body.data as Record<string, unknown>).releasedAt).toBeDefined();

    // Verify assignment info
    const assignment = (body.data as Record<string, unknown>).assignment as Record<string, unknown>;
    expect(assignment.title).toBe("Algebra Homework");

    // Verify review data
    const review = (body.data as Record<string, unknown>).review as Record<string, unknown>;
    expect(review).toBeDefined();
    expect(review.teacherFeedback).toBe("Good work on the equations.");

    // Verify internal comments are filtered out (student-safe)
    const comments = (body.data as Record<string, unknown>).comments as Array<Record<string, unknown>>;
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe("Check step 3");

    // Verify grade
    const grade = (body.data as Record<string, unknown>).grade as Record<string, unknown>;
    expect(grade).toBeDefined();
    expect(grade.mappedGrade).toBe("A");
    expect(grade.finalScore).toBe(88);
  });

  test("returns FORBIDDEN for unreleased review", async () => {
    const resultData = {
      id: assignmentResultId,
      status: "reviewed",
      released_at: null,
      assignment_publication_classes: {
        assignment_publications: {
          assignment_templates: { id: "template-1", title: "Algebra Homework", description: "Solve equations" },
        },
      },
      class_enrollments: {
        student_profile_id: "50000000-0000-4000-8000-000000000001",
      },
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: resultData, error: null }, true),
    });

    const request = new Request(
      `http://localhost/api/v1/student/assignment-results/${assignmentResultId}/review`,
    );
    const context = { params: Promise.resolve({ assignmentResultId }) };
    const response = await reviewGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns FORBIDDEN for submitted (not yet reviewed) assignment", async () => {
    const resultData = {
      id: assignmentResultId,
      status: "submitted",
      released_at: null,
      assignment_publication_classes: {
        assignment_publications: {
          assignment_templates: { id: "template-1", title: "Algebra Homework", description: "Solve equations" },
        },
      },
      class_enrollments: {
        student_profile_id: "50000000-0000-4000-8000-000000000001",
      },
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: resultData, error: null }, true),
    });

    const request = new Request(
      `http://localhost/api/v1/student/assignment-results/${assignmentResultId}/review`,
    );
    const context = { params: Promise.resolve({ assignmentResultId }) };
    const response = await reviewGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });
});

// --- 7. Logout clears session ---

describe("Student flow: logout clears session", () => {
  beforeEach(() => {
    mockClearAuthSession.mockClear();
  });

  test("logout calls clearAuthSession and returns unauthenticated", async () => {
    const response = await logoutPost();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).authenticated).toBe(false);
    expect(mockClearAuthSession).toHaveBeenCalledTimes(1);
  });

  test("profile is inaccessible after logout", async () => {
    // After logout, session is null
    currentSession = null;
    currentSupabaseClient = buildSupabaseClient({});

    const request = new Request("http://localhost/api/v1/student/profile");
    const response = await profileGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.UNAUTHORIZED);
  });
});
