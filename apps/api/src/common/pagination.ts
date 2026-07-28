export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Clamps user-supplied paging params into safe skip/take values. */
export function normalizePage(
  page?: number,
  pageSize?: number,
  maxPageSize = 100,
): { skip: number; take: number; page: number; pageSize: number } {
  const p = Math.max(1, Math.floor(Number(page) || 1));
  const ps = Math.min(Math.max(1, Math.floor(Number(pageSize) || 25)), maxPageSize);
  return { skip: (p - 1) * ps, take: ps, page: p, pageSize: ps };
}
