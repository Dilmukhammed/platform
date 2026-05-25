import { describe, expect, mock, test, beforeEach } from "bun:test";

import { GET as classesGet } from "@/app/api/v1/student/classes/route";
import { GET as classDetailGet } from "@/app/api/v1/student/classes/[classId]/route";
import { POST as joinByCodePost } from "@/app/api/v1/student/classes/join-by-code/route";
import { GET as assignmentsGet } from "@/app/api/v1/student/assignments/route";
import { GET as assignmentDetailGet } from "@/app/api/v1/student/assignments/[assignmentResultId]/route";
import { POST as submitPost } from "@/app/api/v1/student/assignment-results/[assignmentResultId]/submit/route";
import { POST as testAttemptPost } from "@/app/api/v1/student/assignment-results/[assignmentResultId]/test-attempts/route";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/v1/student/profile/route";
import { ErrorCodes } from "@/lib/api/errors";

// --- Mocks ---

let currentSupabaseClient: Record<string, unknown> = {};
let currentSession: Record<string, unknown> | null = null;

mock.module("@/lib/auth/session", () => ({
  getAuthSession: mock(() => Promise.resolve(currentSession)),
  writeAuthSession: mock(() => Promise.resolve()),
  clearAuthSession: mock(() => Promise.resolve()),
}));

mock.module("@/lib/supabase/server-client", () => ({
  createServerClient: () => currentSupabaseClient,
}));

/**
 * Create a chainable mock that supports multiple .eq() and .is() calls
 */
function createChainableMock(result: { data: unknown; error: unknown; count?: number }, single = false) {
  const resolved = Promise.resolve(result);
  
  // Terminal methods that return the promise
  const terminalMethods = {
    limit: mock(() => resolved),
    maybeSingle: mock(() => resolved),
    single: mock(() => resolved),
    order: mock(() => ({
      range: mock(() => resolved),
    })),
    range: mock(() => resolved),
  };

  // Chainable filter methods that return the same object
  // Make it thenable so it can be awaited directly (like Supabase JS)
  const chainableMock = {
    eq: mock(function() { return chainableMock; }),
    is: mock(function() { return chainableMock; }),
    then: (resolve: (value: unknown) => unknown) => resolved.then(resolve),
    ...terminalMethods,
  };

  return {
    select: mock(() => chainableMock),
    insert: mock(() => ({
      select: mock(() => ({ single: mock(() => resolved) })),
    })),
    update: mock(() => ({
      eq: mock(() => ({
        is: mock(() => ({
          select: mock(() => ({ single: mock(() => resolved) })),
        })),
        select: mock(() => ({ single: mock(() => resolved) })),
      })),
    })),
  };
}

/**
 * Build a Supabase mock client where each table name maps to a handler.
 */
function buildSupabaseClient(tables: Record<string, () => Record<string, unknown>>) {
  const fromMock = mock((table: string) => {
    const handler = tables[table];
    if (handler) return handler();
    // Default: empty chain
    return createChainableMock({ data: [], error: null });
  });
  return { from: fromMock };
}

// --- Student Classes Tests ---

describe("GET /api/v1/student/classes", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns UNAUTHORIZED when not authenticated", async () => {
    currentSession = null;
    const request = new Request("http://localhost/api/v1/student/classes");
    const response = await classesGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("returns paginated list of classes", async () => {
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
    expect((body.data as Array<Record<string, unknown>>)[0].title).toBe("Math 101");
  });
});

// --- Join by Code Tests ---

describe("POST /api/v1/student/classes/join-by-code", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when code is invalid", async () => {
    const request = new Request("http://localhost/api/v1/student/classes/join-by-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123" }), // Not 6 digits
    });

    const response = await joinByCodePost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("returns RESOURCE_NOT_FOUND when code doesn't exist", async () => {
    currentSupabaseClient = buildSupabaseClient({
      class_join_codes: () => createChainableMock({ data: null, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/student/classes/join-by-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "999999" }),
    });

    const response = await joinByCodePost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });

  test("successfully joins class with valid code", async () => {
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
  });
});

// --- Student Assignments Tests ---

