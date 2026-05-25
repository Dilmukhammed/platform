import { describe, expect, test } from "bun:test";

import {
  parsePaginationParams,
  buildPaginationMeta,
} from "@/lib/api/pagination";

describe("API pagination parser", () => {
  describe("parsePaginationParams", () => {
    test("returns defaults when no params provided", () => {
      const result = parsePaginationParams(new URLSearchParams());

      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        offset: 0,
      });
    });

    test("parses valid page and pageSize", () => {
      const params = new URLSearchParams("page=3&pageSize=50");
      const result = parsePaginationParams(params);

      expect(result).toEqual({
        page: 3,
        pageSize: 50,
        offset: 100,
      });
    });

    test("clamps pageSize to max of 100", () => {
      const params = new URLSearchParams("pageSize=200");
      const result = parsePaginationParams(params);

      expect(result.pageSize).toBe(100);
    });

    test("clamps page to minimum of 1", () => {
      const params = new URLSearchParams("page=0");
      const result = parsePaginationParams(params);

      expect(result.page).toBe(1);
    });

    test("falls back to defaults for non-numeric values", () => {
      const params = new URLSearchParams("page=abc&pageSize=xyz");
      const result = parsePaginationParams(params);

      expect(result).toEqual({
        page: 1,
        pageSize: 20,
        offset: 0,
      });
    });

    test("computes offset correctly", () => {
      const params = new URLSearchParams("page=5&pageSize=25");
      const result = parsePaginationParams(params);

      expect(result.offset).toBe(100); // (5-1) * 25
    });

    test("handles only page param", () => {
      const params = new URLSearchParams("page=2");
      const result = parsePaginationParams(params);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(20);
      expect(result.offset).toBe(20);
    });

    test("handles only pageSize param", () => {
      const params = new URLSearchParams("pageSize=10");
      const result = parsePaginationParams(params);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.offset).toBe(0);
    });
  });

  describe("buildPaginationMeta", () => {
    test("computes totalPages correctly", () => {
      const meta = buildPaginationMeta(1, 20, 42);

      expect(meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 42,
        totalPages: 3,
      });
    });

    test("returns at least 1 total page for zero results", () => {
      const meta = buildPaginationMeta(1, 20, 0);

      expect(meta.totalPages).toBe(1);
    });

    test("handles exact page boundary", () => {
      const meta = buildPaginationMeta(1, 20, 40);

      expect(meta.totalPages).toBe(2);
    });
  });
});
