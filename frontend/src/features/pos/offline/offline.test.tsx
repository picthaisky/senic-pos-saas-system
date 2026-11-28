import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { inventoryApi } from '@/features/inventory/api'
import { DEFAULT_SHOP_SETTINGS } from '@/features/shop/api'
import i18n from '@/i18n'
import { downloadCsv, toCsv } from '@/lib/export-csv'
import { formatDateTime } from '@/lib/format'
import { mockShopSettings } from '@/mocks/mock-data'
import { useAuthStore } from '@/stores/auth'
import { renderApp, signIn } from '@/test/render-app'
import { useCartStore } from '../cart-store'
import { offlineDb, type QueuedOrder } from './db'
import { discardOrder, loadQueue, retryOrder, syncQueue, useOrderQueue } from './queue'
import { useStorageProtection } from './storage'

// The export is checked by what would be written to the file; jsdom cannot save one.
vi.mock('@/lib/export-csv', async (original) => ({
  ...(await original<typeof import('@/lib/export-csv')>()),
  downloadCsv: vi.fn(),
}))

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
  // Unmount first: a screen that is still up would start sending the queue once the network
  // is back, and write to it while it is being emptied below.
  cleanup()
  setOnline(true)
  await vi.waitFor(() => expect(useOrderQueue.getState().syncing).toBe(false))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  mockShopSettings.current = { ...DEFAULT_SHOP_SETTINGS }
  vi.mocked(downloadCsv).mockClear()
  useStorageProtection.setState({ protection: 'unknown' })
  for (const order of await offlineDb.listOrders(TENANT)) {
    await offlineDb.deleteOrder(order.clientOrderId)
  }
  await loadQueue()
})

