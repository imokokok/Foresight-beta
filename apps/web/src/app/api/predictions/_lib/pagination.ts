export type PaginationArgs = {
  limit?: string | null;
  page?: string | null;
  pageSize?: string | null;
  cursor?: string | null; // 游标分页：上一页最后一条的 created_at
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type CursorPaginationMeta = {
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
};

export function parsePagination(args: PaginationArgs): {
  mode: "paged" | "cursor" | "limit" | "none";
  currentPage: number;
  pageSize: number;
  range?: { from: number; to: number };
  limit?: number;
  cursor?: string;
} {
  const page = args.page ?? undefined;
  const pageSize = args.pageSize ?? undefined;
  const limit = args.limit ?? undefined;
  const cursor = args.cursor ?? undefined;

  // 游标分页优先
  if (cursor || (limit && !page)) {
    const limitNum = Math.max(1, Math.min(50, parseInt(limit || "20") || 20));
    return { 
      mode: "cursor", 
      currentPage: 1, 
      pageSize: limitNum, 
      limit: limitNum,
      cursor: cursor || undefined 
    };
  }

  if (page && pageSize) {
    const currentPage = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize) || 12));
    const from = (currentPage - 1) * pageSizeNum;
    const to = from + pageSizeNum - 1;
    return { mode: "paged", currentPage, pageSize: pageSizeNum, range: { from, to } };
  }

  if (limit) {
    const limitNum = parseInt(limit);
    if (Number.isFinite(limitNum) && limitNum > 0)
      return { mode: "limit", currentPage: 1, pageSize: limitNum, limit: limitNum };
  }

  return { mode: "none", currentPage: 1, pageSize: 12 };
}

export function buildPaginationMeta(
  total: number,
  currentPage: number,
  pageSize: number
): PaginationMeta {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
  return {
    page: currentPage,
    pageSize,
    total,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

export function buildCursorPaginationMeta(
  items: Array<{ created_at?: string }>,
  pageSize: number,
  total: number
): CursorPaginationMeta {
  const hasMore = items.length >= pageSize;
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem?.created_at ? lastItem.created_at : null;
  
  return {
    nextCursor,
    hasMore,
    pageSize,
  };
}
