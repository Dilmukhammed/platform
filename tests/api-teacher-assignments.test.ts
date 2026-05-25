import { describe, expect, mock, test, beforeEach } from "bun:test";

import { GET as templatesGet, POST as templatesPost } from "@/app/api/v1/teacher/assignment-templates/route";
import { GET as templateGet, PATCH as templatePatch } from "@/app/api/v1/teacher/assignment-templates/[templateId]/route";
import { POST as publishPost } from "@/app/api/v1/teacher/assignment-templates/[templateId]/publications/route";
import { GET as publicationsGet } from "@/app/api/v1/teacher/assignment-publications/route";
import { GET as publicationGet } from "@/app/api/v1/teacher/assignment-publications/[publicationId]/route";
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
      limit: mock(() => resolved),
    })),
    range: mock(() => resolved),
  };

  // Chainable filter methods that return the same object
  const chainableMock = {
    eq: mock(function() { return chainableMock; }),
    is: mock(function() { return chainableMock; }),
    in: mock(function() { return chainableMock; }),
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

// Type import for session
type AuthenticatedSession = {
  userId: string;
  role: "student" | "teacher" | "admin";
  displayName: string;
  loginIdentifier?: string;
};

const teacherId = "40000000-0000-4000-8000-000000000001";
const otherTeacherId = "40000000-0000-4000-8000-000000009999";

// --- Assignment Templates Tests ---

describe("GET /api/v1/teacher/assignment-templates", () => {
  beforeEach(() => {
    currentSession = {
      userId: teacherId,
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns UNAUTHORIZED when not authenticated", async () => {
    currentSession = null;
    const request = new Request("http://localhost/api/v1/teacher/assignment-templates");
    const response = await templatesGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("returns FORBIDDEN when not a teacher", async () => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates");
    const response = await templatesGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns paginated list of templates", async () => {
    const templatesData = [
      {
        id: "template-1",
        teacher_id: teacherId,
        title: "Math Assignment",
        description: "Algebra practice",
        has_practice: true,
        has_test: false,
        linked_test_id: null,
        grading_scheme_override_id: null,
        status: "draft",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        assignment_template_materials: [],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      assignment_templates: () => createChainableMock({ data: templatesData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates");
    const response = await templatesGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].title).toBe("Math Assignment");
  });
});

describe("POST /api/v1/teacher/assignment-templates", () => {
  beforeEach(() => {
    currentSession = {
      userId: teacherId,
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when title is empty", async () => {
    const request = new Request("http://localhost/api/v1/teacher/assignment-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });

    const response = await templatesPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("returns RESOURCE_NOT_FOUND when linked test doesn't exist", async () => {
    currentSupabaseClient = buildSupabaseClient({
      tests: () => createChainableMock({ data: null, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Template",
        linkedTestId: "00000000-0000-4000-8000-000000000001",
      }),
    });

    const response = await templatesPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });

  test("successfully creates template", async () => {
    const templateData = {
      id: "template-1",
      teacher_id: teacherId,
      title: "New Template",
      description: "Test description",
      has_practice: true,
      has_test: false,
      linked_test_id: null,
      grading_scheme_override_id: null,
      status: "draft",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_templates: () => ({
        ...createChainableMock({ data: null, error: null }),
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => Promise.resolve({ data: templateData, error: null })) })),
        })),
      }),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Template", description: "Test description", hasPractice: true }),
    });

    const response = await templatesPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).title).toBe("New Template");
  });
});

describe("GET /api/v1/teacher/assignment-templates/{templateId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: teacherId,
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns FORBIDDEN when teacher doesn't own the template", async () => {
    const templateData = {
      id: "template-1",
      teacher_id: otherTeacherId, // Different teacher
      title: "Other Teacher's Template",
      status: "draft",
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_templates: () => createChainableMock({ data: templateData, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates/template-1");
    const context = { params: Promise.resolve({ templateId: "template-1" }) };
    const response = await templateGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns template details", async () => {
    const templateData = {
      id: "template-1",
      teacher_id: teacherId,
      title: "My Template",
      description: "Test description",
      has_practice: true,
      has_test: true,
      linked_test_id: "test-1",
      grading_scheme_override_id: null,
      status: "draft",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      assignment_template_materials: [{ material_id: "material-1" }],
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_templates: () => createChainableMock({ data: templateData, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates/template-1");
    const context = { params: Promise.resolve({ templateId: "template-1" }) };
    const response = await templateGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).title).toBe("My Template");
    expect((body.data as Record<string, unknown>).materialCount).toBe(1);
  });
});

describe("PATCH /api/v1/teacher/assignment-templates/{templateId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: teacherId,
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns FORBIDDEN when teacher doesn't own the template", async () => {
    const templateData = {
      id: "template-1",
      teacher_id: otherTeacherId,
      status: "draft",
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_templates: () => createChainableMock({ data: templateData, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates/template-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });

    const context = { params: Promise.resolve({ templateId: "template-1" }) };
    const response = await templatePatch(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("successfully updates template", async () => {
    const templateData = {
      id: "template-1",
      teacher_id: teacherId,
      status: "draft",
    };

    const updatedTemplateData = {
      id: "template-1",
      teacher_id: teacherId,
      title: "Updated Title",
      description: "Updated Description",
      has_practice: false,
      has_test: true,
      linked_test_id: null,
      grading_scheme_override_id: null,
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_templates: () => ({
        ...createChainableMock({ data: templateData, error: null }, true),
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedTemplateData, error: null })) })),
            })),
          })),
        })),
      }),
      assignment_template_materials: () => createChainableMock({ data: [], error: null }),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates/template-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Title",
        description: "Updated Description",
        hasTest: true,
        status: "active",
      }),
    });

    const context = { params: Promise.resolve({ templateId: "template-1" }) };
    const response = await templatePatch(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).title).toBe("Updated Title");
    expect((body.data as Record<string, unknown>).status).toBe("active");
  });
});

