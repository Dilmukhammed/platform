import { describe, expect, mock, test, beforeEach } from "bun:test";

import { POST as uploadInitPost } from "@/app/api/v1/uploads/init/route";
import { POST as uploadCompletePost } from "@/app/api/v1/uploads/[uploadId]/complete/route";
import { GET as uploadStatusGet } from "@/app/api/v1/uploads/[uploadId]/route";
import { GET as jobStatusGet } from "@/app/api/v1/jobs/[jobId]/route";
import { ErrorCodes } from "@/lib/api/errors";
import { sharedJobStore, createJob } from "@/app/api/v1/jobs/store";

// --- Mocks ---

let currentSupabaseClient: Record<string, unknown> = {};
let currentSession: Record<string, unknown> | null = null;
let currentTableOverrides: Record<string, () => Record<string, unknown>> = {};
let uploadSessionRows = new Map<string, Record<string, unknown>>();
let storageObjects = new Map<string, Record<string, unknown>>();

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
      select: mock(() => ({ single: mock(() => resolved) })),
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
    if (table === "upload_sessions") return createUploadSessionsTableMock();
    return createChainableMock({ data: [], error: null });
  });

  return {
    from: fromMock,
    storage: {
      from: mock(() => ({
        createSignedUploadUrl: mock((path: string) => Promise.resolve({
          data: {
            signedUrl: `https://example.supabase.co/storage/v1/object/upload/sign/uploads/${path}?token=test-token`,
            path,
            token: "test-token",
          },
          error: null,
        })),
        info: mock((path: string) => {
          const file = storageObjects.get(path);
          if (!file) {
            return Promise.resolve({ data: null, error: new Error("Object not found") });
          }

          return Promise.resolve({ data: file, error: null });
        }),
      })),
    },
  };
}

function createUploadSessionsTableMock() {
  return {
    select: mock(() => ({
      eq: mock((column: string, value: string) => ({
        maybeSingle: mock(() => {
          const row = Array.from(uploadSessionRows.values()).find((candidate) => candidate[column] === value) ?? null;
          return Promise.resolve({ data: row, error: null });
        }),
      })),
    })),
    insert: mock((payload: Record<string, unknown>) => {
      const row = {
        completed_file_size_bytes: null,
        completed_mime_type: null,
        storage_object_id: null,
        storage_object_version: null,
        storage_etag: null,
        checksum: null,
        error_message: null,
        completed_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...payload,
      };
      uploadSessionRows.set(String(payload.id), row);

      return {
        select: mock(() => ({
          single: mock(() => Promise.resolve({ data: row, error: null })),
        })),
      };
    }),
    update: mock((patch: Record<string, unknown>) => ({
      eq: mock((column: string, value: string) => ({
        eq: mock((secondColumn: string, secondValue: string) => ({
          select: mock(() => ({
            maybeSingle: mock(() => {
              const row = Array.from(uploadSessionRows.values()).find((candidate) => candidate[column] === value);
              if (!row || row[secondColumn] !== secondValue) {
                return Promise.resolve({ data: null, error: null });
              }

              const updated = { ...row, ...patch };
              uploadSessionRows.set(String(updated.id), updated);
              return Promise.resolve({ data: updated, error: null });
            }),
          })),
        })),
      })),
    })),
  };
}

function resetUploadMocks() {
  uploadSessionRows.clear();
  storageObjects.clear();
  currentSupabaseClient = buildSupabaseClient(currentTableOverrides);
}

function seedUploadSession(row: Record<string, unknown>) {
  uploadSessionRows.set(String(row.id), row);
}

// Type import for session
type AuthenticatedSession = {
  userId: string;
  role: "student" | "teacher" | "super_admin";
  displayName: string;
  loginIdentifier?: string;
};

// --- Upload Init Tests ---

