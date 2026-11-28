import { clampPage, fetchAllPages, MAX_PAGE_SIZE, type PageQuery, toSortParam } from './paging'

describe('fetchAllPages', () => {
  /** A server holding `total` numbered rows that serves at most `limit` per page. */
  function server(total: number, limit = MAX_PAGE_SIZE) {
    const rows = Array.from({ length: total }, (_, index) => index)
    return vi.fn(({ page, pageSize, sort }: PageQuery) => {
      const size = Math.min(pageSize, limit)
      const ordered = sort === '-n' ? [...rows].reverse() : rows
      return Promise.resolve({
        items: ordered.slice((page - 1) * size, page * size),
        total,
        page,
        pageSize: size,
      })
    })
  }

  it('reads page after page until it has every row, in order', async () => {
    const fetchPage = server(450)

    const all = await fetchAllPages(fetchPage)

    expect(all).toHaveLength(450)
    expect(all[0]).toBe(0)
    expect(all[449]).toBe(449)
    expect(fetchPage.mock.calls.map(([query]) => query.page)).toEqual([1, 2, 3])
  })

  it('asks once for a list that fits in one page, and once for an empty one', async () => {
    const small = server(3)
    expect(await fetchAllPages(small)).toEqual([0, 1, 2])
    expect(small).toHaveBeenCalledOnce()

    const empty = server(0)
    expect(await fetchAllPages(empty)).toEqual([])
    expect(empty).toHaveBeenCalledOnce()
  })

  it('passes the sort order to every page', async () => {
    const fetchPage = server(250)

    const all = await fetchAllPages(fetchPage, '-n')

    expect(all[0]).toBe(249)
    expect(fetchPage.mock.calls.every(([query]) => query.sort === '-n')).toBe(true)
  })

  it('stops when the server runs out of rows before the total it announced', async () => {
    // Rows were deleted while the export was running.
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [1, 2], total: 500, page: 1, pageSize: 200 })
      .mockResolvedValueOnce({ items: [], total: 2, page: 2, pageSize: 200 })

    expect(await fetchAllPages(fetchPage)).toEqual([1, 2])
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })
})

describe('clampPage', () => {
  it('keeps the page while it exists and falls back to the last one when it does not', () => {
    expect(clampPage(2, 10, 35)).toBe(2)
    expect(clampPage(5, 10, 35)).toBe(3)
    expect(clampPage(3, 10, 30)).toBe(2)
    expect(clampPage(4, 10, 0)).toBe(0)
  })

  it('trusts the page until the size of the list is known', () => {
    expect(clampPage(4, 10, undefined)).toBe(4)
  })
})

describe('toSortParam', () => {
  it('writes the sort the way the API reads it', () => {
    expect(toSortParam(null)).toBeUndefined()
    expect(toSortParam({ key: 'price', direction: 'asc' })).toBe('price')
    expect(toSortParam({ key: 'price', direction: 'desc' })).toBe('-price')
  })
})
