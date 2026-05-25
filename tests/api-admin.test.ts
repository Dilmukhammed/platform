import { describe, expect, mock, test, beforeEach } from "bun:test";

import { GET as orgApprovalsGet } from "@/app/api/v1/admin/organization-approvals/route";
import { POST as orgApprovePost } from "@/app/api/v1/admin/organization-approvals/[approvalId]/approve/route";
import { POST as orgRejectPost } from "@/app/api/v1/admin/organization-approvals/[approvalId]/reject/route";
import { GET as materialApprovalsGet } from "@/app/api/v1/admin/material-approvals/route";
import { POST as materialApprovePost } from "@/app/api/v1/admin/material-approvals/[approvalId]/approve/route";
import { POST as materialRejectPost } from "@/app/api/v1/admin/material-approvals/[approvalId]/reject/route";
import { GET as testApprovalsGet } from "@/app/api/v1/admin/test-approvals/route";
import { POST as testApprovePost } from "@/app/api/v1/admin/test-approvals/[approvalId]/approve/route";
import { POST as testRejectPost } from "@/app/api/v1/admin/test-approvals/[approvalId]/reject/route";
import { GET as orgsGet } from "@/app/api/v1/admin/organizations/route";
import { GET as orgDetailGet } from "@/app/api/v1/admin/organizations/[organizationId]/route";
import { GET as teachersGet } from "@/app/api/v1/admin/teachers/route";
import { GET as teacherDetailGet } from "@/app/api/v1/admin/teachers/[teacherId]/route";
import { GET as studentsGet } from "@/app/api/v1/admin/students/route";
import { GET as studentDetailGet } from "@/app/api/v1/admin/students/[studentId]/route";
import { GET as classesGet } from "@/app/api/v1/admin/classes/route";
import { GET as notificationsGet } from "@/app/api/v1/admin/notifications/route";
import { GET as healthGet } from "@/app/api/v1/admin/system/health/route";
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
    not: mock(function() { return chainableMock; }),
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
  role: "student" | "teacher" | "super_admin";
  displayName: string;
  loginIdentifier?: string;
};

// --- Admin Organization Approvals Tests ---

describe("GET /api/v1/admin/organization-approvals", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns UNAUTHORIZED when not authenticated", async () => {
    currentSession = null;
    const request = new Request("http://localhost/api/v1/admin/organization-approvals");
    const response = await orgApprovalsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("returns FORBIDDEN when not a super_admin", async () => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };

    const request = new Request("http://localhost/api/v1/admin/organization-approvals");
    const response = await orgApprovalsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns paginated list of organization approvals", async () => {
    const orgsData = [
      {
        id: "org-1",
        name: "Test School",
        slug: "test-school",
        status: "pending",
        created_by_platform_user_id: "40000000-0000-4000-8000-000000000001",
        approved_by_platform_user_id: null,
        approved_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        platform_users: [
          {
            id: "40000000-0000-4000-8000-000000000001",
            email: "teacher@test.com",
            display_name: "Test Teacher",
          },
        ],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      organizations: () => createChainableMock({ data: orgsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/admin/organization-approvals");
    const response = await orgApprovalsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].name).toBe("Test School");
  });
});

describe("POST /api/v1/admin/organization-approvals/{approvalId}/approve", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns RESOURCE_NOT_FOUND when approval doesn't exist", async () => {
    currentSupabaseClient = buildSupabaseClient({
      organizations: () => createChainableMock({ data: null, error: { message: "Not found" } }, true),
    });

    const request = new Request(
      "http://localhost/api/v1/admin/organization-approvals/org-1/approve",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const context = { params: Promise.resolve({ approvalId: "org-1" }) };
    const response = await orgApprovePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });

  test("returns CONFLICT when organization is not pending", async () => {
    currentSupabaseClient = buildSupabaseClient({
      organizations: () => createChainableMock(
        { data: { id: "org-1", status: "active", approved_by_platform_user_id: "user-1", approved_at: "2026-01-01" }, error: null },
        true,
      ),
    });

    const request = new Request(
      "http://localhost/api/v1/admin/organization-approvals/org-1/approve",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const context = { params: Promise.resolve({ approvalId: "org-1" }) };
    const response = await orgApprovePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.CONFLICT);
  });

  test("successfully approves organization", async () => {
    const orgData = {
      id: "org-1",
      name: "Test School",
      slug: "test-school",
      status: "pending",
      approved_by_platform_user_id: null,
      approved_at: null,
    };

    const updatedOrgData = {
      id: "org-1",
      name: "Test School",
      slug: "test-school",
      status: "active",
      approved_by_platform_user_id: "10000000-0000-4000-8000-000000000001",
      approved_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      organizations: () => ({
        ...createChainableMock({ data: orgData, error: null }, true),
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedOrgData, error: null })) })),
            })),
            select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedOrgData, error: null })) })),
          })),
        })),
      }),
    });

    const request = new Request(
      "http://localhost/api/v1/admin/organization-approvals/org-1/approve",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const context = { params: Promise.resolve({ approvalId: "org-1" }) };
    const response = await orgApprovePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("active");
  });
});

