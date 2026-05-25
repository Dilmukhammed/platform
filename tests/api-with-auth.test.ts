import { describe, expect, mock, test } from "bun:test";

import { withAuth } from "@/lib/api/with-auth";
import { ErrorCodes } from "@/lib/api/errors";

// Mock getAuthSession to control session state in tests
const mockGetAuthSession = mock(() => Promise.resolve(null));

mock.module("@/lib/auth/session", () => ({
  getAuthSession: mockGetAuthSession,
}));

const dummyContext = {
  params: Promise.resolve({}),
};

const dummyHandler = mock(
  async (
    _req: Request,
    _ctx: { params: Promise<Record<string, string | string[]>> },
    auth: { session: { userId: string; role: string; displayName: string; loginIdentifier: string } },
  ) => {
    return new Response(JSON.stringify({ handlerCalled: true, userId: auth.session.userId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
);

describe("API withAuth middleware", () => {
  test("returns 401 when no session exists", async () => {
    mockGetAuthSession.mockResolvedValueOnce(null);

    const wrapped = withAuth(dummyHandler);
    const response = wrapped(new Request("http://localhost/api/v1/test"), dummyContext);
    const result = await response;

    expect(result.status).toBe(401);

    const body = (await result.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe("UNAUTHORIZED");
  });

  test("passes session to handler when authenticated", async () => {
    const session = {
      userId: "user-123",
      role: "teacher",
      displayName: "Test Teacher",
      loginIdentifier: "teacher@test.com",
    };

    mockGetAuthSession.mockResolvedValueOnce(session);

    const wrapped = withAuth(dummyHandler);
    const result = await wrapped(
      new Request("http://localhost/api/v1/test"),
      dummyContext,
    );

    expect(result.status).toBe(200);

    const body = (await result.json()) as Record<string, unknown>;
    expect(body.handlerCalled).toBe(true);
    expect(body.userId).toBe("user-123");
  });

  test("returns 403 when requiredRole does not match", async () => {
    const session = {
      userId: "user-123",
      role: "student",
      displayName: "Test Student",
      loginIdentifier: "student@test.com",
    };

    mockGetAuthSession.mockResolvedValueOnce(session);

    const wrapped = withAuth(dummyHandler, { requiredRole: "teacher" });
    const result = await wrapped(
      new Request("http://localhost/api/v1/test"),
      dummyContext,
    );

    expect(result.status).toBe(403);

    const body = (await result.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe("FORBIDDEN");
  });

  test("allows access when requiredRole matches", async () => {
    const session = {
      userId: "user-456",
      role: "super_admin",
      displayName: "Admin",
      loginIdentifier: "admin@test.com",
    };

    mockGetAuthSession.mockResolvedValueOnce(session);

    const wrapped = withAuth(dummyHandler, { requiredRole: "super_admin" });
    const result = await wrapped(
      new Request("http://localhost/api/v1/test"),
      dummyContext,
    );

    expect(result.status).toBe(200);
  });
});
