import { fireEvent, screen, within } from '@testing-library/react'
import { inventoryApi } from '@/features/inventory/api'
import i18n from '@/i18n'
import { renderApp } from '@/test/render-app'
import { useCartStore } from '../cart-store'
import { offlineDb, type QueuedOrder } from './db'
import { discardOrder, loadQueue, retryOrder, syncQueue, useOrderQueue } from './queue'

// Runs against the in-memory mock API, which refuses requests while navigator.onLine is false,
// like a real server would be unreachable. Seed data: "กาแฟกระป๋อง" costs ฿18, 48 in stock.

const t = i18n.t.bind(i18n)
const TENANT = 't1' // the tenant renderApp signs in with

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
}

async function searchFor(text: string) {
  const input = screen.getByLabelText(t('pos.searchProducts'))
  fireEvent.change(input, { target: { value: text } })
  fireEvent.submit(input.closest('form')!)
}

beforeEach(() => useCartStore.getState().clear())

afterEach(async () => {
  setOnline(true)
  vi.restoreAllMocks()
  for (const order of await offlineDb.listOrders(TENANT)) {
    await offlineDb.deleteOrder(order.clientOrderId)
  }
  await loadQueue()
})

describe('selling while offline', () => {
  it('uses the local catalog, queues the sale, and sends it exactly once when back online', async () => {
    renderApp('/pos', 'Cashier')
    await screen.findByLabelText(t('pos.searchProducts'))
    // Opening the POS downloads the catalog for offline use.
    await vi.waitFor(async () => expect(await offlineDb.getCatalog(TENANT)).toBeDefined())

    setOnline(false)
    expect(await screen.findByText(t('offline.badge'))).toBeInTheDocument()

    await searchFor('กาแฟ')
    expect(await screen.findByText(t('offline.localResults'))).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /กาแฟกระป๋อง/ }))

    const cart = within(screen.getByRole('region', { name: t('pos.cart') }))
    fireEvent.click(cart.getByRole('button', { name: t('pos.checkout') }))

    const saved = within(await screen.findByRole('dialog', { name: t('offline.savedTitle') }))
    expect(saved.getByText('฿19.26')).toBeInTheDocument() // ฿18 + 7%
    fireEvent.click(saved.getByRole('button', { name: t('pos.newSale') }))
    expect(useCartStore.getState().lines).toHaveLength(0)

    // The sale is on the device, visible in the top bar, and nothing reached the server.
    expect(await screen.findByRole('button', { name: t('offline.queueButton', { count: 1 }) }))
    expect(await offlineDb.listOrders(TENANT)).toHaveLength(1)
    // The local stock already reflects the sale, so the till does not oversell.
    const local = (await offlineDb.getCatalog(TENANT))!.items.find((i) => i.name === 'กาแฟกระป๋อง')
    expect(local!.quantity).toBe(47)

    setOnline(true)

    expect(await screen.findByText(t('offline.synced', { count: 1 }))).toBeInTheDocument()
    await vi.waitFor(async () => expect(await offlineDb.listOrders(TENANT)).toHaveLength(0))
    expect(screen.queryByRole('button', { name: /รายการขายที่รอส่ง/ })).not.toBeInTheDocument()

    // The server recorded one sale, not two: 48 - 1.
    const [coffee] = await inventoryApi.list({ search: 'กาแฟกระป๋อง' })
    expect(coffee.quantity).toBe(47)
  })

  it('says so when the product was never downloaded to this device', async () => {
    renderApp('/pos', 'Cashier')
    await screen.findByLabelText(t('pos.searchProducts'))
    setOnline(false)

    await searchFor('ไม่มีสินค้านี้')

    expect(await screen.findByText(t('offline.localResults'))).toBeInTheDocument()
    expect(screen.getByText(t('pos.noResults', { query: 'ไม่มีสินค้านี้' }))).toBeInTheDocument()
  })
})

describe('order queue', () => {
  async function queueOrder(quantity: number): Promise<QueuedOrder> {
    renderApp('/pos', 'Cashier') // signs in and installs the mock API
    const [item] = await inventoryApi.list({ search: 'ยาสีฟัน' }) // 18 in stock
    const clientOrderId = crypto.randomUUID()
    const queued: QueuedOrder = {
      clientOrderId,
      tenantId: TENANT,
      request: {
        customerId: null,
        paymentMethod: 'Cash',
        discountAmount: 0,
        notes: null,
        clientOrderId,
        items: [{ inventoryItemId: item.id, quantity, discount: 0 }],
      },
      summary: { lines: [{ name: item.name, quantity, unitPrice: item.price }], total: 0 },
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    await offlineDb.putOrder(queued)
    await loadQueue()
    return queued
  }

  it('keeps orders pending while the server is unreachable', async () => {
    await queueOrder(1)
    setOnline(false)

    expect(await syncQueue()).toEqual({ sent: 0, failed: 0 })

    expect(useOrderQueue.getState().orders.map((o) => o.status)).toEqual(['pending'])
  })

  it('marks an order the server refuses as failed, without retrying it automatically', async () => {
    const queued = await queueOrder(999) // far more than is in stock

    expect(await syncQueue()).toEqual({ sent: 0, failed: 1 })

    const [failed] = useOrderQueue.getState().orders
    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('Insufficient stock')

    // A later automatic sync leaves it alone ...
    expect(await syncQueue()).toEqual({ sent: 0, failed: 0 })
    // ... a manual retry asks the server again ...
    expect(await retryOrder(failed)).toEqual({ sent: 0, failed: 1 })
    // ... and discarding removes it for good.
    await discardOrder(queued.clientOrderId)
    expect(await offlineDb.listOrders(TENANT)).toHaveLength(0)
  })

  it("does not send another tenant's queued orders", async () => {
    const queued = await queueOrder(1)
    await offlineDb.putOrder({ ...queued, tenantId: 'another-tenant' })
    await loadQueue()

    expect(useOrderQueue.getState().orders).toHaveLength(0)
    expect(await syncQueue()).toEqual({ sent: 0, failed: 0 })
    expect(await offlineDb.listOrders('another-tenant')).toHaveLength(1)

    await offlineDb.deleteOrder(queued.clientOrderId)
  })
})
