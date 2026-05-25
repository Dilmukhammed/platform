import { describe, expect, mock, test, beforeEach } from "bun:test";

import { GET } from "@/app/api/v1/session/route";
import { ErrorCodes } from "@/lib/api/errors";
import type { AuthenticatedSession } from "@/modules/auth/types";

// --- Mocks ---

const mockGetAuthSession = mock(() => Promise.resolve(null as AuthenticatedSession | null));

// Mutable state that tests can override per-test
let currentSupabaseClient: Record<string, unknown> = {};

mock.module("@/lib/auth/session", () => ({
  getAuthSession: mockGetAuthSession,
}));

mock.module("@/lib/supabase/server-client", () => ({
  createServerClient: () => currentSupabaseClient,
}));

/**
 * Build a Supabase mock client where each table name maps to a
 * chainable query result. Supports: .select().eq().is().in().limit()
 * and .select().eq().is().eq().limit()
 */
function buildSupabaseClient(
  tableResults: Record<string, { data: unknown; error: unknown }>,
) {
  function buildChain(result: { data: unknown; error: unknown }) {
    const resolved = Promise.resolve(result);
    // Terminal calls: .in(), .eq() (second), .limit() all return Promise
    const inMock = mock(() => resolved);
    const eq2Mock = mock(() => resolved);
    const limitMock = mock(() => resolved);
    // .is() can be followed by .in(), .eq(), or .limit()
    const isMock = mock(() => ({ in: inMock, eq: eq2Mock, limit: limitMock }));
    const eqMock = mock(() => ({ is: isMock }));
    const selectMock = mock(() => ({ eq: eqMock }));
    return { select: selectMock };
  }

  const fromMock = mock((table: string) => {
    const result = tableResults[table] ?? { data: [], error: null };
    return buildChain(result);
  });

  return { from: fromMock };
}

// --- Helpers ---

function teacherSession(): AuthenticatedSession {
  return {
    userId: "20000000-0000-4000-8000-000000000002",
    role: "teacher",
    displayName: "Demo Teacher",
    loginIdentifier: "teacher@platform.local",
  };
}

function studentSession(): AuthenticatedSession {
  return {
    userId: "50000000-0000-4000-8000-000000000001",
    role: "student",
    displayName: "Alex Morozov",
    loginIdentifier: "ST-100001",
  };
}

// --- Tests ---

describe("GET /api/v1/session", () => {
  beforeEach(() => {
    mockGetAuthSession.mockClear();
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns unauthenticated bootstrap when no session exists", async () => {
    mockGetAuthSession.mockResolvedValueOnce(null);

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const data = body.data as Record<string, unknown>;
    expect(data.authenticated).toBe(false);
    expect(data.principal).toBeNull();
    expect(data.role).toBeNull();
    expect(data.scopes).toEqual([]);
    expect((data.onboarding as Record<string, unknown>).state).toBe("no_org");
  });

  test("returns authenticated bootstrap for teacher session with active org", async () => {
    mockGetAuthSession.mockResolvedValueOnce(teacherSession());

    const orgData = [
      {
        id: "mem-1",
        organization_id: "org-1",
        role: "owner",
        status: "active",
        organizations: { id: "org-1", name: "Test School", status: "active" },
      },
    ];
    const classData = [
      {
        id: "ct-1",
        class_id: "class-1",
        role: "owner",
        is_primary: true,
        classes: { id: "class-1", title: "Math 101" },
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      organization_memberships: { data: orgData, error: null },
      class_teachers: { data: classData, error: null },
    });

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const data = body.data as Record<string, unknown>;
    expect(data.authenticated).toBe(true);
    expect((data.principal as Record<string, unknown>).type).toBe("teacher");
    expect(data.role).toBe("teacher");
    expect(Array.isArray(data.scopes)).toBe(true);
    expect((data.scopes as string[]).length).toBeGreaterThan(0);
    expect((data.onboarding as Record<string, unknown>).state).toBe("active");
  });

  test("returns pending_approval onboarding when org membership is pending", async () => {
    mockGetAuthSession.mockResolvedValueOnce(teacherSession());

    const orgData = [
      {
        id: "mem-1",
        organization_id: "org-1",
        role: "teacher",
        status: "pending",
        organizations: { id: "org-1", name: "Pending School", status: "pending" },
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      organization_memberships: { data: orgData, error: null },
      class_teachers: { data: [], error: null },
    });

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;

    expect((data.onboarding as Record<string, unknown>).state).toBe("pending_approval");
  });

  test("returns no_org onboarding when no org memberships exist", async () => {
    mockGetAuthSession.mockResolvedValueOnce(teacherSession());

    currentSupabaseClient = buildSupabaseClient({
      organization_memberships: { data: [], error: null },
      class_teachers: { data: [], error: null },
    });

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;

    expect((data.onboarding as Record<string, unknown>).state).toBe("no_org");
  });

  test("returns student scopes for student session", async () => {
    mockGetAuthSession.mockResolvedValueOnce(studentSession());

    currentSupabaseClient = buildSupabaseClient({
      organization_students: { data: [], error: null },
      class_enrollments: { data: [], error: null },
    });

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;
    const data = body.data as Record<string, unknown>;

    expect(data.role).toBe("student");
    const scopes = data.scopes as string[];
    expect(scopes).toContain("student");
    expect(scopes).toContain("class:read");
  });

  test("returns INTERNAL_ERROR on unexpected exception", async () => {
    mockGetAuthSession.mockRejectedValueOnce(new Error("Cookie read failure"));

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.INTERNAL_ERROR);
  });
});
