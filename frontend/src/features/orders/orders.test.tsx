import { fireEvent, screen, within } from '@testing-library/react'
import { inventoryApi } from '@/features/inventory/api'
import type { Order } from '@/features/pos/types'
import i18n from '@/i18n'
import { api } from '@/lib/api'
import { formatCurrency, toIsoDate } from '@/lib/format'
import { renderApp, signIn } from '@/test/render-app'

// Against the in-memory mock API (src/mocks/mock-data.ts), which holds two weeks of past sales.
// What the page should show is read from the same API, not hard-coded.

const t = i18n.t.bind(i18n)

function day(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return toIsoDate(date)
}

/** The bills the page asks for when it opens: the last seven days, newest first. */
async function lastWeek(): Promise<Order[]> {
  signIn()
  return (await api.get<Order[]>('/orders', { params: { from: day(6), to: day(0) } })).data
}

const table = () => within(screen.getByRole('table'))
const rowOf = (order: Order) => within(table().getByText(order.orderNumber).closest('tr')!)

describe('sales history page', () => {
  it('lists the bills of the last seven days, newest first, with their total', async () => {
    const expected = await lastWeek()
    renderApp('/orders')
    await screen.findByText(expected[0].orderNumber)

    const numbers = table()
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1].textContent)
    expect(numbers).toEqual(expected.slice(0, 10).map((order) => order.orderNumber))
    expect(
      screen.getByText(t('pagination.range', { from: 1, to: 10, total: expected.length })),
    ).toBeInTheDocument()

    const total = expected.reduce((sum, order) => sum + order.netAmount, 0)
    expect(
      screen.getByText(
        t('orders.summary', {
          count: expected.length,
          bills: expected.length,
          total: formatCurrency(total),
        }),
      ),
    ).toBeInTheDocument()
  })

  it('opens a bill with its lines and amounts', async () => {
    const [order] = await lastWeek()
    renderApp('/orders')
    await screen.findByText(order.orderNumber)

    fireEvent.click(
      rowOf(order).getByRole('button', {
        name: t('orders.viewNamed', { number: order.orderNumber }),
      }),
    )

    const dialog = within(await screen.findByRole('dialog', { name: order.orderNumber }))
    for (const line of order.items) {
      expect(dialog.getByRole('rowheader', { name: line.itemName })).toBeInTheDocument()
    }
    expect(dialog.getByText(formatCurrency(order.netAmount))).toBeInTheDocument()
    expect(dialog.getByText(t('pos.walkIn'))).toBeInTheDocument()
  })

  it('cancels a bill after asking, returns its items to stock, and filters by status', async () => {
    const before = await lastWeek()
    const order = before[1]
    const line = order.items[0]
    const stockOf = async () =>
      (await inventoryApi.list({})).find((item) => item.id === line.inventoryItemId)!.quantity
    const stockBefore = await stockOf()

    renderApp('/orders')
    await screen.findByText(order.orderNumber)
    fireEvent.click(
      rowOf(order).getByRole('button', {
        name: t('orders.cancelNamed', { number: order.orderNumber }),
      }),
    )

    // Nothing happens until it is confirmed.
    const confirm = within(await screen.findByRole('dialog', { name: t('orders.cancelOrder') }))
    expect(
      confirm.getByText(
        t('orders.cancelConfirm', {
          number: order.orderNumber,
          total: formatCurrency(order.netAmount),
        }),
      ),
    ).toBeInTheDocument()
    expect(await stockOf()).toBe(stockBefore)
    fireEvent.click(confirm.getByRole('button', { name: t('orders.cancelOrder') }))

    expect(
      await screen.findByText(t('orders.cancelled', { number: order.orderNumber })),
    ).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(rowOf(order).getByText(t('orders.statuses.Cancelled'))).toBeInTheDocument(),
    )
    // A cancelled bill cannot be cancelled again, and no longer counts towards the total.
    expect(
      rowOf(order).queryByRole('button', {
        name: t('orders.cancelNamed', { number: order.orderNumber }),
      }),
    ).not.toBeInTheDocument()
    expect(await stockOf()).toBe(stockBefore + line.quantity)
    const remaining = before.filter((other) => other.id !== order.id)
    expect(
      screen.getByText(
        t('orders.summary', {
          count: remaining.length,
          bills: remaining.length,
          total: formatCurrency(remaining.reduce((sum, other) => sum + other.netAmount, 0)),
        }),
      ),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(t('orders.status')), { target: { value: 'Cancelled' } })

    await vi.waitFor(() => expect(table().getAllByRole('row')).toHaveLength(2))
    expect(table().getByText(order.orderNumber)).toBeInTheDocument()
  })

  it('does not ask the server for a range that ends before it starts', async () => {
    const [order] = await lastWeek()
    renderApp('/orders')
    await screen.findByText(order.orderNumber)
    const get = vi.spyOn(api, 'get')

    fireEvent.change(screen.getByLabelText(t('orders.to')), { target: { value: day(30) } })

    expect(await screen.findByText(t('orders.rangeInvalid'))).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
    // The last good list stays on screen.
    expect(screen.getByText(order.orderNumber)).toBeInTheDocument()
    get.mockRestore()
  })

  it('lets a viewer read the bills but not cancel them', async () => {
    const [order] = await lastWeek()
    renderApp('/orders', 'Viewer')
    await screen.findByText(order.orderNumber)

    expect(
      screen.getByRole('button', { name: t('orders.viewNamed', { number: order.orderNumber }) }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^ยกเลิกบิล/ })).not.toBeInTheDocument()
  })

  it('is closed to a cashier', async () => {
    renderApp('/orders', 'Cashier')
    await screen.findByRole('heading', { name: t('forbidden.title') })
  })
})
