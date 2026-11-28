import type { Customer, LoyaltyTransaction } from '@/features/customers/types'
import type { AuditEntry } from '@/features/audit/api'
import type { CreateUser, ManagedUser, UpdateUser } from '@/features/users/types'
import type { DashboardSummary } from '@/features/dashboard/api'
import type {
  CreateInventoryItem,
  InventoryItem,
  ItemImportResult,
} from '@/features/inventory/types'
import type { CreateOrder, Order } from '@/features/pos/types'
import type { SalesReport } from '@/features/reports/api'
import { useAuthStore } from '@/stores/auth'
import { DEFAULT_SHOP_SETTINGS, type ShopSettings } from '@/features/shop/api'
import { billTotals, lineSubtotal, pointsDiscountOf, pointsFor } from '@/features/shop/pricing'
import type { Subscription } from '@/features/subscription/api'
import type { MockResult, MockRoute } from './mock-api'

// In-memory stand-in for the contract endpoints the backend does not serve yet
// (docs/API_REFERENCE.md §3–6). Data resets on every page reload. It does not check roles.

const DAY_MS = 24 * 60 * 60 * 1000
const round2 = (value: number) => Math.round(value * 100) / 100
const uuid = () => crypto.randomUUID()
const notFound = { status: 404, data: { title: 'Not Found', status: 404 } }

/** Small seeded generator so the demo history is the same on every reload. */
function seededRandom(seed: number) {
  let state = seed
  return (max: number) => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state % max
  }
}

// ---------- Seed data ----------

const seedItems: [name: string, category: string, price: number, cost: number, qty: number][] = [
  ['น้ำดื่ม 600 มล.', 'เครื่องดื่ม', 10, 6, 120],
  ['กาแฟกระป๋อง', 'เครื่องดื่ม', 18, 12, 48],
  ['ชาเขียวขวด', 'เครื่องดื่ม', 25, 17, 36],
  ['นมสด 200 มล.', 'เครื่องดื่ม', 15, 11, 4],
  ['ขนมปังแผ่น', 'อาหาร', 42, 30, 12],
  ['บะหมี่กึ่งสำเร็จรูป', 'อาหาร', 8, 5.5, 200],
  ['ข้าวสาร 1 กก.', 'อาหาร', 55, 42, 3],
  ['มันฝรั่งทอด', 'ขนม', 30, 21, 60],
  ['ช็อกโกแลตแท่ง', 'ขนม', 35, 24, 0],
  ['สบู่ก้อน', 'ของใช้', 22, 14, 40],
  ['ยาสีฟัน', 'ของใช้', 65, 45, 18],
  ['ถ่าน AA แพ็ก 4', 'ของใช้', 89, 60, 9],
]

const items: InventoryItem[] = seedItems.map(([name, category, price, cost, quantity], index) => ({
  id: uuid(),
  sku: `SKU-${String(index + 1).padStart(3, '0')}`,
  name,
  description: null,
  barcode: `88500000${String(index + 1).padStart(5, '0')}`,
  price,
  cost,
  quantity,
  minimumStock: 10,
  category,
  imageUrl: null,
  isActive: true,
  createdAt: new Date(Date.now() - 30 * DAY_MS).toISOString(),
}))

function makeCustomer(
  firstName: string,
  lastName: string,
  email: string | null,
  phone: string | null,
  loyaltyPoints = 0,
): Customer {
  return {
    id: uuid(),
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email,
    phone,
    address: null,
    dateOfBirth: null,
    loyaltyPoints,
    isActive: true,
    createdAt: new Date().toISOString(),
  }
}

const customers: Customer[] = [
  makeCustomer('สมชาย', 'ใจดี', 'somchai@example.com', '0812345678', 120),
  makeCustomer('สมหญิง', 'รักเรียน', null, '0898765432', 45),
  makeCustomer('วิชัย', 'มั่งมี', 'wichai@example.com', null, 0),
]

const loyalty: LoyaltyTransaction[] = [
  {
    id: uuid(),
    customerId: customers[0].id,
    type: 'Earned',
    points: 120,
    orderId: null,
    description: 'แต้มสะสมเริ่มต้น',
    createdAt: new Date(Date.now() - 5 * DAY_MS).toISOString(),
  },
  {
    id: uuid(),
    customerId: customers[1].id,
    type: 'Earned',
    points: 45,
    orderId: null,
    description: 'แต้มสะสมเริ่มต้น',
    createdAt: new Date(Date.now() - 3 * DAY_MS).toISOString(),
  },
]