describe("POST /api/v1/admin/organization-approvals/{approvalId}/reject", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when reason is missing", async () => {
    const request = new Request(
      "http://localhost/api/v1/admin/organization-approvals/org-1/reject",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const context = { params: Promise.resolve({ approvalId: "org-1" }) };
    const response = await orgRejectPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("successfully rejects organization", async () => {
    const orgData = {
      id: "org-1",
      name: "Test School",
      slug: "test-school",
      status: "pending",
      approved_by_platform_user_id: null,
      approved_at: null,
    };

    const updatedOrgData = {
      id: "org-1",
      name: "Test School",
      slug: "test-school",
      status: "suspended",
      approved_by_platform_user_id: "10000000-0000-4000-8000-000000000001",
      approved_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      organizations: () => ({
        ...createChainableMock({ data: orgData, error: null }, true),
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedOrgData, error: null })) })),
            })),
            select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedOrgData, error: null })) })),
          })),
        })),
      }),
    });

    const request = new Request(
      "http://localhost/api/v1/admin/organization-approvals/org-1/reject",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Invalid documentation" }),
      },
    );

    const context = { params: Promise.resolve({ approvalId: "org-1" }) };
    const response = await orgRejectPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("suspended");
    expect((body.data as Record<string, unknown>).rejectionReason).toBe("Invalid documentation");
  });
});

// --- Admin Material Approvals Tests ---

describe("GET /api/v1/admin/material-approvals", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of material approvals", async () => {
    const approvalsData = [
      {
        id: "approval-1",
        material_id: "material-1",
        decision: "pending",
        requested_by_platform_user_id: "40000000-0000-4000-8000-000000000001",
        reviewed_by_platform_user_id: null,
        decision_reason: null,
        reviewed_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        materials: [
          {
            id: "material-1",
            title: "Test Material",
            description: "A test material",
            scope_type: "organization",
            owner_teacher_id: "40000000-0000-4000-8000-000000000001",
            owner_organization_id: "org-1",
            status: "draft",
          },
        ],
        platform_users: [
          {
            id: "40000000-0000-4000-8000-000000000001",
            email: "teacher@test.com",
            display_name: "Test Teacher",
          },
        ],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      material_approvals: () => createChainableMock({ data: approvalsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/admin/material-approvals");
    const response = await materialApprovalsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].title).toBe("Test Material");
  });
});

describe("POST /api/v1/admin/material-approvals/{approvalId}/approve", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("successfully approves material", async () => {
    const approvalData = {
      id: "approval-1",
      material_id: "material-1",
      decision: "pending",
      materials: [
        {
          id: "material-1",
          title: "Test Material",
          status: "draft",
        },
      ],
    };

    const updatedApprovalData = {
      id: "approval-1",
      material_id: "material-1",
      decision: "approved",
      reviewed_by_platform_user_id: "10000000-0000-4000-8000-000000000001",
      reviewed_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      material_approvals: () => ({
        ...createChainableMock({ data: approvalData, error: null }, true),
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedApprovalData, error: null })) })),
            })),
            select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedApprovalData, error: null })) })),
          })),
        })),
      }),
      materials: () => ({
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      }),
    });

    const request = new Request(
      "http://localhost/api/v1/admin/material-approvals/approval-1/approve",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const context = { params: Promise.resolve({ approvalId: "approval-1" }) };
    const response = await materialApprovePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).decision).toBe("approved");
  });
});

describe("POST /api/v1/admin/material-approvals/{approvalId}/reject", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("successfully rejects material", async () => {
    const approvalData = {
      id: "approval-1",
      material_id: "material-1",
      decision: "pending",
      materials: [
        {
          id: "material-1",
          title: "Test Material",
          status: "draft",
        },
      ],
    };

    const updatedApprovalData = {
      id: "approval-1",
      material_id: "material-1",
      decision: "rejected",
      decision_reason: "Inappropriate content",
      reviewed_by_platform_user_id: "10000000-0000-4000-8000-000000000001",
      reviewed_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      material_approvals: () => ({
        ...createChainableMock({ data: approvalData, error: null }, true),
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedApprovalData, error: null })) })),
            })),
            select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedApprovalData, error: null })) })),
          })),
        })),
      }),
      materials: () => ({
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      }),
    });

    const request = new Request(
      "http://localhost/api/v1/admin/material-approvals/approval-1/reject",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Inappropriate content" }),
      },
    );

    const context = { params: Promise.resolve({ approvalId: "approval-1" }) };
    const response = await materialRejectPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).decision).toBe("rejected");
    expect((body.data as Record<string, unknown>).rejectionReason).toBe("Inappropriate content");
  });
});