describe('selling while offline', () => {
  it('uses the local catalog, queues the sale, and sends it exactly once when back online', async () => {
    // The till read the shop's VAT settings while it was online, and prices with them offline.
    mockShopSettings.current = { ...DEFAULT_SHOP_SETTINGS, vatMode: 'Exclusive' }
    renderApp('/pos', 'Cashier')
    await screen.findByLabelText(t('pos.searchProducts'))
    // Opening the POS downloads the catalog for offline use.
    await vi.waitFor(async () => expect(await offlineDb.getCatalog(TENANT)).toBeDefined())

    setOnline(false)
    expect(await screen.findByText(t('offline.badge'))).toBeInTheDocument()

    await searchFor('กาแฟ')
    expect(await screen.findByText(t('offline.localResults'))).toBeInTheDocument()
    // ... and says how old that copy is.
    const { syncedAt } = (await offlineDb.getCatalog(TENANT))!
    expect(
      screen.getByText(t('offline.catalogSyncedAt', { time: formatDateTime(syncedAt) })),
    ).toBeInTheDocument()
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
    // No screen is rendered here: the app's own background sync would race with these calls.
    signIn('Cashier')
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
    expect(failed.error).toContain('มีไม่พอ')

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

describe('not losing queued sales', () => {
  const HOUR = 3_600_000

  /** Puts sales in the queue of the test tenant; the screen is rendered offline afterwards. */
  async function seedQueue(...ages: number[]) {
    setOnline(false)
    for (const age of ages) {
      const clientOrderId = crypto.randomUUID()
      await offlineDb.putOrder({
        clientOrderId,
        tenantId: TENANT,
        request: {
          customerId: null,
          paymentMethod: 'Cash',
          discountAmount: 0,
          notes: null,
          clientOrderId,
          items: [{ inventoryItemId: 'i1', quantity: 2, discount: 0 }],
        },
        summary: { lines: [{ name: 'กาแฟกระป๋อง', quantity: 2, unitPrice: 18 }], total: 38.52 },
        createdAt: new Date(Date.now() - age).toISOString(),
        status: 'pending',
      })
    }
  }

  function stubStorage(persistent: boolean) {
    const persist = vi.fn().mockResolvedValue(persistent)
    const persisted = vi.fn().mockResolvedValue(false)
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persist, persisted },
    })
    return persist
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'storage')
  })

  async function openQueue(count: number) {
    fireEvent.click(
      await screen.findByRole('button', { name: t('offline.queueButton', { count }) }),
    )
    return within(await screen.findByRole('dialog', { name: t('offline.queueTitle') }))
  }

  it('asks the browser to keep the data, and warns when it will not promise to', async () => {
    const persist = stubStorage(false)
    await seedQueue(HOUR)
    renderApp('/pos', 'Cashier')

    const queue = await openQueue(1)

    expect(await queue.findByText(t('offline.notProtected'))).toBeInTheDocument()
    expect(persist).toHaveBeenCalled()
    // One hour old: not overdue.
    expect(queue.queryByText(t('offline.staleWarning', { hours: 24 }))).not.toBeInTheDocument()
  })

  it('shows no storage warning once the browser has agreed', async () => {
    stubStorage(true)
    await seedQueue(HOUR)
    renderApp('/pos', 'Cashier')

    const queue = await openQueue(1)

    await vi.waitFor(() => expect(useStorageProtection.getState().protection).toBe('persistent'))
    expect(queue.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calls out sales that have waited more than a day', async () => {
    await seedQueue(30 * HOUR, HOUR)
    renderApp('/pos', 'Cashier')

    expect(await screen.findByText(t('offline.staleToast', { count: 1 }))).toBeInTheDocument()
    const queue = await openQueue(2)
    expect(queue.getByText(t('offline.staleWarning', { hours: 24 }))).toBeInTheDocument()
  })

  it('exports the queue as a spreadsheet file, one row per line sold', async () => {
    await seedQueue(HOUR)
    renderApp('/pos', 'Cashier')

    const queue = await openQueue(1)
    fireEvent.click(queue.getByRole('button', { name: t('offline.exportFile') }))

    expect(downloadCsv).toHaveBeenCalledOnce()
    const [filename, rows, columns] = vi.mocked(downloadCsv).mock.calls[0]
    expect(filename).toMatch(/^offline-sales-\d{4}-\d{2}-\d{2}\.csv$/)
    const [header, line] = toCsv(rows, columns).trim().split('\r\n')
    expect(header).toContain(t('offline.export.item'))
    expect(line).toContain('กาแฟกระป๋อง,2,18,38.52,' + t('payment.Cash'))
    expect(line).toContain(t('offline.pending'))
  })

  it('warns before signing out while sales are waiting, and keeps them either way', async () => {
    await seedQueue(HOUR, HOUR)
    renderApp('/pos', 'Cashier')
    await screen.findByRole('button', { name: t('offline.queueButton', { count: 2 }) })
    // The first of that name is the one in the top bar; the warning has its own.
    const signOut = () =>
      fireEvent.click(screen.getAllByRole('button', { name: t('topbar.logout') })[0])

    signOut()
    const warning = within(await screen.findByRole('dialog', { name: t('offline.logoutTitle') }))
    expect(warning.getByText(t('offline.logoutWarning', { count: 2 }))).toBeInTheDocument()

    // Cancel: still signed in.
    fireEvent.click(warning.getByRole('button', { name: t('common.cancel') }))
    expect(useAuthStore.getState().status).toBe('authenticated')

    // The file can be taken from here too, then sign out for real.
    signOut()
    fireEvent.click(warning.getByRole('button', { name: t('offline.exportFile') }))
    expect(downloadCsv).toHaveBeenCalledOnce()
    fireEvent.click(warning.getByRole('button', { name: t('topbar.logout') }))

    await vi.waitFor(() => expect(useAuthStore.getState().status).toBe('anonymous'))
    expect(await offlineDb.listOrders(TENANT)).toHaveLength(2)
  })

  it('signs out without asking when nothing is waiting', async () => {
    renderApp('/pos', 'Cashier')
    await screen.findByLabelText(t('pos.searchProducts'))

    fireEvent.click(screen.getByRole('button', { name: t('topbar.logout') }))

    await vi.waitFor(() => expect(useAuthStore.getState().status).toBe('anonymous'))
    expect(screen.queryByRole('dialog', { name: t('offline.logoutTitle') })).not.toBeInTheDocument()
  })
})
