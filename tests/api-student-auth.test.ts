import { describe, expect, mock, test, beforeEach } from "bun:test";

import { POST as loginPost } from "@/app/api/v1/student/auth/login/route";
import { POST as logoutPost } from "@/app/api/v1/student/auth/logout/route";
import { POST as createProfilePost } from "@/app/api/v1/student/auth/create-profile/route";
import { ErrorCodes } from "@/lib/api/errors";

// --- Mocks ---

const mockWriteAuthSession = mock(() => Promise.resolve());
const mockClearAuthSession = mock(() => Promise.resolve());

// Mutable state that tests can override per-test
let currentSupabaseClient: Record<string, unknown> = {};

mock.module("@/lib/auth/session", () => ({
  getAuthSession: mock(() => Promise.resolve(null)),
  writeAuthSession: mockWriteAuthSession,
  clearAuthSession: mockClearAuthSession,
}));

mock.module("@/lib/supabase/server-client", () => ({
  createServerClient: () => currentSupabaseClient,
}));

/**
 * Build a Supabase mock client where each table name maps to a handler.
 * The handler returns an object with .select() and/or .insert() methods
 * whose chains match the actual Supabase query builder pattern:
 *   .select().eq().is().limit()
 *   .insert().select().single()
 */
function buildSupabaseClient(tables: Record<string, () => Record<string, unknown>>) {
  const fromMock = mock((table: string) => {
    const handler = tables[table];
    if (handler) return handler();
    // Default: empty select chain
    const limitMock = mock(() => Promise.resolve({ data: [], error: null }));
    const isMock = mock(() => ({ limit: limitMock }));
    const eqMock = mock(() => ({ is: isMock }));
    const selectMock = mock(() => ({ eq: eqMock }));
    return { select: selectMock };
  });
  return { from: fromMock };
}

/** Build a select chain: .select().eq().is().limit() */
function selectChain(result: { data: unknown; error: unknown }) {
  const resolved = Promise.resolve(result);
  const limitMock = mock(() => resolved);
  const isMock = mock(() => ({ limit: limitMock }));
  const eqMock = mock(() => ({ is: isMock }));
  const selectMock = mock(() => ({ eq: eqMock }));
  return { select: selectMock };
}

/** Build an insert chain: .insert().select().single() */
function insertChain(result: { data: unknown; error: unknown }) {
  const singleMock = mock(() => Promise.resolve(result));
  const selectMock = mock(() => ({ single: singleMock }));
  const insertMock = mock(() => ({ select: selectMock }));
  return { insert: insertMock };
}

// --- Student Login Tests ---

describe("POST /api/v1/student/auth/login", () => {
  beforeEach(() => {
    mockWriteAuthSession.mockClear();
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when studentLogin is missing", async () => {
    const request = new Request("http://localhost/api/v1/student/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "1111" }),
    });

    const response = await loginPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("returns VALIDATION_ERROR when pin is missing", async () => {
    const request = new Request("http://localhost/api/v1/student/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentLogin: "ST-100001" }),
    });

    const response = await loginPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("returns UNAUTHORIZED when student profile not found", async () => {
    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => selectChain({ data: [], error: null }),
    });

    const request = new Request("http://localhost/api/v1/student/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentLogin: "ST-999999", pin: "1111" }),
    });

    const response = await loginPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("returns UNAUTHORIZED when PIN is incorrect", async () => {
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
      student_profiles: () => selectChain({ data: profileData, error: null }),
    });

    const request = new Request("http://localhost/api/v1/student/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentLogin: "ST-100001", pin: "9999" }),
    });

    const response = await loginPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("returns success and writes session for valid credentials", async () => {
    // md5("1111") = b59c67bf196a4758191e42f76670ceba
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
      student_profiles: () => selectChain({ data: profileData, error: null }),
    });

    const request = new Request("http://localhost/api/v1/student/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentLogin: "ST-100001", pin: "1111" }),
    });

    const response = await loginPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const data = body.data as Record<string, unknown>;
    expect(data.authenticated).toBe(true);
    expect(data.role).toBe("student");
    expect((data.principal as Record<string, unknown>).type).toBe("student");

    expect(mockWriteAuthSession).toHaveBeenCalledTimes(1);
    const sessionArg = mockWriteAuthSession.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sessionArg.role).toBe("student");
    expect(sessionArg.loginIdentifier).toBe("ST-100001");
  });

  test("returns INTERNAL_ERROR on Supabase query failure", async () => {
    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () =>
        selectChain({ data: null, error: { message: "Connection refused" } }),
    });

    const request = new Request("http://localhost/api/v1/student/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentLogin: "ST-100001", pin: "1111" }),
    });

    const response = await loginPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.INTERNAL_ERROR);
  });
});

// --- Student Logout Tests ---

describe("POST /api/v1/student/auth/logout", () => {
  beforeEach(() => {
    mockClearAuthSession.mockClear();
  });

  test("clears auth session and returns success", async () => {
    const response = await logoutPost();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const data = body.data as Record<string, unknown>;
    expect(data.authenticated).toBe(false);

    expect(mockClearAuthSession).toHaveBeenCalledTimes(1);
  });
});

// --- Create Profile Tests ---

describe("POST /api/v1/student/auth/create-profile", () => {
  beforeEach(() => {
    mockWriteAuthSession.mockClear();
    currentSupabaseClient = buildSupabaseClient({});
  });

  test("returns VALIDATION_ERROR when firstName is too short", async () => {
    const request = new Request("http://localhost/api/v1/student/auth/create-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "A", lastName: "Morozov", pin: "1111" }),
    });

    const response = await createProfilePost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("returns VALIDATION_ERROR when PIN is not 4 digits", async () => {
    const request = new Request("http://localhost/api/v1/student/auth/create-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Alex", lastName: "Morozov", pin: "abc" }),
    });

    const response = await createProfilePost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("returns CONFLICT when generated login already exists", async () => {
    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => ({
        ...selectChain({ data: [{ id: "existing-id" }], error: null }),
        ...insertChain({ data: null, error: null }),
      }),
    });

    const request = new Request("http://localhost/api/v1/student/auth/create-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Alex", lastName: "Morozov", pin: "1111" }),
    });

    const response = await createProfilePost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.CONFLICT);
  });

  test("creates profile, credential, and auto-logs in", async () => {
    const insertedProfile = {
      id: "new-profile-id",
      student_login: "ST-100003",
      display_name: "New Student",
    };

    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => ({
        ...selectChain({ data: [], error: null }),
        ...insertChain({ data: insertedProfile, error: null }),
      }),
      student_credentials: () => ({
        insert: mock(() => Promise.resolve({ error: null })),
      }),
    });

    const request = new Request("http://localhost/api/v1/student/auth/create-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "New", lastName: "Student", pin: "1234" }),
    });

    const response = await createProfilePost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);

    const data = body.data as Record<string, unknown>;
    expect(data.authenticated).toBe(true);
    expect(data.role).toBe("student");
    expect(data.studentLogin).toBe("ST-100003");

    expect(mockWriteAuthSession).toHaveBeenCalledTimes(1);
  });

  test("returns INTERNAL_ERROR when profile insert fails", async () => {
    currentSupabaseClient = buildSupabaseClient({
      student_profiles: () => ({
        ...selectChain({ data: [], error: null }),
        ...insertChain({ data: null, error: { message: "Insert failed" } }),
      }),
    });

    const request = new Request("http://localhost/api/v1/student/auth/create-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Alex", lastName: "Morozov", pin: "1111" }),
    });

    const response = await createProfilePost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.INTERNAL_ERROR);
  });
});
