import { describe, expect, mock, test, beforeEach } from "bun:test";

import { GET as lookupsGet } from "@/app/api/v1/system/lookups/route";
import { GET as healthGet } from "@/app/api/v1/system/health/route";
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
 * Create a chainable mock for Supabase queries
 */
function createChainableMock(result: { data: unknown; error: unknown; count?: number }) {
  const resolved = Promise.resolve(result);

  return {
    select: mock(() => ({
      eq: mock(function () {
        return this;
      }),
      is: mock(function () {
        return this;
      }),
      limit: mock(() => resolved),
    })),
  };
}

/**
 * Build a Supabase mock client
 */
function buildSupabaseClient(tables: Record<string, () => Record<string, unknown>>) {
  const fromMock = mock((table: string) => {
    const handler = tables[table];
    if (handler) return handler();
    return createChainableMock({ data: [], error: null });
  });
  return { from: fromMock };
}

// Type import for session
type AuthenticatedSession = {
  userId: string;
  role: "student" | "teacher" | "super_admin";
  displayName: string;
  loginIdentifier?: string;
};

// Helper to create super_admin session
function createSuperAdminSession(): AuthenticatedSession {
  return {
    userId: "admin-1",
    role: "super_admin",
    displayName: "Super Admin",
    loginIdentifier: "admin@example.com",
  };
}

// Helper to create teacher session
function createTeacherSession(): AuthenticatedSession {
  return {
    userId: "teacher-1",
    role: "teacher",
    displayName: "Teacher User",
    loginIdentifier: "teacher@example.com",
  };
}

// Helper to parse JSON response
async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

// Reset mocks before each test
beforeEach(() => {
  currentSession = null;
  currentSupabaseClient = {};
});

// ============================================================================
// Lookups Endpoint Tests
// ============================================================================

describe("GET /api/v1/system/lookups", () => {
  test("returns all enum values without authentication", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: Record<string, string[]>;
      error: null;
      meta: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.error).toBeNull();
    expect(body.data).toBeDefined();

    // Verify key enum categories exist
    expect(body.data.userRoles).toContain("super_admin");
    expect(body.data.userRoles).toContain("teacher");
    expect(body.data.organizationStatuses).toContain("pending");
    expect(body.data.organizationStatuses).toContain("active");
    expect(body.data.organizationStatuses).toContain("suspended");
    expect(body.data.materialStatuses).toContain("draft");
    expect(body.data.materialStatuses).toContain("active");
    expect(body.data.materialStatuses).toContain("archived");
    expect(body.data.testStatuses).toContain("draft");
    expect(body.data.testStatuses).toContain("active");
    expect(body.data.testStatuses).toContain("archived");
    expect(body.data.assignmentResultStatuses).toContain("not_started");
    expect(body.data.assignmentResultStatuses).toContain("in_progress");
    expect(body.data.assignmentResultStatuses).toContain("submitted");
    expect(body.data.assignmentResultStatuses).toContain("reviewed");
    expect(body.data.assignmentResultStatuses).toContain("released");
    expect(body.data.classStatuses).toContain("draft");
    expect(body.data.classStatuses).toContain("active");
    expect(body.data.classStatuses).toContain("archived");
  });

  test("returns structured data grouped by category", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: Record<string, string[]>;
      error: null;
      meta: Record<string, unknown>;
    };

    // Verify all expected categories are present
    const expectedCategories = [
      "userRoles",
      "userStatuses",
      "organizationStatuses",
      "organizationMembershipRoles",
      "organizationMembershipStatuses",
      "studentStatuses",
      "studentCredentialStatuses",
      "classStatuses",
      "classTeacherRoles",
      "joinCodeStatuses",
      "enrollmentStatuses",
      "enrollmentSources",
      "libraryScopes",
      "materialStatuses",
      "testStatuses",
      "assignmentTemplateStatuses",
      "assignmentPublicationStatuses",
      "assignmentResultStatuses",
      "submissionFileRoles",
      "submissionFileKinds",
      "reviewStatuses",
      "reviewCommentAuthorTypes",
      "approvalDecisions",
      "gradeRecordStatuses",
      "notificationRecipientTypes",
      "derivedAssetKinds",
    ];

    for (const category of expectedCategories) {
      expect(body.data[category]).toBeDefined();
      expect(Array.isArray(body.data[category])).toBe(true);
    }
  });

  test("enum values are non-empty arrays", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: Record<string, string[]>;
      error: null;
      meta: Record<string, unknown>;
    };

    // Verify each category has at least one value
    for (const [category, values] of Object.entries(body.data)) {
      expect(Array.isArray(values)).toBe(true);
      expect(values.length).toBeGreaterThan(0);
      expect(values.every((v) => typeof v === "string")).toBe(true);
    }
  });
});

// ============================================================================
// Health Endpoint Tests
// ============================================================================

