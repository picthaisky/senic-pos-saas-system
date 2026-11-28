import { fireEvent, screen, within } from '@testing-library/react'
import { customersApi } from '@/features/customers/api'
import { inventoryApi } from '@/features/inventory/api'
import i18n from '@/i18n'
import { api } from '@/lib/api'
import { downloadCsv } from '@/lib/export-csv'
import { renderApp, signIn } from '@/test/render-app'

// The item and customer lists are searched, sorted and paged by the server. These tests run
// against the in-memory mock API, which pages the same way; what the screen should show is
// read from that API rather than hard-coded.

vi.mock('@/lib/export-csv', async (original) => ({
  ...(await original<typeof import('@/lib/export-csv')>()),
  downloadCsv: vi.fn(),
}))

const t = i18n.t.bind(i18n)

/** The first column of every body row of the (only) table on screen. */
const firstColumn = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

const range = (from: number, to: number, total: number) =>
  t('pagination.range', { from, to, total })

afterEach(() => vi.mocked(downloadCsv).mockClear())

describe('inventory list', () => {
  /** Enough items for three pages of ten, on top of the seed data. */
  async function seed() {
    signIn()
    const existing = await inventoryApi.list()
    for (let n = existing.length; n < 23; n++) {
      await inventoryApi.create({
        sku: `PAGE-${n}`,
        name: `สินค้าหน้า ${String(n).padStart(2, '0')}`,
        barcode: null,
        category: null,
        price: 1000 + n,
        cost: 1,
        quantity: 500 + n,
        minimumStock: 0,
      })
    }
    return inventoryApi.list()
  }

  it('loads one page at a time and moves between pages', async () => {
    const all = await seed()
    const get = vi.spyOn(api, 'get')
    renderApp('/inventory')

    expect(await screen.findByText(range(1, 10, all.length))).toBeInTheDocument()
    expect(firstColumn()).toEqual(all.slice(0, 10).map((item) => item.name))
    // Only the page on screen was asked for, never the whole list.
    const listCalls = () => get.mock.calls.filter(([url]) => url === '/inventory')
    expect(listCalls().map(([, config]) => config?.params)).toEqual([
      expect.objectContaining({ page: 1, pageSize: 10 }),
    ])

    fireEvent.click(screen.getByRole('button', { name: t('pagination.next') }))

    expect(await screen.findByText(range(11, 20, all.length))).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(firstColumn()).toEqual(all.slice(10, 20).map((item) => item.name)),
    )
    get.mockRestore()
  })

  it('sorts on the server, across pages, and returns to the first page', async () => {
    const all = await seed()
    const byPrice = [...all].sort((a, b) => b.price - a.price)
    renderApp('/inventory')
    await screen.findByText(range(1, 10, all.length))
    fireEvent.click(screen.getByRole('button', { name: t('pagination.next') }))
    await screen.findByText(range(11, 20, all.length))

    const price = screen.getByRole('button', { name: new RegExp(t('inventory.price')) })
    fireEvent.click(price) // ascending
    fireEvent.click(price) // descending

    await vi.waitFor(() =>
      expect(firstColumn()).toEqual(byPrice.slice(0, 10).map((item) => item.name)),
    )
    expect(screen.getByText(range(1, 10, all.length))).toBeInTheDocument()
  })

  it('falls back to the last page when a search leaves fewer rows', async () => {
    const all = await seed()
    renderApp('/inventory')
    await screen.findByText(range(1, 10, all.length))
    fireEvent.click(screen.getByRole('button', { name: t('pagination.next') }))
    fireEvent.click(screen.getByRole('button', { name: t('pagination.next') }))
    await screen.findByText(range(21, all.length, all.length))

    fireEvent.change(screen.getByLabelText(t('common.search')), { target: { value: 'น้ำดื่ม' } })

    expect(await screen.findByText('น้ำดื่ม 600 มล.')).toBeInTheDocument()
    await vi.waitFor(() => expect(firstColumn().every((name) => name?.includes('น้ำดื่ม'))).toBe(true))
  })

  it('exports every matching row, not just the page on screen', async () => {
    const all = await seed()
    renderApp('/inventory')
    await screen.findByText(range(1, 10, all.length))

    fireEvent.click(screen.getByRole('button', { name: t('common.exportCsv') }))

    await vi.waitFor(() => expect(downloadCsv).toHaveBeenCalledOnce())
    expect(vi.mocked(downloadCsv).mock.calls[0][1]).toHaveLength(all.length)
  })
})

describe('customer list', () => {
  it('searches on the server by name, email or phone', async () => {
    renderApp('/customers')
    await screen.findByText('สมชาย ใจดี')

    fireEvent.change(screen.getByLabelText(t('common.search')), { target: { value: '08987' } })

    await vi.waitFor(() => expect(firstColumn()).toHaveLength(1))
    expect(firstColumn()[0]).toContain('สมหญิง')

    fireEvent.change(screen.getByLabelText(t('common.search')), { target: { value: 'ไม่มีคนนี้' } })
    expect(await screen.findByText(t('customers.noMatch'))).toBeInTheDocument()
  })

  it('sorts by points on the server', async () => {
    signIn()
    const byPoints = [...(await customersApi.list())].sort(
      (a, b) => b.loyaltyPoints - a.loyaltyPoints,
    )
    renderApp('/customers')
    await screen.findByText('สมชาย ใจดี')

    const points = screen.getByRole('button', { name: new RegExp(t('customers.points')) })
    fireEvent.click(points)
    fireEvent.click(points)

    await vi.waitFor(() =>
      expect(firstColumn()).toEqual(byPoints.slice(0, 10).map((customer) => customer.fullName)),
    )
  })

  it('keeps the open customer in the panel while the list shows other rows', async () => {
    renderApp('/customers')
    fireEvent.click(
      await screen.findByRole('button', {
        name: t('customers.viewNamed', { name: 'สมชาย ใจดี' }),
      }),
    )
    await screen.findByRole('region', { name: t('customers.history') })

    fireEvent.change(screen.getByLabelText(t('common.search')), { target: { value: 'สมหญิง' } })

    await vi.waitFor(() => expect(firstColumn()).toHaveLength(1))
    expect(screen.getByRole('heading', { name: 'สมชาย ใจดี' })).toBeInTheDocument()
  })
})
