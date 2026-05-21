/** Default page size for list endpoints (override with query `pageSize`). */
export const DEFAULT_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 100;

/**
 * @param {Record<string, unknown>} query - req.query
 * @param {{ defaultPageSize?: number }} [opts]
 */
export function parsePageQuery(query, opts = {}) {
  const defaultPageSize = opts.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const raw = Number(query.pageSize);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : defaultPageSize),
  );
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip, take: pageSize };
}

/**
 * @param {{ items: unknown[]; total: number; page: number; pageSize: number }} p
 */
export function paginatedResult({ items, total, page, pageSize }) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPrevPage: page > 1,
  };
}