/** Tests replace `current` (null = the shop has none on record). */
export const mockSubscription: { current: Subscription | null } = {
  current: {
    id: uuid(),
    tenantId: 't1',
    tenantName: 'ร้านตัวอย่าง',
    plan: 'Pro',
    status: 'Active',
    startDate: new Date(Date.now() - 20 * DAY_MS).toISOString(),
    endDate: new Date(Date.now() + 10 * DAY_MS + DAY_MS / 2).toISOString(),
    monthlyFee: 590,
    autoRenew: false,
    daysUntilExpiry: 10,
  },
}

/**
 * Like the API: with `page` in the query the answer is one page, sorted as asked; without
 * it, the whole list as an array (the form kept for older clients).
 */
function listResult<T>(
  rows: T[],
  query: Record<string, unknown>,
  sortFields: Record<string, (row: T) => string | number>,
  extra: object = {},
): MockResult {
  if (query.page === undefined) return { status: 200, data: rows }

  const asked = typeof query.sort === 'string' ? query.sort : ''
  const descending = asked.startsWith('-')
  const field = descending ? asked.slice(1) : asked
  if (field && !(field in sortFields)) {
    return {
      status: 400,
      data: { title: 'Bad Request', status: 400, detail: 'Unknown sort field.' },
    }
  }
  const sorted = [...rows]
  if (field) {
    const key = sortFields[field]
    sorted.sort((a, b) => {
      const [x, y] = [key(a), key(b)]
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), 'th')
      return descending ? -order : order
    })
  }
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 20))
  return {
    status: 200,
    data: {
      items: sorted.slice((page - 1) * pageSize, page * pageSize),
      total: sorted.length,
      page,
      pageSize,
      ...extra,
    },
  }
}

/** Tests replace `current`. Starts like a shop that has saved nothing: no VAT, no points. */
export const mockShopSettings: { current: ShopSettings } = { current: { ...DEFAULT_SHOP_SETTINGS } }

const orders: Order[] = []
const ordersByClientId = new Map<string, Order>()
let orderSequence = 1

/** Priced like the backend: by the shop's VAT mode, discounts before tax, points for a known customer. */
function buildOrder(request: CreateOrder, createdAt: Date): Order {
  const lines = request.items.map((line) => {
    const item = items.find((candidate) => candidate.id === line.inventoryItemId)!
    return {
      id: uuid(),
      inventoryItemId: item.id,
      itemName: item.name,
      quantity: line.quantity,
      unitPrice: item.price,
      discount: line.discount,
      subtotal: lineSubtotal({
        unitPrice: item.price,
        quantity: line.quantity,
        discount: line.discount,
      }),
    }
  })
  const shop = mockShopSettings.current
  const customer = customers.find((candidate) => candidate.id === request.customerId)
  const pointsRedeemed = customer ? (request.pointsRedeemed ?? 0) : 0
  const totals = billTotals(
    lines,
    { kind: 'amount', value: request.discountAmount },
    shop,
    pointsDiscountOf(pointsRedeemed, shop.pointValueBaht),
  )
  return {
    id: uuid(),
    orderNumber: `ORD-${String(orderSequence++).padStart(5, '0')}`,
    customerId: customer?.id ?? null,
    customerName: customer?.fullName ?? '',
    totalAmount: totals.itemsTotal,
    discountAmount: totals.billDiscount,
    taxAmount: totals.tax,
    netAmount: totals.total,
    vatMode: shop.vatMode,
    vatRatePercent: shop.vatMode === 'None' ? 0 : shop.vatRatePercent,
    pointsEarned: customer ? pointsFor(totals.total, shop.bahtPerPoint) : 0,
    pointsRedeemed,
    pointsDiscount: totals.pointsDiscount,
    soldByName: useAuthStore.getState().user?.name ?? 'Somchai',
    status: 'Completed',
    paymentMethod: request.paymentMethod,
    createdAt: createdAt.toISOString(),
    completedAt: createdAt.toISOString(),
    items: lines,
  }
}