// --- Admin Test Approvals Tests ---

describe("GET /api/v1/admin/test-approvals", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of test approvals", async () => {
    const approvalsData = [
      {
        id: "approval-1",
        test_id: "test-1",
        decision: "pending",
        requested_by_platform_user_id: "40000000-0000-4000-8000-000000000001",
        reviewed_by_platform_user_id: null,
        decision_reason: null,
        reviewed_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        tests: [
          {
            id: "test-1",
            title: "Test Exam",
            description: "A test exam",
            scope_type: "organization",
            owner_teacher_id: "40000000-0000-4000-8000-000000000001",
            owner_organization_id: "org-1",
            status: "draft",
          },
        ],
        platform_users: [
          {
            id: "40000000-0000-4000-8000-000000000001",
            email: "teacher@test.com",
            display_name: "Test Teacher",
          },
        ],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      test_approvals: () => createChainableMock({ data: approvalsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/admin/test-approvals");
    const response = await testApprovalsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].title).toBe("Test Exam");
  });
});

describe("POST /api/v1/admin/test-approvals/{approvalId}/approve", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("successfully approves test", async () => {
    const approvalData = {
      id: "approval-1",
      test_id: "test-1",
      decision: "pending",
      tests: [
        {
          id: "test-1",
          title: "Test Exam",
          status: "draft",
        },
      ],
    };

    const updatedApprovalData = {
      id: "approval-1",
      test_id: "test-1",
      decision: "approved",
      reviewed_by_platform_user_id: "10000000-0000-4000-8000-000000000001",
      reviewed_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      test_approvals: () => ({
        ...createChainableMock({ data: approvalData, error: null }, true),
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedApprovalData, error: null })) })),
            })),
            select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedApprovalData, error: null })) })),
          })),
        })),
      }),
      tests: () => ({
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      }),
    });

    const request = new Request(
      "http://localhost/api/v1/admin/test-approvals/approval-1/approve",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    const context = { params: Promise.resolve({ approvalId: "approval-1" }) };
    const response = await testApprovePost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).decision).toBe("approved");
  });
});

describe("POST /api/v1/admin/test-approvals/{approvalId}/reject", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("successfully rejects test", async () => {
    const approvalData = {
      id: "approval-1",
      test_id: "test-1",
      decision: "pending",
      tests: [
        {
          id: "test-1",
          title: "Test Exam",
          status: "draft",
        },
      ],
    };

    const updatedApprovalData = {
      id: "approval-1",
      test_id: "test-1",
      decision: "rejected",
      decision_reason: "Errors in questions",
      reviewed_by_platform_user_id: "10000000-0000-4000-8000-000000000001",
      reviewed_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    currentSupabaseClient = buildSupabaseClient({
      test_approvals: () => ({
        ...createChainableMock({ data: approvalData, error: null }, true),
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => ({
              select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedApprovalData, error: null })) })),
            })),
            select: mock(() => ({ single: mock(() => Promise.resolve({ data: updatedApprovalData, error: null })) })),
          })),
        })),
      }),
      tests: () => ({
        update: mock(() => ({
          eq: mock(() => ({
            is: mock(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      }),
    });

    const request = new Request(
      "http://localhost/api/v1/admin/test-approvals/approval-1/reject",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Errors in questions" }),
      },
    );

    const context = { params: Promise.resolve({ approvalId: "approval-1" }) };
    const response = await testRejectPost(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).decision).toBe("rejected");
    expect((body.data as Record<string, unknown>).rejectionReason).toBe("Errors in questions");
  });
});

// --- Admin Organizations Management Tests ---

describe("GET /api/v1/admin/organizations", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of all organizations", async () => {
    const orgsData = [
      {
        id: "org-1",
        name: "Test School",
        slug: "test-school",
        status: "active",
        created_by_platform_user_id: "40000000-0000-4000-8000-000000000001",
        approved_by_platform_user_id: "10000000-0000-4000-8000-000000000001",
        approved_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        platform_users: [
          {
            id: "40000000-0000-4000-8000-000000000001",
            email: "teacher@test.com",
            display_name: "Test Teacher",
          },
        ],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      organizations: () => createChainableMock({ data: orgsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/admin/organizations");
    const response = await orgsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].name).toBe("Test School");
  });
});

