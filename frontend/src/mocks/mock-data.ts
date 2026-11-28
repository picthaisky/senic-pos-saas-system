import type { Customer, LoyaltyTransaction } from '@/features/customers/types'
import type { AuditEntry } from '@/features/audit/api'
import type { CreateUser, ManagedUser, UpdateUser } from '@/features/users/types'
import type { DashboardSummary } from '@/features/dashboard/api'
import type { CreateInventoryItem, InventoryItem } from '@/features/inventory/types'
import type { CreateOrder, Order } from '@/features/pos/types'
import type { MockResult, MockRoute } from './mock-api'

// In-memory stand-in for the contract endpoints the backend does not serve yet
// (docs/API_REFERENCE.md §3–6). Data resets on every page reload. It does not check roles.

const DAY_MS = 24 * 60 * 60 * 1000
const TAX_RATE = 0.07
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

const orders: Order[] = []
const ordersByClientId = new Map<string, Order>()
let orderSequence = 1

/** Same arithmetic as the backend's OrderService today: tax is 7% of the item total. */
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
      subtotal: round2(item.price * line.quantity - line.discount),
    }
  })
  const totalAmount = round2(lines.reduce((sum, line) => sum + line.subtotal, 0))
  const taxAmount = round2(totalAmount * TAX_RATE)
  const customer = customers.find((candidate) => candidate.id === request.customerId)
  return {
    id: uuid(),
    orderNumber: `ORD-${String(orderSequence++).padStart(5, '0')}`,
    customerId: customer?.id ?? null,
    customerName: customer?.fullName ?? '',
    totalAmount,
    discountAmount: request.discountAmount,
    taxAmount,
    netAmount: round2(totalAmount + taxAmount - request.discountAmount),
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
    return { status: 409, data: { title: 'Conflict', status: 409, detail: 'Not enough points' } }
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

const conflict = (detail: string): MockResult => ({
  status: 409,
  data: { title: 'Conflict', status: 409, detail },
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
        return conflict(`A user with email ${email} already exists.`)
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
        return conflict('The shop must keep at least one active owner.')
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
      return { status: 200, data: result.map((item) => ({ ...item })) }
    },
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
    '/inventory',
    ({ body }) => {
      const input = body as CreateInventoryItem
      if (items.some((item) => item.sku === input.sku)) {
        return {
          status: 409,
          data: { title: 'Conflict', status: 409, detail: `SKU ${input.sku} already exists` },
        }
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
  ['GET', '/customers', () => ({ status: 200, data: customers.map((c) => ({ ...c })) })],
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
          return {
            status: 409,
            data: {
              title: 'Conflict',
              status: 409,
              detail: `Insufficient stock for ${item.name} (${item.quantity} left)`,
            },
          }
        }
      }

      const order = buildOrder(request, new Date())
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
    ({ query }) => ({
      status: 200,
      data: orders
        .filter((order) => {
          const day = localDate(new Date(order.createdAt))
          return (
            (!query.from || day >= String(query.from)) &&
            (!query.to || day <= String(query.to)) &&
            (!query.status || order.status === query.status)
          )
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }),
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
        for (const line of order.items) {
          const item = items.find((candidate) => candidate.id === line.inventoryItemId)
          if (item) item.quantity += line.quantity
        }
      }
      return { status: 200, data: { message: 'Order cancelled successfully' } }
    },
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