describe("POST /api/v1/uploads/init", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentTableOverrides = {};
    resetUploadMocks();
  });

  test("returns UNAUTHORIZED when not authenticated", async () => {
    currentSession = null;
    const request = new Request("http://localhost/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadType: "material" }),
    });
    const response = await uploadInitPost(request);
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

    const request = new Request("http://localhost/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadType: "material" }),
    });
    const response = await uploadInitPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("allows students to initialize submission uploads via the shared boundary", async () => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };

    const request = new Request("http://localhost/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadType: "submission",
        fileName: "submission.pdf",
        fileSize: 2048,
        mimeType: "application/pdf",
      }),
    });
    const response = await uploadInitPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).uploadId).toBeDefined();
  });

  test("returns VALIDATION_ERROR for invalid upload type", async () => {
    const request = new Request("http://localhost/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadType: "invalid_type" }),
    });
    const response = await uploadInitPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("returns VALIDATION_ERROR for file size exceeding limit", async () => {
    const request = new Request("http://localhost/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadType: "material",
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB, exceeds 1GB limit
      }),
    });
    const response = await uploadInitPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  test("creates upload record for material type", async () => {
    const request = new Request("http://localhost/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadType: "material",
        fileName: "test.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
      }),
    });
    const response = await uploadInitPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect((body.data as Record<string, unknown>).uploadId).toBeDefined();
    expect((body.data as Record<string, unknown>).status).toBe("pending");
    expect(String((body.data as Record<string, unknown>).targetUrl)).toContain("supabase.co");
    expect((body.data as Record<string, unknown>).fields).toBeDefined();
    const upload = (body.data as Record<string, unknown>).upload as Record<string, unknown>;
    expect(upload.provider).toBe("supabase");
    expect(upload.bucket).toBe("uploads");
    expect(upload.path).toContain("uploads/material/teacher/");
    expect(response.status).toBe(201);
  });

  test("creates upload record for submission type", async () => {
    const request = new Request("http://localhost/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadType: "submission",
        contextId: "60000000-0000-4000-8000-000000000001",
        contextType: "assignment_result",
        fileName: "submission.dwg",
        fileSize: 2048,
        mimeType: "application/dwg",
      }),
    });
    const response = await uploadInitPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    const upload = (body.data as Record<string, unknown>).upload as Record<string, unknown>;
    expect(upload.path).toContain("assignment_result/60000000-0000-4000-8000-000000000001");
  });

  test("creates upload record for test_asset type", async () => {
    const request = new Request("http://localhost/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadType: "test_asset",
        fileName: "question_image.png",
        fileSize: 512,
        mimeType: "image/png",
      }),
    });
    const response = await uploadInitPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect((body.data as Record<string, unknown>).uploadId).toBeDefined();
  });

  test("returns allowed MIME types for material uploads", async () => {
    const request = new Request("http://localhost/api/v1/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadType: "material" }),
    });
    const response = await uploadInitPost(request);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    const fields = (body.data as Record<string, unknown>).fields as Record<string, unknown>;
    expect(fields.allowedMimeTypes).toBeDefined();
    expect(Array.isArray(fields.allowedMimeTypes)).toBe(true);
    expect(fields.allowedMimeTypes).toContain("application/pdf");
  });
});

// --- Upload Complete Tests ---

