/**
 * TDD Tests for server-side API client
 * Tests follow RED → GREEN → REFACTOR pattern
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { t } from "@/lib/translations";

// Mock next/headers cookies
const mockCookieStore = {
  get: mock(() => undefined),
};

const mockHeaderStore = {
  get: mock((name: string) => {
    if (name === "host") {
      return "localhost:3000";
    }

    return undefined;
  }),
};

mock.module("next/headers", () => ({
  cookies: async () => mockCookieStore,
  headers: async () => mockHeaderStore,
}));

// Import after mocking
const { apiGet, apiPost, apiPut, apiPatch, apiDelete } = await import(
  "@/lib/api/server-fetch"
);

describe("server-fetch API client", () => {
  beforeEach(() => {
    mockCookieStore.get.mockClear();
    mockHeaderStore.get.mockClear();
    // @ts-expect-error - resetting fetch mock
    global.fetch = undefined;
  });

  describe("apiGet", () => {
    it("should forward session cookie for /api/v1/* endpoints", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "test-session-token" });
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { id: 1, name: "Test" },
              error: null,
              meta: {},
            }),
        } as Response)
      );
      global.fetch = mockFetch;

      // Act
      await apiGet("/api/v1/student/profile");

      // Assert
      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers.Cookie).toBe("platform_auth_session=test-session-token");
    });

    it("should not add Cookie header when no session exists", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue(undefined);
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { id: 1 },
              error: null,
              meta: {},
            }),
        } as Response)
      );
      global.fetch = mockFetch;

      // Act
      await apiGet("/api/v1/student/profile");

      // Assert
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers.Cookie).toBeUndefined();
    });

    it("should unwrap envelope and return data on success", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      const userData = { id: 1, name: "John", email: "john@example.com" };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: userData,
              error: null,
              meta: {},
            }),
        } as Response)
      );

      // Act
      type UserDTO = { id: number; name: string; email: string };
      const result = await apiGet<UserDTO>("/api/v1/student/profile");

      // Assert
      expect(result).toEqual(userData);
    });

    it("should throw typed error on API failure", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () =>
            Promise.resolve({
              success: false,
              data: null,
              error: { code: "UNAUTHORIZED", message: "Invalid session" },
              meta: { httpStatus: 401 },
            }),
        } as Response)
      );

      // Act & Assert
      await expect(apiGet("/api/v1/student/profile")).rejects.toThrow("Invalid session");
    });

    it("should throw for non-API errors (network, etc.)", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      global.fetch = mock(() => Promise.reject(new Error("Network error")));

      // Act & Assert
      await expect(apiGet("/api/v1/student/profile")).rejects.toThrow("Network error");
    });

    it("should return paginated response with meta when requested", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      const items = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, pageSize: 20, total: 100, totalPages: 5 };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: items,
              error: null,
              meta: { pagination },
            }),
        } as Response)
      );

      // Act
      type Item = { id: number };
      const result = await apiGet<Item[]>("/api/v1/items", { paginated: true });

      // Assert
      expect(result.data).toEqual(items);
      expect(result.meta.pagination).toEqual(pagination);
    });

    it("should pass query parameters in URL", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [],
              error: null,
              meta: {},
            }),
        } as Response)
      );
      global.fetch = mockFetch;

      // Act
      await apiGet("/api/v1/items", { params: { page: "1", search: "test" } });

      // Assert
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe("http://localhost:3000/api/v1/items?page=1&search=test");
    });
  });

  describe("apiPost", () => {
    it("should send POST request with JSON body", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { id: 1 },
              error: null,
              meta: {},
            }),
        } as Response)
      );
      global.fetch = mockFetch;

      const body = { name: "Test", email: "test@example.com" };

      // Act
      await apiPost("/api/v1/students", body);

      // Assert
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe("POST");
      expect(callArgs[1].headers["Content-Type"]).toBe("application/json");
      expect(callArgs[1].body).toBe(JSON.stringify(body));
    });

    it("should return typed data on success", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      type CreateResponse = { id: number; name: string };
      const responseData: CreateResponse = { id: 1, name: "Test" };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: responseData,
              error: null,
              meta: {},
            }),
        } as Response)
      );

      // Act
      const result = await apiPost<CreateResponse>("/api/v1/students", { name: "Test" });

      // Assert
      expect(result).toEqual(responseData);
    });

    it("should throw VALIDATION_ERROR on 422 response", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: () =>
            Promise.resolve({
              success: false,
              data: null,
              error: { code: "VALIDATION_ERROR", message: t.api.authActions.validEmail, details: { field: "email" } },
              meta: { httpStatus: 422 },
            }),
        } as Response)
      );

      // Act & Assert
      try {
        await apiPost("/api/v1/students", { email: "invalid" });
        expect(false).toBe(true); // Should not reach here
      } catch (error: any) {
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.message).toBe(t.api.authActions.validEmail);
      }
    });
  });

  describe("apiPut", () => {
    it("should send PUT request with JSON body", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { id: 1, updated: true },
              error: null,
              meta: {},
            }),
        } as Response)
      );
      global.fetch = mockFetch;

      const body = { name: "Updated" };

      // Act
      await apiPut("/api/v1/students/1", body);

      // Assert
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe("PUT");
      expect(callArgs[1].body).toBe(JSON.stringify(body));
    });
  });

  describe("apiPatch", () => {
    it("should send PATCH request with JSON body", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { id: 1, name: "Partially Updated" },
              error: null,
              meta: {},
            }),
        } as Response)
      );
      global.fetch = mockFetch;

      const body = { name: "Partially Updated" };

      // Act
      await apiPatch("/api/v1/students/1", body);

      // Assert
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe("PATCH");
      expect(callArgs[1].body).toBe(JSON.stringify(body));
    });
  });

  describe("apiDelete", () => {
    it("should send DELETE request", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: null,
              error: null,
              meta: {},
            }),
        } as Response)
      );
      global.fetch = mockFetch;

      // Act
      await apiDelete("/api/v1/students/1");

      // Assert
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe("DELETE");
    });

    it("should handle 204 No Content responses", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 204,
          json: () => Promise.reject(new Error("No content")),
        } as Response)
      );

      // Act
      const result = await apiDelete("/api/v1/students/1");

      // Assert
      expect(result).toBeNull();
    });

    it("should throw RESOURCE_NOT_FOUND on 404", async () => {
      // Arrange
      mockCookieStore.get.mockReturnValue({ value: "token" });
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              success: false,
              data: null,
              error: { code: "RESOURCE_NOT_FOUND", message: "Student not found" },
              meta: { httpStatus: 404 },
            }),
        } as Response)
      );

      // Act & Assert
      try {
        await apiDelete("/api/v1/students/999");
        expect(false).toBe(true);
      } catch (error: any) {
        expect(error.code).toBe("RESOURCE_NOT_FOUND");
      }
    });
  });

  describe("error handling", () => {
    it("should throw FORBIDDEN error on 403", async () => {
      mockCookieStore.get.mockReturnValue({ value: "token" });
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () =>
            Promise.resolve({
              success: false,
              data: null,
              error: { code: "FORBIDDEN", message: t.api.auth.authenticationRequired },
              meta: { httpStatus: 403 },
            }),
        } as Response)
      );

      try {
        await apiGet("/api/v1/admin/users");
        expect(false).toBe(true);
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });

    it("should throw CONFLICT error on 409", async () => {
      mockCookieStore.get.mockReturnValue({ value: "token" });
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          json: () =>
            Promise.resolve({
              success: false,
              data: null,
              error: { code: "CONFLICT", message: "Email already exists" },
              meta: { httpStatus: 409 },
            }),
        } as Response)
      );

      try {
        await apiPost("/api/v1/students", { email: "exists@example.com" });
        expect(false).toBe(true);
      } catch (error: any) {
        expect(error.code).toBe("CONFLICT");
      }
    });

    it("should throw INTERNAL_ERROR for unexpected errors", async () => {
      mockCookieStore.get.mockReturnValue({ value: "token" });
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              success: false,
              data: null,
              error: { code: "INTERNAL_ERROR", message: "Database connection failed" },
              meta: { httpStatus: 500 },
            }),
        } as Response)
      );

      try {
        await apiGet("/api/v1/students");
        expect(false).toBe(true);
      } catch (error: any) {
        expect(error.code).toBe("INTERNAL_ERROR");
      }
    });
  });
});