// Two weeks of past sales so the dashboard has something to show. Stock is not deducted.
const random = seededRandom(42)
for (let daysAgo = 13; daysAgo >= 1; daysAgo--) {
  const orderCount = 3 + random(6)
  for (let n = 0; n < orderCount; n++) {
    const lineCount = 1 + random(3)
    const picked = new Set<number>()
    while (picked.size < lineCount) picked.add(random(items.length))
    const createdAt = new Date(Date.now() - daysAgo * DAY_MS)
    createdAt.setHours(9 + random(10), random(60))
    orders.push(
      buildOrder(
        {
          customerId: null,
          paymentMethod: 'Cash',
          discountAmount: 0,
          notes: null,
          clientOrderId: uuid(),
          items: [...picked].map((index) => ({
            inventoryItemId: items[index].id,
            quantity: 1 + random(3),
            discount: 0,
          })),
        },
        createdAt,
      ),
    )
  }
}

// ---------- Helpers ----------

const includes = (value: string | null, search: string) =>
  !!value && value.toLowerCase().includes(search.toLowerCase())

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function changePoints(
  customerId: string,
  type: LoyaltyTransaction['type'],
  body: { points: number; description: string },
) {
  const customer = customers.find((candidate) => candidate.id === customerId)
  if (!customer) return notFound
  if (type === 'Redeemed' && body.points > customer.loyaltyPoints) {
    return problem(409, 'not_enough_points', 'Not enough points', {
      balance: customer.loyaltyPoints,
    })
  }
  customer.loyaltyPoints += type === 'Earned' ? body.points : -body.points
  loyalty.push({
    id: uuid(),
    customerId,
    type,
    points: body.points,
    orderId: null,
    description: body.description,
    createdAt: new Date().toISOString(),
  })
  return { status: 200, data: { ...customer } }
}

