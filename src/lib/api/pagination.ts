/**
 * Pagination parameter parser for API routes.
 *
 * Defaults: page=1, pageSize=20, max pageSize=100
 * Returns { page, pageSize, offset } for use in Supabase range queries.
 */

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(
  raw: string | null,
  fallback: number,
  max?: number,
): number {
  if (raw === null) return fallback;

  const parsed = parseInt(raw, 10);

  if (Number.isNaN(parsed) || parsed < 1) return fallback;

  if (max !== undefined && parsed > max) return max;

  return parsed;
}

export type PaginationParams = {
  page: number;
  pageSize: number;
  offset: number;
};

export function parsePaginationParams(
  searchParams: URLSearchParams,
): PaginationParams {
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE);
  const pageSize = parsePositiveInt(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number,
) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