describe("GET /api/v1/student/assignments", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of assignments", async () => {
    const resultsData = [
      {
        id: "result-1",
        status: "not_started",
        assignment_publication_classes: {
          id: "pub-class-1",
          deadline_override: null,
          class_id: "class-1",
          classes: {
            id: "class-1",
            title: "Math 101",
          },
          assignment_publications: {
            id: "pub-1",
            default_deadline: "2026-12-31T23:59:59Z",
            published_at: "2026-01-01T00:00:00Z",
            assignment_templates: {
              id: "template-1",
              title: "Algebra Homework",
              description: "Solve equations",
              has_practice: true,
              has_test: true,
            },
          },
        },
        class_enrollments: {
          student_profile_id: "50000000-0000-4000-8000-000000000001",
        },
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: resultsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/student/assignments");
    const response = await assignmentsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].assignmentTitle).toBe("Algebra Homework");
  });
});

// --- Student Assignment Detail Tests ---

describe("GET /api/v1/student/assignments/{assignmentResultId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns assignment detail with linked materials", async () => {
    const resultData = {
      id: "60000000-0000-4000-8000-000000000001",
      status: "not_started",
      practice_started_at: null,
      practice_submitted_at: null,
      test_started_at: null,
      test_submitted_at: null,
      released_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      assignment_publication_classes: {
        id: "pub-class-1",
        deadline_override: null,
        class_id: "class-1",
        classes: {
          id: "class-1",
          title: "Math 101",
          description: "Introduction to Mathematics",
        },
        assignment_publications: {
          id: "pub-1",
          default_deadline: "2026-12-31T23:59:59Z",
          published_at: "2026-01-01T00:00:00Z",
          assignment_templates: {
            id: "template-1",
            title: "Algebra Homework",
            description: "Solve equations",
            has_practice: true,
            has_test: true,
            linked_test_id: null,
          },
        },
      },
      class_enrollments: {
        id: "enroll-1",
        student_profile_id: "50000000-0000-4000-8000-000000000001",
      },
    };

    const materialsData = [
      {
        material_id: "material-1",
        materials: {
          id: "material-1",
          title: "Reference Guide",
          description: "A helpful guide for the assignment",
          source_file_path: "/uploads/materials/guide.pdf",
        },
      },
      {
        material_id: "material-2",
        materials: {
          id: "material-2",
          title: "Worksheet",
          description: null,
          source_file_path: "/uploads/materials/worksheet.pdf",
        },
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: resultData, error: null }, true),
      submission_files: () => createChainableMock({ data: [], error: null }),
      test_attempts: () => createChainableMock({ data: [], error: null }),
      assignment_template_materials: () => createChainableMock({ data: materialsData, error: null }),
    });

    const request = new Request("http://localhost/api/v1/student/assignments/60000000-0000-4000-8000-000000000001");
    const context = { params: Promise.resolve({ assignmentResultId: "60000000-0000-4000-8000-000000000001" }) };
    const response = await assignmentDetailGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).assignmentTitle).toBe("Algebra Homework");
    expect(Array.isArray((body.data as Record<string, unknown>).linkedMaterials)).toBe(true);
    expect((body.data as Record<string, unknown>).linkedMaterials).toHaveLength(2);
    
    const materials = (body.data as Record<string, unknown>).linkedMaterials as Array<Record<string, unknown>>;
    expect(materials[0].title).toBe("Reference Guide");
    expect(materials[0].description).toBe("A helpful guide for the assignment");
    expect(materials[0].sourceFilePath).toBe("/uploads/materials/guide.pdf");
    expect(materials[1].title).toBe("Worksheet");
    expect(materials[1].description).toBeNull();
  });

  test("returns empty linkedMaterials when no materials attached", async () => {
    const resultData = {
      id: "60000000-0000-4000-8000-000000000001",
      status: "not_started",
      practice_started_at: null,
      practice_submitted_at: null,
      test_started_at: null,
      test_submitted_at: null,
      released_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      assignment_publication_classes: {
        id: "pub-class-1",
        deadline_override: null,
        class_id: "class-1",
        classes: {
          id: "class-1",
          title: "Math 101",
          description: "Introduction to Mathematics",
        },
        assignment_publications: {
          id: "pub-1",
          default_deadline: "2026-12-31T23:59:59Z",
          published_at: "2026-01-01T00:00:00Z",
          assignment_templates: {
            id: "template-1",
            title: "Algebra Homework",
            description: "Solve equations",
            has_practice: true,
            has_test: true,
            linked_test_id: null,
          },
        },
      },
      class_enrollments: {
        id: "enroll-1",
        student_profile_id: "50000000-0000-4000-8000-000000000001",
      },
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: resultData, error: null }, true),
      submission_files: () => createChainableMock({ data: [], error: null }),
      test_attempts: () => createChainableMock({ data: [], error: null }),
      assignment_template_materials: () => createChainableMock({ data: [], error: null }),
    });

    const request = new Request("http://localhost/api/v1/student/assignments/60000000-0000-4000-8000-000000000001");
    const context = { params: Promise.resolve({ assignmentResultId: "60000000-0000-4000-8000-000000000001" }) };
    const response = await assignmentDetailGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray((body.data as Record<string, unknown>).linkedMaterials)).toBe(true);
    expect((body.data as Record<string, unknown>).linkedMaterials).toHaveLength(0);
  });
});