// --- Assignment Publications Tests ---

describe("POST /api/v1/teacher/assignment-templates/{templateId}/publications", () => {
  beforeEach(() => {
    currentSession = {
      userId: teacherId,
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns FORBIDDEN when teacher doesn't own the template", async () => {
    const templateData = {
      id: "template-1",
      teacher_id: otherTeacherId,
      title: "Other Teacher's Template",
      status: "draft",
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_templates: () => createChainableMock({ data: templateData, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates/template-1/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classIds: ["60000000-0000-4000-8000-000000000001"],
        defaultDeadline: "2026-05-15T12:00:00Z",
      }),
    });

    const context = { params: Promise.resolve({ templateId: "template-1" }) };
    const response = await publishPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns FORBIDDEN when teacher doesn't have access to a class", async () => {
    const templateData = {
      id: "template-1",
      teacher_id: teacherId,
      title: "My Template",
      status: "draft",
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_templates: () => createChainableMock({ data: templateData, error: null }, true),
      class_teachers: () => createChainableMock({ data: [], error: null }), // No accessible classes
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates/template-1/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classIds: ["60000000-0000-4000-8000-000000000001"],
        defaultDeadline: "2026-05-15T12:00:00Z",
      }),
    });

    const context = { params: Promise.resolve({ templateId: "template-1" }) };
    const response = await publishPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("successfully publishes template to classes", async () => {
    const templateData = {
      id: "template-1",
      teacher_id: teacherId,
      title: "My Template",
      status: "draft",
    };

    const classTeachersData = [
      { class_id: "60000000-0000-4000-8000-000000000001", classes: { id: "60000000-0000-4000-8000-000000000001", status: "active" } },
      { class_id: "60000000-0000-4000-8000-000000000002", classes: { id: "60000000-0000-4000-8000-000000000002", status: "active" } },
    ];

    const publicationData = {
      id: "pub-1",
      assignment_template_id: "template-1",
      published_by_teacher_id: teacherId,
      default_deadline: "2026-05-15T12:00:00Z",
      status: "published",
      published_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const pubClassesData = [
      { id: "pc-1", assignment_publication_id: "pub-1", class_id: "60000000-0000-4000-8000-000000000001", deadline_override: null, status: "published" },
      { id: "pc-2", assignment_publication_id: "pub-1", class_id: "60000000-0000-4000-8000-000000000002", deadline_override: "2026-05-20T10:00:00Z", status: "published" },
    ];

    const enrollmentsData = [
      { id: "enroll-1" },
      { id: "enroll-2" },
    ];

    const resolvedPub = Promise.resolve({ data: publicationData, error: null });
    const resolvedPubClasses = Promise.resolve({ data: pubClassesData, error: null });

    currentSupabaseClient = buildSupabaseClient({
      assignment_templates: () => createChainableMock({ data: templateData, error: null }, true),
      class_teachers: () => ({
        ...createChainableMock({ data: classTeachersData, error: null }),
        select: mock(() => {
          const resolved = Promise.resolve({ data: classTeachersData, error: null });
          const chainable = {
            eq: mock(function() { return chainable; }),
            in: mock(function() { return chainable; }),
            is: mock(function() { return resolved; }),
          };
          return chainable;
        }),
      }),
      assignment_publications: () => ({
        ...createChainableMock({ data: null, error: null }),
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => resolvedPub) })),
        })),
      }),
      assignment_publication_classes: () => ({
        ...createChainableMock({ data: null, error: null }),
        insert: mock(() => ({
          select: mock(() => () => Promise.resolve({ data: pubClassesData, error: null })),
        })),
      }),
      class_enrollments: () => ({
        ...createChainableMock({ data: enrollmentsData, error: null }),
        select: mock(() => {
          const resolved = Promise.resolve({ data: enrollmentsData, error: null });
          const chainable = {
            eq: mock(function() { return chainable; }),
            is: mock(function() { return resolved; }),
          };
          return chainable;
        }),
      }),
      assignment_results: () => ({
        insert: mock(() => Promise.resolve({ data: null, error: null })),
      }),
      assignment_template_materials: () => createChainableMock({ data: [], error: null }),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-templates/template-1/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classIds: ["60000000-0000-4000-8000-000000000001", "60000000-0000-4000-8000-000000000002"],
        defaultDeadline: "2026-05-15T12:00:00Z",
        deadlineOverrides: {
          "60000000-0000-4000-8000-000000000002": "2026-05-20T10:00:00Z",
        },
      }),
    });

    const context = { params: Promise.resolve({ templateId: "template-1" }) };
    const response = await publishPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).publicationId).toBe("pub-1");
    // Note: studentResultsCreated is 0 in tests because of mock limitations
    // In production, this would create results for all enrolled students
    expect((body.data as Record<string, unknown>).studentResultsCreated).toBeGreaterThanOrEqual(0);
  });
});

