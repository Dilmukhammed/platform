import { describe, expect, mock, test, beforeEach } from "bun:test";

import { GET as orgsGet, POST as orgsPost } from "@/app/api/v1/teacher/organizations/route";
import { POST as joinByInvitePost } from "@/app/api/v1/teacher/organizations/join-by-invite/route";
import { GET as classesGet, POST as classesPost } from "@/app/api/v1/teacher/classes/route";
import { GET as classGet, PATCH as classPatch } from "@/app/api/v1/teacher/classes/[classId]/route";
import { GET as studentsGet, POST as studentsPost } from "@/app/api/v1/teacher/classes/[classId]/students/route";
import { POST as importPost } from "@/app/api/v1/teacher/classes/[classId]/students/import/route";
import { GET as joinCodesGet } from "@/app/api/v1/teacher/classes/[classId]/join-codes/route";
import { POST as rotatePost } from "@/app/api/v1/teacher/classes/[classId]/join-codes/rotate/route";
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

// --- Teacher Organizations Tests ---

describe("GET /api/v1/teacher/organizations", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns UNAUTHORIZED when not authenticated", async () => {
    currentSession = null;
    const request = new Request("http://localhost/api/v1/teacher/organizations");
    const response = await orgsGet(request);
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

    const request = new Request("http://localhost/api/v1/teacher/organizations");
    const response = await orgsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns paginated list of organizations", async () => {
    const membershipsData = [
      {
        id: "membership-1",
        role: "owner",
        status: "active",
        joined_at: "2026-01-01T00:00:00Z",
        organizations: {
          id: "org-1",
          name: "Test School",
          slug: "test-school",
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
        },
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      organization_memberships: () => createChainableMock({ data: membershipsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/teacher/organizations");
    const response = await orgsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].name).toBe("Test School");
  });
});

describe("POST /api/v1/teacher/organizations", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when name is empty", async () => {
    const request = new Request("http://localhost/api/v1/teacher/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", slug: "test" }),
    });

    const response = await orgsPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("returns CONFLICT when slug is already taken", async () => {
    currentSupabaseClient = buildSupabaseClient({
      organizations: () => createChainableMock({ data: { id: "existing-org" }, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New School", slug: "existing-school" }),
    });

    const response = await orgsPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.CONFLICT);
  });

  test("successfully creates organization", async () => {
    const orgData = {
      id: "org-1",
      name: "New School",
      slug: "new-school",
      status: "pending",
      created_at: "2026-01-01T00:00:00Z",
    };

    const membershipData = {
      id: "membership-1",
      role: "owner",
      status: "active",
      joined_at: "2026-01-01T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      organizations: () => ({
        ...createChainableMock({ data: null, error: null }, true),
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => Promise.resolve({ data: orgData, error: null })) })),
        })),
      }),
      organization_memberships: () => ({
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => Promise.resolve({ data: membershipData, error: null })) })),
        })),
      }),
    });

    const request = new Request("http://localhost/api/v1/teacher/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New School", slug: "new-school" }),
    });

    const response = await orgsPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).name).toBe("New School");
  });
});

// --- Teacher Classes Tests ---

describe("GET /api/v1/teacher/classes", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of classes", async () => {
    const classTeachersData = [
      {
        id: "ct-1",
        role: "owner",
        is_primary: true,
        status: "active",
        classes: {
          id: "class-1",
          title: "Math 101",
          description: "Introduction to Math",
          status: "active",
          organization_id: "org-1",
          created_at: "2026-01-01T00:00:00Z",
        },
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: classTeachersData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes");
    const response = await classesGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].title).toBe("Math 101");
  });
});