// --- Student Submit Tests ---

describe("POST /api/v1/student/assignment-results/{id}/submit", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when submissionType is invalid", async () => {
    const request = new Request(
      "http://localhost/api/v1/student/assignment-results/result-1/submit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionType: "invalid" }),
      },
    );

    const context = { params: Promise.resolve({ assignmentResultId: "result-1" }) };
    const response = await submitPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("returns RESOURCE_NOT_FOUND when assignment doesn't exist", async () => {
    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: null, error: null }, true),
    });

    const request = new Request(
      "http://localhost/api/v1/student/assignment-results/60000000-0000-4000-8000-000000000001/submit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionType: "both" }),
      },
    );

    const context = { params: Promise.resolve({ assignmentResultId: "60000000-0000-4000-8000-000000000001" }) };
    const response = await submitPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });

  test("returns CONFLICT when already submitted", async () => {
    const resultData = {
      id: "60000000-0000-4000-8000-000000000001",
      status: "submitted",
      practice_started_at: "2026-01-01T00:00:00Z",
      practice_submitted_at: "2026-01-02T00:00:00Z",
      test_started_at: "2026-01-01T00:00:00Z",
      test_submitted_at: "2026-01-02T00:00:00Z",
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

    currentSupabaseClient = buildSupabaseClient({
      assignment_results: () => createChainableMock({ data: resultData, error: null }, true),
    });

    const request = new Request(
      "http://localhost/api/v1/student/assignment-results/60000000-0000-4000-8000-000000000001/submit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionType: "both" }),
      },
    );

    const context = { params: Promise.resolve({ assignmentResultId: "60000000-0000-4000-8000-000000000001" }) };
    const response = await submitPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.CONFLICT);
  });
});

// --- Test Attempts Tests ---

describe("POST /api/v1/student/assignment-results/{id}/test-attempts", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when testId is missing", async () => {
    const request = new Request(
      "http://localhost/api/v1/student/assignment-results/60000000-0000-4000-8000-000000000001/test-attempts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const context = { params: Promise.resolve({ assignmentResultId: "60000000-0000-4000-8000-000000000001" }) };
    const response = await testAttemptPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});

// --- Student Profile Tests ---

describe("GET /api/v1/student/profile", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns student profile", async () => {
    const profileData = {
      id: "50000000-0000-4000-8000-000000000001",
      student_login: "ST-100001",
      first_name: "Test",
      last_name: "Student",
      middle_name: null,
      display_name: "Test Student",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => createChainableMock({ data: profileData, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/student/profile");
    const response = await profileGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).studentLogin).toBe("ST-100001");
    expect((body.data as Record<string, unknown>).displayName).toBe("Test Student");
  });

  test("returns RESOURCE_NOT_FOUND when profile doesn't exist", async () => {
    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => createChainableMock({ data: null, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/student/profile");
    const response = await profileGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });
});

describe("PATCH /api/v1/student/profile", () => {
  beforeEach(() => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when displayName is empty", async () => {
    const request = new Request("http://localhost/api/v1/student/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "" }),
    });

    const response = await profilePatch(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("successfully updates display name", async () => {
    const updatedProfile = {
      id: "50000000-0000-4000-8000-000000000001",
      student_login: "ST-100001",
      first_name: "Test",
      last_name: "Student",
      middle_name: null,
      display_name: "New Display Name",
      status: "active",
      updated_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => ({
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedProfile, error: null })) })),
            })),
          })),
        })),
      }),
    });

    const request = new Request("http://localhost/api/v1/student/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "New Display Name" }),
    });

    const response = await profilePatch(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).displayName).toBe("New Display Name");
  });
});

// Type import for session
type AuthenticatedSession = {
  userId: string;
  role: "student" | "teacher" | "admin";
  displayName: string;
  loginIdentifier?: string;
};