describe("GET /api/v1/admin/organizations/{organizationId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns organization details with stats", async () => {
    const orgData = {
      id: "org-1",
      name: "Test School",
      slug: "test-school",
      status: "active",
      created_by_platform_user_id: "40000000-0000-4000-8000-000000000001",
      approved_by_platform_user_id: "10000000-0000-4000-8000-000000000001",
      approved_at: "2026-01-01T00:00:00Z",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      platform_users: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          email: "teacher@test.com",
          display_name: "Test Teacher",
        },
      ],
    };

    currentSupabaseClient = buildSupabaseClient({
      organizations: () => createChainableMock({ data: orgData, error: null }, true),
      organization_memberships: () => createChainableMock({ data: [], error: null, count: 5 }),
      classes: () => createChainableMock({ data: [], error: null, count: 3 }),
      organization_students: () => createChainableMock({ data: [], error: null, count: 10 }),
    });

    const request = new Request("http://localhost/api/v1/admin/organizations/org-1");
    const context = { params: Promise.resolve({ organizationId: "org-1" }) };
    const response = await orgDetailGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).organizationId).toBe("org-1");
    expect((body.data as Record<string, unknown>).name).toBe("Test School");
    expect((body.data as Record<string, unknown>).stats).toBeDefined();
  });

  test("returns RESOURCE_NOT_FOUND for non-existent organization", async () => {
    currentSupabaseClient = buildSupabaseClient({
      organizations: () => createChainableMock({ data: null, error: { message: "Not found" } }, true),
    });

    const request = new Request("http://localhost/api/v1/admin/organizations/non-existent");
    const context = { params: Promise.resolve({ organizationId: "non-existent" }) };
    const response = await orgDetailGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });
});

// --- Admin Teachers Management Tests ---

describe("GET /api/v1/admin/teachers", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of all teachers", async () => {
    const teachersData = [
      {
        id: "40000000-0000-4000-8000-000000000001",
        email: "teacher@test.com",
        display_name: "Test Teacher",
        role: "teacher",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      platform_users: () => createChainableMock({ data: teachersData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/admin/teachers");
    const response = await teachersGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].email).toBe("teacher@test.com");
  });
});

describe("GET /api/v1/admin/teachers/{teacherId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns teacher details with organizations and classes", async () => {
    const teacherData = {
      id: "40000000-0000-4000-8000-000000000001",
      email: "teacher@test.com",
      display_name: "Test Teacher",
      role: "teacher",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const membershipsData = [
      {
        id: "membership-1",
        role: "owner",
        status: "active",
        joined_at: "2026-01-01T00:00:00Z",
        organizations: [
          {
            id: "org-1",
            name: "Test School",
            slug: "test-school",
            status: "active",
          },
        ],
      },
    ];

    const classTeachersData = [
      {
        id: "ct-1",
        role: "owner",
        is_primary: true,
        status: "active",
        classes: [
          {
            id: "class-1",
            title: "Math 101",
            status: "active",
            organization_id: "org-1",
          },
        ],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      platform_users: () => createChainableMock({ data: teacherData, error: null }, true),
      organization_memberships: () => createChainableMock({ data: membershipsData, error: null }),
      class_teachers: () => createChainableMock({ data: classTeachersData, error: null }),
    });

    const request = new Request("http://localhost/api/v1/admin/teachers/40000000-0000-4000-8000-000000000001");
    const context = { params: Promise.resolve({ teacherId: "40000000-0000-4000-8000-000000000001" }) };
    const response = await teacherDetailGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).teacherId).toBe("40000000-0000-4000-8000-000000000001");
    expect((body.data as Record<string, unknown>).organizations).toBeDefined();
    expect((body.data as Record<string, unknown>).classes).toBeDefined();
  });

  test("returns RESOURCE_NOT_FOUND for non-existent teacher", async () => {
    currentSupabaseClient = buildSupabaseClient({
      platform_users: () => createChainableMock({ data: null, error: { message: "Not found" } }, true),
    });

    const request = new Request("http://localhost/api/v1/admin/teachers/non-existent");
    const context = { params: Promise.resolve({ teacherId: "non-existent" }) };
    const response = await teacherDetailGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });
});

// --- Admin Students Management Tests ---

describe("GET /api/v1/admin/students", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of all students", async () => {
    const studentsData = [
      {
        id: "50000000-0000-4000-8000-000000000001",
        student_login: "ST-100001",
        first_name: "John",
        last_name: "Doe",
        middle_name: null,
        display_name: "John Doe",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => createChainableMock({ data: studentsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/admin/students");
    const response = await studentsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].studentLogin).toBe("ST-100001");
  });
});