describe("POST /api/v1/teacher/classes", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns FORBIDDEN when not a member of organization", async () => {
    const resolvedNull = Promise.resolve({ data: null, error: null });
    const chainableMock = {
      eq: mock(function() { return chainableMock; }),
      is: mock(function() { return chainableMock; }),
      in: mock(function() { return chainableMock; }),
      maybeSingle: mock(() => resolvedNull),
    };
    currentSupabaseClient = buildSupabaseClient({
      organization_memberships: () => ({
        select: mock(() => chainableMock),
      }),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: "10000000-0000-4000-8000-000000000001",
        title: "New Class",
      }),
    });

    const response = await classesPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("successfully creates class", async () => {
    const membershipData = { id: "membership-1", role: "owner", status: "active" };
    const classData = {
      id: "class-1",
      title: "New Class",
      description: null,
      status: "draft",
      organization_id: "10000000-0000-4000-8000-000000000001",
      created_at: "2026-01-01T00:00:00Z",
    };
    const teacherData = { id: "ct-1", role: "owner", is_primary: true, status: "active" };
    const joinCodeData = { id: "jc-1", code: "123456", status: "active" };

    const resolvedMembership = Promise.resolve({ data: membershipData, error: null });
    const resolvedClass = Promise.resolve({ data: classData, error: null });
    const resolvedTeacher = Promise.resolve({ data: teacherData, error: null });
    const resolvedJoinCode = Promise.resolve({ data: joinCodeData, error: null });

    const membershipChainable = {
      eq: mock(function() { return membershipChainable; }),
      is: mock(function() { return membershipChainable; }),
      in: mock(function() { return membershipChainable; }),
      maybeSingle: mock(() => resolvedMembership),
    };

    currentSupabaseClient = buildSupabaseClient({
      organization_memberships: () => ({
        select: mock(() => membershipChainable),
      }),
      classes: () => ({
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => resolvedClass) })),
        })),
      }),
      class_teachers: () => ({
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => resolvedTeacher) })),
        })),
      }),
      class_join_codes: () => ({
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => resolvedJoinCode) })),
        })),
      }),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: "10000000-0000-4000-8000-000000000001",
        title: "New Class",
      }),
    });

    const response = await classesPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).title).toBe("New Class");
  });
});

// --- Teacher Class Detail Tests ---

describe("GET /api/v1/teacher/classes/{classId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns FORBIDDEN when teacher doesn't have access", async () => {
    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: null, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes/class-1");
    const context = { params: Promise.resolve({ classId: "class-1" }) };
    const response = await classGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns class details", async () => {
    const classTeacherData = { id: "ct-1", role: "owner", is_primary: true, status: "active" };
    const classData = {
      id: "class-1",
      title: "Math 101",
      description: "Introduction to Math",
      status: "active",
      organization_id: "org-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const orgData = { id: "org-1", name: "Test School", slug: "test-school" };
    const joinCodeData = { id: "jc-1", code: "123456", status: "active", valid_from: "2026-01-01", valid_until: null };

    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: classTeacherData, error: null }, true),
      classes: () => createChainableMock({ data: classData, error: null }, true),
      organizations: () => createChainableMock({ data: orgData, error: null }, true),
      class_join_codes: () => createChainableMock({ data: joinCodeData, error: null }, true),
      class_enrollments: () => createChainableMock({ data: [], error: null, count: 0 }),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes/class-1");
    const context = { params: Promise.resolve({ classId: "class-1" }) };
    const response = await classGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).title).toBe("Math 101");
    expect((body.data as Record<string, unknown>).studentCount).toBe(0);
  });
});

describe("PATCH /api/v1/teacher/classes/{classId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns FORBIDDEN when not primary owner", async () => {
    const classTeacherData = { id: "ct-1", role: "assistant", is_primary: false, status: "active" };

    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: classTeacherData, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes/class-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title" }),
    });

    const context = { params: Promise.resolve({ classId: "class-1" }) };
    const response = await classPatch(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("successfully updates class", async () => {
    const classTeacherData = { id: "ct-1", role: "owner", is_primary: true, status: "active" };
    const updatedClassData = {
      id: "class-1",
      title: "Updated Title",
      description: "Updated Description",
      status: "active",
      organization_id: "org-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: classTeacherData, error: null }, true),
      classes: () => ({
        ...createChainableMock({ data: null, error: null }),
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedClassData, error: null })) })),
            })),
          })),
        })),
      }),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes/class-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated Title", description: "Updated Description" }),
    });

    const context = { params: Promise.resolve({ classId: "class-1" }) };
    const response = await classPatch(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).title).toBe("Updated Title");
  });
});