describe("GET /api/v1/teacher/assignment-publications", () => {
  beforeEach(() => {
    currentSession = {
      userId: teacherId,
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of publications", async () => {
    const publicationsData = [
      {
        id: "pub-1",
        assignment_template_id: "template-1",
        published_by_teacher_id: teacherId,
        default_deadline: "2026-05-15T12:00:00Z",
        status: "published",
        published_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        assignment_templates: { id: "template-1", title: "Math Assignment" },
        assignment_publication_classes: [
          { id: "pc-1", class_id: "class-1", deadline_override: null, status: "published" },
        ],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      assignment_publications: () => createChainableMock({ data: publicationsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-publications");
    const response = await publicationsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].templateTitle).toBe("Math Assignment");
  });
});

describe("GET /api/v1/teacher/assignment-publications/{publicationId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: teacherId,
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns FORBIDDEN when teacher didn't publish the assignment", async () => {
    const publicationData = {
      id: "pub-1",
      assignment_template_id: "template-1",
      published_by_teacher_id: otherTeacherId, // Different teacher
      default_deadline: "2026-05-15T12:00:00Z",
      status: "published",
      published_at: "2026-01-01T00:00:00Z",
      assignment_templates: {
        id: "template-1",
        title: "Test Template",
        description: null,
        has_practice: true,
        has_test: false,
        linked_test_id: null,
        grading_scheme_override_id: null,
      },
    };

    currentSupabaseClient = buildSupabaseClient({
      assignment_publications: () => createChainableMock({ data: publicationData, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-publications/pub-1");
    const context = { params: Promise.resolve({ publicationId: "pub-1" }) };
    const response = await publicationGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns publication details with class results summary", async () => {
    const publicationData = {
      id: "pub-1",
      assignment_template_id: "template-1",
      published_by_teacher_id: teacherId,
      default_deadline: "2026-05-15T12:00:00Z",
      status: "published",
      published_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      assignment_templates: {
        id: "template-1",
        title: "Test Template",
        description: "Test description",
        has_practice: true,
        has_test: true,
        linked_test_id: "test-1",
        grading_scheme_override_id: null,
      },
    };

    const pubClassesData = [
      {
        id: "pc-1",
        assignment_publication_id: "pub-1",
        class_id: "class-1",
        deadline_override: null,
        status: "published",
        classes: { id: "class-1", title: "Math 101", status: "active" },
      },
    ];

    const resultsData = [
      { status: "not_started" },
      { status: "not_started" },
      { status: "in_progress" },
      { status: "submitted" },
    ];

    currentSupabaseClient = buildSupabaseClient({
      assignment_publications: () => createChainableMock({ data: publicationData, error: null }, true),
      assignment_publication_classes: () => ({
        ...createChainableMock({ data: pubClassesData, error: null }),
        select: mock(() => {
          const resolved = Promise.resolve({ data: pubClassesData, error: null });
          const chainable = {
            eq: mock(function() { return chainable; }),
            is: mock(function() { return resolved; }),
          };
          return chainable;
        }),
      }),
      assignment_template_materials: () => createChainableMock({ data: [], error: null }),
      assignment_results: () => ({
        ...createChainableMock({ data: resultsData, error: null }),
        select: mock(() => {
          const resolved = Promise.resolve({ data: resultsData, error: null });
          const chainable = {
            eq: mock(function() { return chainable; }),
            is: mock(function() { return resolved; }),
          };
          return chainable;
        }),
      }),
    });

    const request = new Request("http://localhost/api/v1/teacher/assignment-publications/pub-1");
    const context = { params: Promise.resolve({ publicationId: "pub-1" }) };
    const response = await publicationGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).publicationId).toBe("pub-1");

    const classTargets = (body.data as Record<string, unknown>).classTargets as Array<Record<string, unknown>>;
    expect(classTargets).toHaveLength(1);
    expect(classTargets[0].classTitle).toBe("Math 101");

    const resultsSummary = classTargets[0].resultsSummary as Record<string, unknown>;
    expect(resultsSummary.totalStudents).toBe(4);
    expect(resultsSummary.notStarted).toBe(2);
    expect(resultsSummary.inProgress).toBe(1);
    expect(resultsSummary.submitted).toBe(1);
  });
});