describe("GET /api/v1/admin/students/{studentId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns student details with organizations and enrollments", async () => {
    const studentData = {
      id: "50000000-0000-4000-8000-000000000001",
      student_login: "ST-100001",
      first_name: "John",
      last_name: "Doe",
      middle_name: null,
      display_name: "John Doe",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const orgStudentsData = [
      {
        id: "os-1",
        status: "active",
        joined_at: "2026-01-01T00:00:00Z",
        organizations: [
          {
            id: "org-1",
            name: "Test School",
            slug: "test-school",
            status: "active",
          },
        ],
      },
    ];

    const enrollmentsData = [
      {
        id: "enroll-1",
        status: "active",
        joined_at: "2026-01-01T00:00:00Z",
        left_at: null,
        source: "manual",
        classes: [
          {
            id: "class-1",
            title: "Math 101",
            status: "active",
            organization_id: "org-1",
          },
        ],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => createChainableMock({ data: studentData, error: null }, true),
      organization_students: () => createChainableMock({ data: orgStudentsData, error: null }),
      class_enrollments: () => createChainableMock({ data: enrollmentsData, error: null }),
    });

    const request = new Request("http://localhost/api/v1/admin/students/50000000-0000-4000-8000-000000000001");
    const context = { params: Promise.resolve({ studentId: "50000000-0000-4000-8000-000000000001" }) };
    const response = await studentDetailGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).studentId).toBe("50000000-0000-4000-8000-000000000001");
    expect((body.data as Record<string, unknown>).organizations).toBeDefined();
    expect((body.data as Record<string, unknown>).enrollments).toBeDefined();
  });

  test("returns RESOURCE_NOT_FOUND for non-existent student", async () => {
    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => createChainableMock({ data: null, error: { message: "Not found" } }, true),
    });

    const request = new Request("http://localhost/api/v1/admin/students/non-existent");
    const context = { params: Promise.resolve({ studentId: "non-existent" }) };
    const response = await studentDetailGet(request, context, { session: currentSession as AuthenticatedSession });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });
});

// --- Admin Classes Management Tests ---

describe("GET /api/v1/admin/classes", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of all classes", async () => {
    const classesData = [
      {
        id: "class-1",
        organization_id: "org-1",
        title: "Math 101",
        description: "Introduction to Math",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        organizations: [
          {
            id: "org-1",
            name: "Test School",
            slug: "test-school",
          },
        ],
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      classes: () => createChainableMock({ data: classesData, error: null, count: 1 }),
      class_teachers: () => createChainableMock({ data: [], error: null }),
      class_enrollments: () => createChainableMock({ data: [], error: null }),
    });

    const request = new Request("http://localhost/api/v1/admin/classes");
    const response = await classesGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].title).toBe("Math 101");
  });
});

// --- Admin Notifications Tests ---

describe("GET /api/v1/admin/notifications", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns paginated list of all notifications", async () => {
    const notificationsData = [
      {
        id: "notif-1",
        recipient_type: "platform_user",
        recipient_platform_user_id: "40000000-0000-4000-8000-000000000001",
        recipient_student_profile_id: null,
        type: "assignment_published",
        payload_json: { assignmentId: "assign-1" },
        read_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    currentSupabaseClient = buildSupabaseClient({
      notifications: () => createChainableMock({ data: notificationsData, error: null, count: 1 }),
    });

    const request = new Request("http://localhost/api/v1/admin/notifications");
    const response = await notificationsGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
    expect((body.data as Array<Record<string, unknown>>)[0].type).toBe("assignment_published");
  });
});

// --- Admin System Health Tests ---

describe("GET /api/v1/admin/system/health", () => {
  beforeEach(() => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Admin User",
    };
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns system health status", async () => {
    currentSupabaseClient = buildSupabaseClient({
      platform_users: () => createChainableMock({ data: [], error: null, count: 10 }),
      organizations: () => createChainableMock({ data: [], error: null, count: 5 }),
      student_profiles: () => createChainableMock({ data: [], error: null, count: 20 }),
      classes: () => createChainableMock({ data: [], error: null, count: 8 }),
    });

    const request = new Request("http://localhost/api/v1/admin/system/health");
    const response = await healthGet(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("healthy");
    expect((body.data as Record<string, unknown>).version).toBeDefined();
    expect((body.data as Record<string, unknown>).database).toBeDefined();
    expect((body.data as Record<string, unknown>).stats).toBeDefined();
  });
});