// --- Teacher Students Tests ---

describe("GET /api/v1/teacher/classes/{classId}/students", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of students", async () => {
    const classTeacherData = { id: "ct-1" };
    const enrollmentsData = [
      {
        id: "enroll-1",
        status: "active",
        joined_at: "2026-01-01T00:00:00Z",
        left_at: null,
        source: "manual",
        student_profiles: {
          id: "student-1",
          student_login: "ST-100001",
          first_name: "John",
          last_name: "Doe",
          middle_name: null,
          display_name: "John Doe",
          status: "active",
        },
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: classTeacherData, error: null }, true),
      class_enrollments: () => createChainableMock({ data: enrollmentsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes/class-1/students");
    const context = { params: Promise.resolve({ classId: "class-1" }) };
    const response = await studentsGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].firstName).toBe("John");
  });
});

describe("POST /api/v1/teacher/classes/{classId}/students", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when PIN is invalid", async () => {
    const classTeacherData = { id: "ct-1", classes: { id: "class-1", organization_id: "org-1" } };

    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: classTeacherData, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes/class-1/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentLogin: "ST-100001",
        firstName: "John",
        lastName: "Doe",
        pin: "123", // Invalid PIN (too short)
      }),
    });

    const context = { params: Promise.resolve({ classId: "class-1" }) };
    const response = await studentsPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});

// --- Teacher Join Codes Tests ---

describe("GET /api/v1/teacher/classes/{classId}/join-codes", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns join codes for class", async () => {
    const classTeacherData = { id: "ct-1" };
    const activeCodeData = {
      id: "jc-1",
      code: "123456",
      status: "active",
      valid_from: "2026-01-01T00:00:00Z",
      valid_until: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    const resolvedActive = Promise.resolve({ data: activeCodeData, error: null });
    const resolvedHistory = Promise.resolve({ data: [], error: null });

    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: classTeacherData, error: null }, true),
      class_join_codes: () => ({
        select: mock(() => ({
          eq: mock(function() { return this; }),
          is: mock(function() { return this; }),
          in: mock(function() { return this; }),
          maybeSingle: mock(() => resolvedActive),
          order: mock(() => ({
            limit: mock(() => resolvedHistory),
          })),
        })),
      }),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes/class-1/join-codes");
    const context = { params: Promise.resolve({ classId: "class-1" }) };
    const response = await joinCodesGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).classId).toBe("class-1");
    expect((body.data as Record<string, unknown>).activeCode).toBeDefined();
  });
});

describe("POST /api/v1/teacher/classes/{classId}/join-codes/rotate", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns FORBIDDEN when not primary owner", async () => {
    const classTeacherData = { id: "ct-1", role: "assistant", is_primary: false };

    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: classTeacherData, error: null }, true),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes/class-1/join-codes/rotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const context = { params: Promise.resolve({ classId: "class-1" }) };
    const response = await rotatePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("successfully rotates join code", async () => {
    const classTeacherData = { id: "ct-1", role: "owner", is_primary: true };
    const currentCodeData = { id: "jc-1", code: "123456" };
    const newCodeData = { id: "jc-2", code: "654321", status: "active", valid_from: "2026-01-01", created_at: "2026-01-01" };

    currentSupabaseClient = buildSupabaseClient({
      class_teachers: () => createChainableMock({ data: classTeacherData, error: null }, true),
      class_join_codes: () => ({
        ...createChainableMock({ data: currentCodeData, error: null }, true),
        insert: mock(() => ({
          select: mock(() => ({ single: mock(() => Promise.resolve({ data: newCodeData, error: null })) })),
        })),
        update: mock(() => ({
          eq: mock(() => Promise.resolve({ data: null, error: null })),
        })),
      }),
    });

    const request = new Request("http://localhost/api/v1/teacher/classes/class-1/join-codes/rotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const context = { params: Promise.resolve({ classId: "class-1" }) };
    const response = await rotatePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).newCode).toBeDefined();
  });
});