/** Like the API's sales report: completed bills of the days from..to, added up every way. */
function salesReport(from: string, to: string): SalesReport {
  const byDay = new Map<string, { orderCount: number; netSales: number }>()
  for (let day = new Date(`${from}T00:00:00`); localDate(day) <= to;) {
    byDay.set(localDate(day), { orderCount: 0, netSales: 0 })
    day.setDate(day.getDate() + 1)
  }
  const byItem = new Map<string, SalesReport['byItem'][number]>()
  const byCashier = new Map<string, SalesReport['byCashier'][number]>()
  const byPayment = new Map<string, SalesReport['byPaymentMethod'][number]>()
  const totals = { orderCount: 0, netSales: 0, taxAmount: 0, discounts: 0, cancelledCount: 0 }
  // The mock keeps no cost on a bill: it uses what the item costs now.
  const revenue = new Map<string, number>()

  for (const order of orders) {
    const day = byDay.get(localDate(new Date(order.createdAt)))
    if (!day) continue
    if (order.status === 'Cancelled') totals.cancelledCount++
    if (order.status !== 'Completed') continue

    day.orderCount++
    day.netSales = round2(day.netSales + order.netAmount)
    totals.orderCount++
    totals.netSales = round2(totals.netSales + order.netAmount)
    totals.taxAmount = round2(totals.taxAmount + order.taxAmount)
    totals.discounts = round2(
      totals.discounts +
        order.discountAmount +
        order.pointsDiscount +
        order.items.reduce((sum, line) => sum + line.discount, 0),
    )

    const cashier = byCashier.get(order.soldByName ?? '') ?? {
      userId: order.soldByName,
      name: order.soldByName,
      orderCount: 0,
      netSales: 0,
    }
    cashier.orderCount++
    cashier.netSales = round2(cashier.netSales + order.netAmount)
    byCashier.set(order.soldByName ?? '', cashier)

    const payment = byPayment.get(order.paymentMethod) ?? {
      paymentMethod: order.paymentMethod,
      orderCount: 0,
      netSales: 0,
    }
    payment.orderCount++
    payment.netSales = round2(payment.netSales + order.netAmount)
    byPayment.set(order.paymentMethod, payment)

    for (const line of order.items) {
      const entry = byItem.get(line.inventoryItemId) ?? {
        inventoryItemId: line.inventoryItemId,
        name: line.itemName,
        category: items.find((item) => item.id === line.inventoryItemId)?.category ?? null,
        quantity: 0,
        amount: 0,
        cost: 0,
        profit: 0,
      }
      entry.quantity += line.quantity
      entry.amount = round2(entry.amount + line.subtotal)
      const unitCost = items.find((item) => item.id === line.inventoryItemId)?.cost ?? 0
      entry.cost = round2((entry.cost ?? 0) + unitCost * line.quantity)
      // The line's share of what the bill earned without VAT, after every discount.
      const share = order.totalAmount
        ? (line.subtotal * (order.netAmount - order.taxAmount)) / order.totalAmount
        : 0
      revenue.set(line.inventoryItemId, (revenue.get(line.inventoryItemId) ?? 0) + share)
      byItem.set(line.inventoryItemId, entry)
    }
  }

  let cost = 0
  let costedRevenue = 0
  for (const item of byItem.values()) {
    const earned = revenue.get(item.inventoryItemId) ?? 0
    item.profit = round2(earned - (item.cost ?? 0))
    cost += item.cost ?? 0
    costedRevenue += earned
  }

  const byCategory = new Map<string, SalesReport['byCategory'][number]>()
  for (const item of byItem.values()) {
    const entry = byCategory.get(item.category ?? '') ?? {
      category: item.category,
      quantity: 0,
      amount: 0,
      cost: 0,
      profit: 0,
    }
    entry.quantity += item.quantity
    entry.amount = round2(entry.amount + item.amount)
    entry.cost = round2((entry.cost ?? 0) + (item.cost ?? 0))
    entry.profit = round2((entry.profit ?? 0) + (item.profit ?? 0))
    byCategory.set(item.category ?? '', entry)
  }

  return {
    from,
    to,
    totals: {
      ...totals,
      averageOrderValue: totals.orderCount ? round2(totals.netSales / totals.orderCount) : 0,
      cost: round2(cost),
      grossProfit: round2(costedRevenue - cost),
      grossMarginPercent: costedRevenue
        ? round2(((costedRevenue - cost) / costedRevenue) * 100)
        : 0,
      salesWithoutCost: 0,
    },
    byDay: [...byDay].map(([date, value]) => ({ date, ...value })),
    byItem: [...byItem.values()].sort((a, b) => b.amount - a.amount),
    byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
    byCashier: [...byCashier.values()].sort((a, b) => b.netSales - a.netSales),
    byPaymentMethod: [...byPayment.values()].sort((a, b) => b.netSales - a.netSales),
  }
}

/**
 * The points a bill moves: used (Redeemed) and given (Earned) when it is sold, given back
 * (Returned) and taken back (Reversed) when it is cancelled.
 */
function movePoints(order: Order, type: LoyaltyTransaction['type']) {
  const customer = customers.find((candidate) => candidate.id === order.customerId)
  const points =
    type === 'Earned' || type === 'Reversed' ? order.pointsEarned : order.pointsRedeemed
  if (!customer || points === 0) return
  customer.loyaltyPoints += type === 'Earned' || type === 'Returned' ? points : -points
  loyalty.push({
    id: uuid(),
    customerId: customer.id,
    type,
    points,
    orderId: order.id,
    description: order.orderNumber,
    createdAt: new Date().toISOString(),
  })
}

// ---------- Routes ----------

// "u1" is the user the tests sign in as (src/test/render-app.tsx).
const users: ManagedUser[] = [
  {
    id: 'u1',
    email: 'user@shop.test',
    name: 'Somchai',
    role: 'Owner',
    isActive: true,
    createdAt: '2026-01-05T02:00:00Z',
  },
  {
    id: 'u2',
    email: 'somying@shop.test',
    name: 'สมหญิง รักงาน',
    role: 'Cashier',
    isActive: true,
    createdAt: '2026-02-11T03:30:00Z',
  },
  {
    id: 'u3',
    email: 'wichai@shop.test',
    name: 'วิชัย ดูยอด',
    role: 'Viewer',
    isActive: false,
    createdAt: '2026-03-20T08:15:00Z',
  },
]

