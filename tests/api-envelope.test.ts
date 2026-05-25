import { describe, expect, test } from "bun:test";

import {
  successResponse,
  errorResponse,
  paginatedResponse,
  toResponse,
} from "@/lib/api/envelope";
import { ErrorCodes } from "@/lib/api/errors";
import { t } from "@/lib/translations";

describe("API envelope helpers", () => {
  describe("successResponse", () => {
    test("returns success envelope with data and empty meta", () => {
      const result = successResponse({ id: 1, name: "test" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: "test" });
      expect(result.error).toBeNull();
      expect(result.meta).toEqual({});
    });

    test("returns success envelope with custom meta", () => {
      const result = successResponse("hello", { requestId: "abc" });

      expect(result.success).toBe(true);
      expect(result.data).toBe("hello");
      expect(result.meta).toEqual({ requestId: "abc" });
    });
  });

  describe("errorResponse", () => {
    test("returns error envelope with code and message", () => {
      const result = errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        t.api.authActions.validEmail,
      );

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.message).toBe(t.api.authActions.validEmail);
      expect(result.error.details).toBeUndefined();
    });

    test("includes details when provided", () => {
      const details = { field: "email", issue: "required" };
      const result = errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Validation failed",
        422,
        details,
      );

      expect(result.error.details).toEqual(details);
    });

    test("maps error code to default HTTP status in meta", () => {
      const result = errorResponse(ErrorCodes.UNAUTHORIZED, "No auth");

      expect(result.meta.httpStatus).toBe(401);
    });

    test("uses provided status override", () => {
      const result = errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Bad",
        400,
      );

      expect(result.meta.httpStatus).toBe(400);
    });
  });

  describe("paginatedResponse", () => {
    test("returns success envelope with pagination in meta", () => {
      const items = [{ id: 1 }, { id: 2 }];
      const pagination = {
        page: 1,
        pageSize: 20,
        total: 42,
        totalPages: 3,
      };

      const result = paginatedResponse(items, pagination);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(items);
      expect(result.meta.pagination).toEqual(pagination);
    });

    test("merges additional meta with pagination", () => {
      const result = paginatedResponse(
        [],
        { page: 1, pageSize: 10, total: 0, totalPages: 1 },
        { filter: "active" },
      );

      expect(result.meta.pagination).toBeDefined();
      expect(result.meta.filter).toBe("active");
    });
  });

  describe("toResponse", () => {
    test("converts error envelope to Response with correct status", async () => {
      const envelope = errorResponse(ErrorCodes.NOT_FOUND, t.api.authService.accountNotFound);
      // Use RESOURCE_NOT_FOUND which maps to 404
      const envelope404 = errorResponse(
        ErrorCodes.RESOURCE_NOT_FOUND,
        t.api.authService.accountNotFound,
      );
      const response = toResponse(envelope404);

      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).toBe("application/json");

      const body = (await response.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
      expect((body.error as Record<string, unknown>).code).toBe(
        "RESOURCE_NOT_FOUND",
      );
      // httpStatus should be stripped from meta in the response body
      expect((body.meta as Record<string, unknown>).httpStatus).toBeUndefined();
    });

    test("converts success envelope to Response with 200 by default", async () => {
      const envelope = successResponse({ ok: true });
      const response = toResponse(envelope);

      expect(response.status).toBe(200);

      const body = (await response.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });

    test("converts success envelope with custom status", () => {
      const envelope = successResponse({ id: 1 });
      const response = toResponse(envelope, 201);

      expect(response.status).toBe(201);
    });
  });
});