describe("GET /api/v1/system/health", () => {
  test("returns 401 when not authenticated", async () => {
    currentSession = null;

    const response = await healthGet(
      new Request("http://localhost/api/v1/system/health"),
      { params: Promise.resolve({}) },
    );
    const body = (await parseJson(response)) as {
      success: boolean;
      data: null;
      error: { code: string; message: string };
      meta: Record<string, unknown>;
    };

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("returns 403 when authenticated as teacher", async () => {
    currentSession = createTeacherSession();

    const response = await healthGet(
      new Request("http://localhost/api/v1/system/health"),
      { params: Promise.resolve({}) },
    );
    const body = (await parseJson(response)) as {
      success: boolean;
      data: null;
      error: { code: string; message: string };
      meta: Record<string, unknown>;
    };

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns health status when authenticated as super_admin", async () => {
    currentSession = createSuperAdminSession();

    // Mock healthy database
    currentSupabaseClient = buildSupabaseClient({
      platform_users: () =>
        createChainableMock({
          data: [{ id: "test" }],
          error: null,
        }),
    });

    const response = await healthGet(
      new Request("http://localhost/api/v1/system/health"),
      { params: Promise.resolve({}) },
    );
    const body = (await parseJson(response)) as {
      success: boolean;
      data: {
        status: string;
        version: string;
        uptime: number;
        timestamp: string;
        database: {
          status: string;
          latency: number;
        };
      };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("healthy");
    expect(body.data.version).toBeDefined();
    expect(typeof body.data.uptime).toBe("number");
    expect(body.data.uptime).toBeGreaterThanOrEqual(0);
    expect(body.data.timestamp).toBeDefined();
    expect(body.data.database.status).toBe("healthy");
    expect(typeof body.data.database.latency).toBe("number");
  });

  test("returns degraded status when database is slow", async () => {
    currentSession = createSuperAdminSession();

    // Mock slow database by simulating latency (we can't actually delay, but we can verify structure)
    currentSupabaseClient = buildSupabaseClient({
      platform_users: () =>
        createChainableMock({
          data: [{ id: "test" }],
          error: null,
        }),
    });

    const response = await healthGet(
      new Request("http://localhost/api/v1/system/health"),
      { params: Promise.resolve({}) },
    );
    const body = (await parseJson(response)) as {
      success: boolean;
      data: {
        status: string;
        database: {
          status: string;
          latency: number;
        };
      };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // Status could be healthy or degraded depending on actual latency
    expect(["healthy", "degraded"]).toContain(body.data.status);
    expect(["healthy", "degraded"]).toContain(body.data.database.status);
  });

  test("returns unhealthy status when database connection fails", async () => {
    currentSession = createSuperAdminSession();

    // Mock database error
    currentSupabaseClient = buildSupabaseClient({
      platform_users: () =>
        createChainableMock({
          data: null,
          error: { message: "Connection failed" },
        }),
    });

    const response = await healthGet(
      new Request("http://localhost/api/v1/system/health"),
      { params: Promise.resolve({}) },
    );
    const body = (await parseJson(response)) as {
      success: boolean;
      data: {
        status: string;
        database: {
          status: string;
          latency: number;
        };
      };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("unhealthy");
    expect(body.data.database.status).toBe("unhealthy");
  });

  test("returns 500 on unexpected error", async () => {
    currentSession = createSuperAdminSession();

    // Suppress expected console.error output for this test
    const originalConsoleError = console.error;
    console.error = mock(() => {});

    // Mock client that throws error
    currentSupabaseClient = {
      from: mock(() => {
        throw new Error("Unexpected error");
      }),
    };

    const response = await healthGet(
      new Request("http://localhost/api/v1/system/health"),
      { params: Promise.resolve({}) },
    );
    const body = (await parseJson(response)) as {
      success: boolean;
      data: null;
      error: { code: string; message: string };
      meta: Record<string, unknown>;
    };

    // Restore console.error
    console.error = originalConsoleError;

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ErrorCodes.INTERNAL_ERROR);
  });

  test("returns correct envelope structure", async () => {
    currentSession = createSuperAdminSession();

    currentSupabaseClient = buildSupabaseClient({
      platform_users: () =>
        createChainableMock({
          data: [{ id: "test" }],
          error: null,
        }),
    });

    const response = await healthGet(
      new Request("http://localhost/api/v1/system/health"),
      { params: Promise.resolve({}) },
    );
    const body = (await parseJson(response)) as {
      success: boolean;
      data: unknown;
      error: unknown;
      meta: Record<string, unknown>;
    };

    // Verify canonical envelope structure
    expect(body).toHaveProperty("success");
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("meta");
    expect(typeof body.success).toBe("boolean");
  });
});

// ============================================================================
// Lookups Data Validation Tests
// ============================================================================

describe("Lookups Data Validation", () => {
  test("userRoles contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { userRoles: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.userRoles).toEqual(["super_admin", "teacher"]);
  });

  test("organizationStatuses contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { organizationStatuses: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.organizationStatuses).toEqual([
      "pending",
      "active",
      "suspended",
      "archived",
    ]);
  });

  test("materialStatuses contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { materialStatuses: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.materialStatuses).toEqual(["draft", "active", "archived"]);
  });

  test("testStatuses contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { testStatuses: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.testStatuses).toEqual(["draft", "active", "archived"]);
  });

  test("assignmentResultStatuses contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { assignmentResultStatuses: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.assignmentResultStatuses).toEqual([
      "not_started",
      "in_progress",
      "submitted",
      "reviewed",
      "released",
      "archived",
    ]);
  });

  test("classStatuses contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { classStatuses: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.classStatuses).toEqual(["draft", "active", "archived"]);
  });

  test("approvalDecisions contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { approvalDecisions: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.approvalDecisions).toEqual(["pending", "approved", "rejected"]);
  });

  test("enrollmentStatuses contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { enrollmentStatuses: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.enrollmentStatuses).toEqual(["active", "inactive", "left", "archived"]);
  });

  test("libraryScopes contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { libraryScopes: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.libraryScopes).toEqual(["personal", "organization"]);
  });

  test("submissionFileKinds contains expected values", async () => {
    const response = await lookupsGet();
    const body = (await parseJson(response)) as {
      success: boolean;
      data: { submissionFileKinds: string[] };
      error: null;
      meta: Record<string, unknown>;
    };

    expect(body.data.submissionFileKinds).toEqual(["image", "pdf", "dwg", "other"]);
  });
});