// A fixed history, newest first. The mock does not record new changes.
const auditLog: AuditEntry[] = [
  {
    id: 'a5',
    createdAt: '2026-11-27T04:10:00Z',
    userId: 'u1',
    userName: 'Somchai',
    action: 'Updated',
    entityType: 'InventoryItem',
    entityId: 'i2',
    entityLabel: 'ข้าวสาร 1 กก.',
    changes: { quantity: { old: 3, new: 20 }, price: { old: 42, new: 45 } },
  },
  {
    id: 'a4',
    createdAt: '2026-11-26T10:30:00Z',
    userId: 'u1',
    userName: 'Somchai',
    action: 'Updated',
    entityType: 'Order',
    entityId: 'o9',
    entityLabel: 'ORD-20261126-AB12CD34',
    changes: { status: { old: 'Completed', new: 'Cancelled' } },
  },
  {
    id: 'a3',
    createdAt: '2026-11-25T08:00:00Z',
    userId: 'u1',
    userName: 'Somchai',
    action: 'Updated',
    entityType: 'User',
    entityId: 'u3',
    entityLabel: 'wichai@shop.test',
    changes: {
      role: { old: 'Cashier', new: 'Viewer' },
      isActive: { old: true, new: false },
      passwordHash: { old: '***', new: '***' },
    },
  },
  {
    id: 'a2',
    createdAt: '2026-11-24T03:20:00Z',
    userId: 'gone',
    userName: null,
    action: 'Deleted',
    entityType: 'Customer',
    entityId: 'c9',
    entityLabel: 'ลูกค้า เก่า',
    changes: { firstName: { old: 'ลูกค้า', new: null }, lastName: { old: 'เก่า', new: null } },
  },
  {
    id: 'a1',
    createdAt: '2026-11-23T02:00:00Z',
    userId: 'u1',
    userName: 'Somchai',
    action: 'Created',
    entityType: 'InventoryItem',
    entityId: 'i7',
    entityLabel: 'ขนมปังแผ่น',
    changes: { name: { old: null, new: 'ขนมปังแผ่น' }, quantity: { old: null, new: 30 } },
  },
]

/** A refusal like the API's: the stable code the app translates, and the English detail. */
const problem = (
  status: 400 | 409,
  code: string,
  detail: string,
  params?: Record<string, string | number>,
): MockResult => ({
  status,
  data: { title: status === 409 ? 'Conflict' : 'Bad Request', status, detail, code, params },
})

