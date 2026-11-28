import type { SortState } from '@/components/ui/DataTable'

// The paged form of the list endpoints (docs/API_REFERENCE.md, "การแบ่งหน้า").

/** One page of a list, and how many records match in total. */
export interface Page<T> {
  items: T[]
  total: number
  /** Starts at 1. */
  page: number
  pageSize: number
}

/** What a paged request adds to a list's own filters. */
export interface PageQuery {
  /** Starts at 1. */
  page: number
  pageSize: number
  /** A field name, with a leading "-" for descending. Absent = the list's default order. */
  sort?: string
}

/** The largest page the API serves; a larger request is cut down to this. */
export const MAX_PAGE_SIZE = 200

/** A table's sort state as the API's `sort` parameter. */
export function toSortParam(sort: SortState | null): string | undefined {
  return sort ? `${sort.direction === 'desc' ? '-' : ''}${sort.key}` : undefined
}

/**
 * Reads a whole list, page by page: for an export, or the copy of the catalogue kept for
 * offline use. Stops when the server says there is no more.
 */
export async function fetchAllPages<T>(
  fetchPage: (query: PageQuery) => Promise<Page<T>>,
  sort?: string,
): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const result = await fetchPage({ page, pageSize: MAX_PAGE_SIZE, sort })
    all.push(...result.items)
    if (result.items.length === 0 || all.length >= result.total) return all
  }
}

/**
 * The zero-based page to show: the one asked for, or the last one that exists when the list
 * has become shorter (a filter, a deletion).
 */
export function clampPage(page: number, pageSize: number, total: number | undefined): number {
  if (total === undefined) return page
  return Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1))
}