describe("POST /api/v1/uploads/{uploadId}/complete", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentTableOverrides = {};
    resetUploadMocks();
  });

  test("returns UNAUTHORIZED when not authenticated", async () => {
    currentSession = null;
    const uploadId = "11111111-1111-4111-8111-111111111111";
    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath: `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/test.pdf`,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
      }),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("returns RESOURCE_NOT_FOUND for non-existent upload", async () => {
    const uploadId = "22222222-2222-4222-8222-222222222222";
    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath: `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/test.pdf`,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
      }),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });

  test("returns FORBIDDEN when accessing another user's upload", async () => {
    const uploadId = "33333333-3333-4333-8333-333333333333";
    const storagePath = `uploads/material/teacher/other-user-id/unscoped/${uploadId}/test.pdf`;
    seedUploadSession({
      id: uploadId,
      status: "pending",
      uploadType: "material",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "other-user-id",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "test.pdf",
      declared_file_size_bytes: 1024,
      declared_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: storagePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
      }),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
    expect(uploadSessionRows.get(uploadId)?.status).toBe("pending");
  });

  test("returns RESOURCE_NOT_FOUND when completion is requested for a missing upload", async () => {
    const uploadId = "44444444-4444-4444-8444-444444444444";
    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });

  test("returns success when completed upload is retried with matching metadata", async () => {
    const uploadId = "55555555-5555-4555-8555-555555555555";
    const storagePath = `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/test.pdf`;
    seedUploadSession({
      id: uploadId,
      status: "completed",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "test.pdf",
      declared_file_size_bytes: 1024,
      declared_mime_type: "application/pdf",
      completed_file_size_bytes: 1024,
      completed_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: storagePath,
      storage_object_id: "object-1",
      storage_object_version: "v1",
      storage_etag: "etag-1",
      checksum: "sha256:match",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    storageObjects.set(storagePath, {
      id: "object-1",
      version: "v1",
      etag: "etag-1",
      size: 1024,
      contentType: "application/pdf",
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
        checksum: "sha256:match",
      }),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("completed");
  });

  test("returns CONFLICT when upload has failed", async () => {
    const uploadId = "66666666-6666-4666-8666-666666666666";
    const storagePath = `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/test.pdf`;
    seedUploadSession({
      id: uploadId,
      status: "failed",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "test.pdf",
      declared_file_size_bytes: 1024,
      declared_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: storagePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: "Upload failed",
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
      }),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.CONFLICT);
  });

  test("completes upload successfully for material type", async () => {
    const uploadId = "77777777-7777-4777-8777-777777777777";
    const storagePath = `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/test.pdf`;
    seedUploadSession({
      id: uploadId,
      status: "pending",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "test.pdf",
      declared_file_size_bytes: 1024,
      declared_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: storagePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    storageObjects.set(storagePath, {
      id: "object-2",
      version: "v2",
      etag: "etag-2",
      size: 1024,
      contentType: "application/pdf",
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
        checksum: "sha256:abc123",
      }),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).uploadId).toBe(uploadId);
    expect((body.data as Record<string, unknown>).status).toBe("completed");
    expect((body.data as Record<string, unknown>).fileName).toBe("test.pdf");
    expect((body.data as Record<string, unknown>).fileSize).toBe(1024);
    expect((body.data as Record<string, unknown>).mimeType).toBe("application/pdf");
    expect((body.data as Record<string, unknown>).storagePath).toBe(storagePath);
    expect((body.data as Record<string, unknown>).checksum).toBe("sha256:abc123");
    expect((body.data as Record<string, unknown>).completedAt).toBeDefined();
  });

  test("returns RESOURCE_NOT_FOUND for missing object without failing the upload session", async () => {
    // Suppress expected console.error output for this test
    const originalConsoleError = console.error;
    console.error = mock(() => {});

    const uploadId = "88888888-8888-4888-8888-888888888888";
    const storagePath = `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/test.pdf`;
    seedUploadSession({
      id: uploadId,
      status: "pending",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "test.pdf",
      declared_file_size_bytes: 1024,
      declared_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: storagePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
      }),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    // Restore console.error
    console.error = originalConsoleError;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
    expect(uploadSessionRows.get(uploadId)?.status).toBe("pending");
  });

  test("allows finalize retry after object appears later", async () => {
    // Suppress expected console.error output for the first attempt
    const originalConsoleError = console.error;
    console.error = mock(() => {});

    const uploadId = "99999999-9999-4999-8999-999999999999";
    const storagePath = `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/test.pdf`;
    seedUploadSession({
      id: uploadId,
      status: "pending",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "test.pdf",
      declared_file_size_bytes: 1024,
      declared_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: storagePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const buildRequest = () => new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
      }),
    });

    const firstResponse = await uploadCompletePost(buildRequest(), { params: Promise.resolve({ uploadId }) });
    const firstBody = (await firstResponse.json()) as Record<string, unknown>;

    expect(firstBody.success).toBe(false);
    expect((firstBody.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
    expect(uploadSessionRows.get(uploadId)?.status).toBe("pending");

    storageObjects.set(storagePath, {
      id: "object-late",
      version: "v-late",
      etag: "etag-late",
      size: 1024,
      contentType: "application/pdf",
    });

    // Restore console.error for the second attempt which should succeed
    console.error = originalConsoleError;

    const secondResponse = await uploadCompletePost(buildRequest(), { params: Promise.resolve({ uploadId }) });
    const secondBody = (await secondResponse.json()) as Record<string, unknown>;

    expect(secondBody.success).toBe(true);
    expect((secondBody.data as Record<string, unknown>).status).toBe("completed");
  });

  test("returns VALIDATION_ERROR when stored object metadata does not match the reserved upload", async () => {
    const uploadId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const storagePath = `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/test.pdf`;
    seedUploadSession({
      id: uploadId,
      status: "pending",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "test.pdf",
      declared_file_size_bytes: 1024,
      declared_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: storagePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    storageObjects.set(storagePath, {
      id: "object-mismatch",
      version: "v-mismatch",
      etag: "etag-mismatch",
      size: 2048,
      contentType: "application/octet-stream",
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
      }),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(uploadSessionRows.get(uploadId)?.status).toBe("pending");
  });

  test("returns CONFLICT when a completed upload's stored object identity changes", async () => {
    const uploadId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const storagePath = `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/test.pdf`;
    seedUploadSession({
      id: uploadId,
      status: "completed",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "test.pdf",
      declared_file_size_bytes: 1024,
      declared_mime_type: "application/pdf",
      completed_file_size_bytes: 1024,
      completed_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: storagePath,
      storage_object_id: "object-original",
      storage_object_version: "v-original",
      storage_etag: "etag-original",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    storageObjects.set(storagePath, {
      id: "object-replaced",
      version: "v-replaced",
      etag: "etag-replaced",
      size: 1024,
      contentType: "application/pdf",
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storagePath,
        fileSize: 1024,
        mimeType: "application/pdf",
        fileName: "test.pdf",
      }),
    });
    const response = await uploadCompletePost(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});

// --- Upload Status Tests ---

describe("GET /api/v1/uploads/{uploadId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    currentTableOverrides = {};
    resetUploadMocks();
  });

  test("returns UNAUTHORIZED when not authenticated", async () => {
    currentSession = null;
    const uploadId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}`);
    const response = await uploadStatusGet(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("returns RESOURCE_NOT_FOUND for non-existent upload", async () => {
    const uploadId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}`);
    const response = await uploadStatusGet(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });

  test("returns FORBIDDEN when accessing another user's upload", async () => {
    const uploadId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    seedUploadSession({
      id: uploadId,
      status: "pending",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "other-user-id",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: null,
      declared_file_size_bytes: null,
      declared_mime_type: null,
      storage_bucket: "uploads",
      storage_path: `uploads/material/teacher/other-user-id/unscoped/${uploadId}/test.pdf`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}`);
    const response = await uploadStatusGet(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns pending upload status", async () => {
    const uploadId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    seedUploadSession({
      id: uploadId,
      status: "pending",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: "60000000-0000-4000-8000-000000000001",
      context_type: "material",
      original_file_name: "pending.pdf",
      declared_file_size_bytes: 100,
      declared_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: `uploads/material/teacher/40000000-0000-4000-8000-000000000001/material/60000000-0000-4000-8000-000000000001/${uploadId}/pending.pdf`,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}`);
    const response = await uploadStatusGet(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).uploadId).toBe(uploadId);
    expect((body.data as Record<string, unknown>).status).toBe("pending");
    expect((body.data as Record<string, unknown>).uploadType).toBe("material");
    expect((body.data as Record<string, unknown>).contextId).toBe("60000000-0000-4000-8000-000000000001");
    expect((body.data as Record<string, unknown>).contextType).toBe("material");
    expect((body.data as Record<string, unknown>).createdAt).toBe("2026-01-01T00:00:00Z");
    expect((body.data as Record<string, unknown>).updatedAt).toBe("2026-01-01T00:00:00Z");
    // Should not include file metadata for pending uploads
    expect((body.data as Record<string, unknown>).fileName).toBeUndefined();
  });

  test("returns completed upload with file metadata", async () => {
    const uploadId = "12121212-1212-4212-8212-121212121212";
    seedUploadSession({
      id: uploadId,
      status: "completed",
      upload_type: "submission",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "completed.pdf",
      declared_file_size_bytes: 2048,
      declared_mime_type: "application/pdf",
      completed_file_size_bytes: 2048,
      completed_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: `uploads/submission/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/completed.pdf`,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      completed_at: "2026-01-02T00:00:00Z",
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}`);
    const response = await uploadStatusGet(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("completed");
    expect((body.data as Record<string, unknown>).fileName).toBe("completed.pdf");
    expect((body.data as Record<string, unknown>).fileSize).toBe(2048);
    expect((body.data as Record<string, unknown>).mimeType).toBe("application/pdf");
    expect((body.data as Record<string, unknown>).storagePath).toBe(`uploads/submission/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/completed.pdf`);
    expect((body.data as Record<string, unknown>).completedAt).toBe("2026-01-02T00:00:00Z");
  });

  test("returns failed upload with error message", async () => {
    const uploadId = "13131313-1313-4313-8313-131313131313";
    seedUploadSession({
      id: uploadId,
      status: "failed",
      upload_type: "material",
      owner_role: "teacher",
      owner_platform_user_id: "40000000-0000-4000-8000-000000000001",
      owner_student_profile_id: null,
      context_id: null,
      context_type: null,
      original_file_name: "failed.pdf",
      declared_file_size_bytes: 300,
      declared_mime_type: "application/pdf",
      storage_bucket: "uploads",
      storage_path: `uploads/material/teacher/40000000-0000-4000-8000-000000000001/unscoped/${uploadId}/failed.pdf`,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      error_message: "Network error during upload",
    });

    const request = new Request(`http://localhost/api/v1/uploads/${uploadId}`);
    const response = await uploadStatusGet(request, { params: Promise.resolve({ uploadId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("failed");
    expect((body.data as Record<string, unknown>).error).toBe("Network error during upload");
  });
});

// --- Job Status Tests ---

describe("GET /api/v1/jobs/{jobId}", () => {
  beforeEach(() => {
    currentSession = {
      userId: "40000000-0000-4000-8000-000000000001",
      role: "teacher",
      displayName: "Test Teacher",
    };
    sharedJobStore.clear();
  });

  test("returns UNAUTHORIZED when not authenticated", async () => {
    currentSession = null;
    const request = new Request("http://localhost/api/v1/jobs/job-123");
    const response = await jobStatusGet(request, { params: Promise.resolve({ jobId: "job-123" }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  test("returns RESOURCE_NOT_FOUND for non-existent job", async () => {
    const request = new Request("http://localhost/api/v1/jobs/non-existent");
    const response = await jobStatusGet(request, { params: Promise.resolve({ jobId: "non-existent" }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  });

  test("returns FORBIDDEN when accessing another user's job", async () => {
    const jobId = "job-other";
    createJob(jobId, "test_draft_generation", "other-user-id", "teacher");

    const request = new Request(`http://localhost/api/v1/jobs/${jobId}`);
    const response = await jobStatusGet(request, { params: Promise.resolve({ jobId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(false);
    expect((body.error as Record<string, unknown>).code).toBe(ErrorCodes.FORBIDDEN);
  });

  test("returns queued job status with message", async () => {
    const jobId = "job-queued";
    createJob(jobId, "test_draft_generation", "40000000-0000-4000-8000-000000000001", "teacher");

    const request = new Request(`http://localhost/api/v1/jobs/${jobId}`);
    const response = await jobStatusGet(request, { params: Promise.resolve({ jobId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).jobId).toBe(jobId);
    expect((body.data as Record<string, unknown>).jobType).toBe("test_draft_generation");
    expect((body.data as Record<string, unknown>).status).toBe("queued");
    expect((body.data as Record<string, unknown>).progress).toBe(0);
    expect((body.data as Record<string, unknown>).message).toContain("queued");
  });

  test("returns processing job status with progress", async () => {
    const jobId = "job-processing";
    const job = createJob(jobId, "bulk_import", "40000000-0000-4000-8000-000000000001", "teacher");
    job.status = "processing";
    job.progress = 45;
    job.updatedAt = new Date().toISOString();

    const request = new Request(`http://localhost/api/v1/jobs/${jobId}`);
    const response = await jobStatusGet(request, { params: Promise.resolve({ jobId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("processing");
    expect((body.data as Record<string, unknown>).progress).toBe(45);
    expect((body.data as Record<string, unknown>).message).toContain("in progress");
  });

  test("returns succeeded job with result", async () => {
    const jobId = "job-succeeded";
    const job = createJob(jobId, "test_draft_generation", "40000000-0000-4000-8000-000000000001", "teacher");
    job.status = "succeeded";
    job.progress = 100;
    job.result = { testId: "test-123" };
    job.updatedAt = new Date().toISOString();

    const request = new Request(`http://localhost/api/v1/jobs/${jobId}`);
    const response = await jobStatusGet(request, { params: Promise.resolve({ jobId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("succeeded");
    expect((body.data as Record<string, unknown>).progress).toBe(100);
    expect((body.data as Record<string, unknown>).message).toContain("successfully");
    const result = (body.data as Record<string, unknown>).result as Record<string, unknown>;
    expect(result.testId).toBe("test-123");
    expect(result.testUrl).toBe("/api/v1/teacher/tests/test-123");
  });

  test("returns failed job with error", async () => {
    const jobId = "job-failed";
    const job = createJob(jobId, "export", "40000000-0000-4000-8000-000000000001", "teacher");
    job.status = "failed";
    job.result = { error: "Export failed: storage quota exceeded" };
    job.updatedAt = new Date().toISOString();

    const request = new Request(`http://localhost/api/v1/jobs/${jobId}`);
    const response = await jobStatusGet(request, { params: Promise.resolve({ jobId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).status).toBe("failed");
    expect((body.data as Record<string, unknown>).message).toContain("failed");
    expect((body.data as Record<string, unknown>).error).toBe("Export failed: storage quota exceeded");
  });

  test("supports all job types", async () => {
    const jobTypes = ["test_draft_generation", "bulk_import", "export", "upload_processing"] as const;

    for (const jobType of jobTypes) {
      sharedJobStore.clear();
      const jobId = `job-${jobType}`;
      createJob(jobId, jobType, "40000000-0000-4000-8000-000000000001", "teacher");

      const request = new Request(`http://localhost/api/v1/jobs/${jobId}`);
      const response = await jobStatusGet(request, { params: Promise.resolve({ jobId }) });
      const body = (await response.json()) as Record<string, unknown>;

      expect(body.success).toBe(true);
      expect((body.data as Record<string, unknown>).jobType).toBe(jobType);
    }
  });

  test("allows student to access their own job", async () => {
    currentSession = {
      userId: "50000000-0000-4000-8000-000000000001",
      role: "student",
      displayName: "Test Student",
    };

    const jobId = "job-student";
    createJob(jobId, "upload_processing", "50000000-0000-4000-8000-000000000001", "student");

    const request = new Request(`http://localhost/api/v1/jobs/${jobId}`);
    const response = await jobStatusGet(request, { params: Promise.resolve({ jobId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).jobId).toBe(jobId);
  });

  test("allows super_admin to access their own job", async () => {
    currentSession = {
      userId: "10000000-0000-4000-8000-000000000001",
      role: "super_admin",
      displayName: "Test Admin",
    };

    const jobId = "job-admin";
    createJob(jobId, "bulk_import", "10000000-0000-4000-8000-000000000001", "super_admin");

    const request = new Request(`http://localhost/api/v1/jobs/${jobId}`);
    const response = await jobStatusGet(request, { params: Promise.resolve({ jobId }) });
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.success).toBe(true);
    expect((body.data as Record<string, unknown>).jobId).toBe(jobId);
  });
});