export const dataRoutes: MockRoute[] = [
  // Audit trail
  [
    'GET',
    '/audit-logs',
    ({ query }) => {
      const page = Math.max(Number(query.page ?? 1), 1)
      const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100)
      const matching = auditLog.filter(
        (entry) => !query.entityType || entry.entityType === query.entityType,
      )
      const items = matching.slice((page - 1) * pageSize, page * pageSize)
      return { status: 200, data: { items, total: matching.length, page, pageSize } }
    },
  ],

  // Users
  ['GET', '/users', () => ({ status: 200, data: users.map((user) => ({ ...user })) })],
  [
    'POST',
    '/users',
    ({ body }) => {
      const input = body as CreateUser
      const email = input.email.trim().toLowerCase()
      if (users.some((user) => user.email === email)) {
        return problem(409, 'user_email_taken', `A user with email ${email} already exists.`, {
          email,
        })
      }
      const user: ManagedUser = {
        id: crypto.randomUUID(),
        email,
        name: input.name.trim(),
        role: input.role,
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      users.push(user)
      return { status: 201, data: { ...user } }
    },
  ],
  [
    'PUT',
    '/users/:id',
    ({ params, body }) => {
      const user = users.find((candidate) => candidate.id === params.id)
      if (!user) return notFound
      const changes = body as UpdateUser
      const role = changes.role ?? user.role
      const isActive = changes.isActive ?? user.isActive
      const losesOwnership =
        user.role === 'Owner' && user.isActive && (role !== 'Owner' || !isActive)
      const otherOwner = users.some((u) => u.id !== user.id && u.role === 'Owner' && u.isActive)
      if (losesOwnership && !otherOwner) {
        return problem(409, 'last_owner', 'The shop must keep at least one active owner.')
      }
      Object.assign(user, { name: changes.name?.trim() ?? user.name, role, isActive })
      return { status: 200, data: { ...user } }
    },
  ],
  [
    'POST',
    '/users/:id/reset-password',
    ({ params }) => (users.some((user) => user.id === params.id) ? { status: 204 } : notFound),
  ],

  // Inventory
  [
    'GET',
    '/inventory',
    ({ query }) => {
      const search = typeof query.search === 'string' ? query.search : ''
      const result = items.filter(
        (item) =>
          (!search ||
            includes(item.name, search) ||
            includes(item.sku, search) ||
            includes(item.barcode, search)) &&
          (!query.category || item.category === query.category) &&
          (query.isActive === undefined || item.isActive === query.isActive) &&
          (!query.lowStock || item.quantity <= item.minimumStock),
      )
      return listResult(
        result.map((item) => ({ ...item })).sort((a, b) => a.name.localeCompare(b.name, 'th')),
        query,
        {
          name: (item) => item.name,
          sku: (item) => item.sku,
          category: (item) => item.category ?? '',
          price: (item) => item.price,
          quantity: (item) => item.quantity,
          createdAt: (item) => item.createdAt,
        },
      )
    },
  ],
  [
    'GET',
    '/inventory/categories',
    () => ({
      status: 200,
      data: [...new Set(items.map((item) => item.category).filter((c): c is string => !!c))].sort(),
    }),
  ],
  [
    'GET',
    '/inventory/barcode/:barcode',
    ({ params }) => {
      const item = items.find((candidate) => candidate.barcode === params.barcode)
      return item ? { status: 200, data: { ...item } } : notFound
    },
  ],
  [
    'POST',
    '/inventory/import',
    // The mock does not read the file: its name decides the answer.
    ({ body, query }) => {
      const name = ((body as FormData).get('file') as File).name
      if (name.endsWith('.txt')) {
        return problem(400, 'import_file_type', 'The file must be .xlsx or .csv.')
      }
      if (name.includes('wrong')) {
        const result: ItemImportResult = {
          totalRows: 3,
          toCreate: 1,
          toUpdate: 0,
          stockNotChanged: 0,
          applied: false,
          errorCount: 2,
          errors: [
            {
              row: 3,
              code: 'import_required',
              params: { column: 'sku' },
              message: 'sku is required.',
            },
            {
              row: 4,
              code: 'import_duplicate_sku',
              params: { sku: 'A-001', row: 2 },
              message: 'SKU A-001 is also on row 2.',
            },
          ],
        }
        return { status: 200, data: result }
      }
      const applied = String(query.dryRun) !== 'true'
      if (applied) {
        items.push({
          ...items[0],
          id: uuid(),
          sku: `IMPORTED-${items.length}`,
          name: 'สินค้าจากไฟล์',
          barcode: null,
          quantity: 10,
        })
      }
      const result: ItemImportResult = {
        totalRows: 2,
        toCreate: 1,
        toUpdate: 1,
        stockNotChanged: 1,
        applied,
        errorCount: 0,
        errors: [],
      }
      return { status: 200, data: result }
    },
  ],
  [
    'POST',
    '/inventory',
    ({ body }) => {
      const input = body as CreateInventoryItem
      if (items.some((item) => item.sku === input.sku)) {
        return problem(409, 'sku_taken', `SKU ${input.sku} already exists`, { sku: input.sku })
      }
      const item: InventoryItem = {
        ...input,
        description: null,
        imageUrl: null,
        id: uuid(),
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      items.unshift(item)
      return { status: 201, data: { ...item } }
    },
  ],
  [
    'PUT',
    '/inventory/:id',
    ({ params, body }) => {
      const item = items.find((candidate) => candidate.id === params.id)
      if (!item) return notFound
      Object.assign(item, body)
      return { status: 200, data: { ...item } }
    },
  ],
  [
    'DELETE',
    '/inventory/:id',
    ({ params }) => {
      const index = items.findIndex((candidate) => candidate.id === params.id)
      if (index < 0) return notFound
      items.splice(index, 1)
      return { status: 204 }
    },
  ],

  // Customers
  [
    'GET',
    '/customers',
    ({ query }) => {
      const search = typeof query.search === 'string' ? query.search : ''
      return listResult(
        customers
          .filter(
            (customer) =>
              !search ||
              includes(customer.fullName, search) ||
              includes(customer.email, search) ||
              includes(customer.phone, search),
          )
          .map((customer) => ({ ...customer })),
        query,
        {
          name: (customer) => customer.fullName,
          loyaltyPoints: (customer) => customer.loyaltyPoints,
          createdAt: (customer) => customer.createdAt,
        },
      )
    },
  ],
  [
    'POST',
    '/customers',
    ({ body }) => {
      const input = body as Pick<Customer, 'firstName' | 'lastName' | 'email' | 'phone'>
      const customer = makeCustomer(input.firstName, input.lastName, input.email, input.phone)
      customers.unshift(customer)
      return { status: 201, data: { ...customer } }
    },
  ],
  [
    'PUT',
    '/customers/:id',
    ({ params, body }) => {
      const customer = customers.find((candidate) => candidate.id === params.id)
      if (!customer) return notFound
      // Like the API: a missing field is left alone, an empty string clears it.
      const changes = body as Partial<
        Record<'firstName' | 'lastName' | 'email' | 'phone' | 'address', string>
      >
      const email = changes.email?.trim().toLowerCase()
      if (email && customers.some((other) => other !== customer && other.email === email)) {
        return problem(
          409,
          'customer_email_taken',
          `A customer with email ${email} already exists.`,
          { email },
        )
      }
      if (changes.firstName !== undefined) customer.firstName = changes.firstName.trim()
      if (changes.lastName !== undefined) customer.lastName = changes.lastName.trim()
      if (email !== undefined) customer.email = email || null
      if (changes.phone !== undefined) customer.phone = changes.phone.trim() || null
      if (changes.address !== undefined) customer.address = changes.address.trim() || null
      customer.fullName = `${customer.firstName} ${customer.lastName}`.trim()
      return { status: 200, data: { ...customer } }
    },
  ],
  [
    'DELETE',
    '/customers/:id',
    ({ params }) => {
      const index = customers.findIndex((candidate) => candidate.id === params.id)
      if (index < 0) return notFound
      customers.splice(index, 1)
      return { status: 204 }
    },
  ],
  [
    'GET',
    '/customers/:id/loyalty',
    ({ params }) => ({
      status: 200,
      data: loyalty
        .filter((entry) => entry.customerId === params.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }),
  ],
  [
    'POST',
    '/customers/:id/loyalty/earn',
    ({ params, body }) =>
      changePoints(params.id, 'Earned', body as { points: number; description: string }),
  ],
  [
    'POST',
    '/customers/:id/loyalty/redeem',
    ({ params, body }) =>
      changePoints(params.id, 'Redeemed', body as { points: number; description: string }),
  ],

  // Orders
  [
    'POST',
    '/orders',
    ({ body }) => {
      const request = body as CreateOrder
      const existing = ordersByClientId.get(request.clientOrderId)
      if (existing) return { status: 200, data: existing }

      for (const line of request.items) {
        const item = items.find((candidate) => candidate.id === line.inventoryItemId)
        if (!item) return notFound
        if (line.quantity > item.quantity) {
          return problem(
            409,
            'insufficient_stock',
            `Insufficient stock for ${item.name} (${item.quantity} left)`,
            { name: item.name, available: item.quantity },
          )
        }
      }

      // Like the API: points need a customer who has them and a shop that takes them, and
      // must leave something to pay.
      const asked = request.pointsRedeemed ?? 0
      if (asked > 0) {
        const customer = customers.find((candidate) => candidate.id === request.customerId)
        if (!customer || mockShopSettings.current.pointValueBaht <= 0) {
          return problem(400, 'points_not_accepted', 'Points cannot be used on this bill.')
        }
        if (asked > customer.loyaltyPoints) {
          return problem(409, 'not_enough_points', 'Not enough points', {
            balance: customer.loyaltyPoints,
          })
        }
      }

      const order = buildOrder(request, new Date())
      if (asked > 0 && order.totalAmount - order.discountAmount - order.pointsDiscount <= 0) {
        return problem(400, 'points_leave_nothing', 'The points must leave something to pay.')
      }
      movePoints(order, 'Redeemed')
      movePoints(order, 'Earned')
      for (const line of request.items) {
        items.find((candidate) => candidate.id === line.inventoryItemId)!.quantity -= line.quantity
      }
      orders.push(order)
      ordersByClientId.set(request.clientOrderId, order)
      return { status: 201, data: order }
    },
  ],

  [
    'GET',
    '/orders',
    ({ query }) => {
      const matching = orders
        .filter((order) => {
          const day = localDate(new Date(order.createdAt))
          return (
            (!query.from || day >= String(query.from)) &&
            (!query.to || day <= String(query.to)) &&
            (!query.status || order.status === query.status)
          )
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const completed = matching.filter((order) => order.status === 'Completed')
      return listResult(
        matching,
        query,
        {
          createdAt: (order) => order.createdAt,
          netAmount: (order) => order.netAmount,
          orderNumber: (order) => order.orderNumber,
        },
        {
          completedCount: completed.length,
          completedTotal: round2(completed.reduce((sum, order) => sum + order.netAmount, 0)),
        },
      )
    },
  ],
  [
    'POST',
    '/orders/:id/cancel',
    ({ params }) => {
      const order = orders.find((candidate) => candidate.id === params.id)
      if (!order) return notFound
      // Like the API: cancelling twice does not put the stock back twice.
      if (order.status !== 'Cancelled') {
        order.status = 'Cancelled'
        movePoints(order, 'Returned')
        movePoints(order, 'Reversed')
        for (const line of order.items) {
          const item = items.find((candidate) => candidate.id === line.inventoryItemId)
          if (item) item.quantity += line.quantity
        }
      }
      return { status: 200, data: { message: 'Order cancelled successfully' } }
    },
  ],

  // Shop settings
  ['GET', '/shop-settings', () => ({ status: 200, data: { ...mockShopSettings.current } })],
  [
    'PUT',
    '/shop-settings',
    ({ body }) => {
      mockShopSettings.current = { ...DEFAULT_SHOP_SETTINGS, ...(body as ShopSettings) }
      return { status: 200, data: { ...mockShopSettings.current } }
    },
  ],

  // Subscription
  [
    'GET',
    '/subscriptions/current',
    () => (mockSubscription.current ? { status: 200, data: mockSubscription.current } : notFound),
  ],

  // Reports
  [
    'GET',
    '/reports/sales',
    ({ query }) => ({ status: 200, data: salesReport(String(query.from), String(query.to)) }),
  ],
  [
    'GET',
    '/reports/sales.xlsx',
    // Not a real workbook: enough for the page to have a file to save.
    () => ({ status: 200, data: new Blob(['mock workbook']) }),
  ],

  // Dashboard
  [
    'GET',
    '/dashboard/summary',
    ({ query }) => {
      const from = String(query.from)
      const to = String(query.to)
      const byDay = new Map<string, { total: number; orderCount: number }>()
      for (let day = new Date(`${from}T00:00:00`); localDate(day) <= to;) {
        byDay.set(localDate(day), { total: 0, orderCount: 0 })
        day.setDate(day.getDate() + 1)
      }

      const byItem = new Map<string, { name: string; quantity: number; total: number }>()
      let totalSales = 0
      let orderCount = 0
      for (const order of orders) {
        const bucket = byDay.get(localDate(new Date(order.createdAt)))
        if (!bucket || order.status !== 'Completed') continue
        bucket.total = round2(bucket.total + order.netAmount)
        bucket.orderCount++
        totalSales += order.netAmount
        orderCount++
        for (const line of order.items) {
          const entry = byItem.get(line.inventoryItemId) ?? {
            name: line.itemName,
            quantity: 0,
            total: 0,
          }
          entry.quantity += line.quantity
          entry.total = round2(entry.total + line.subtotal)
          byItem.set(line.inventoryItemId, entry)
        }
      }

      const summary: DashboardSummary = {
        totalSales: round2(totalSales),
        orderCount,
        averageOrderValue: orderCount ? round2(totalSales / orderCount) : 0,
        lowStockCount: items.filter((item) => item.quantity <= item.minimumStock).length,
        salesByDay: [...byDay].map(([date, value]) => ({ date, ...value })),
        topItems: [...byItem]
          .map(([inventoryItemId, value]) => ({ inventoryItemId, ...value }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5),
      }
      return { status: 200, data: summary }
    },
  ],
]
