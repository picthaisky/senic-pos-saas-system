// Checks live notifications end to end against a running stack: connects the same SignalR
// client the web app uses, makes a sale that takes an item across its reorder point, and waits
// for both events. Run from frontend/ (it uses this project's @microsoft/signalr):
//
//   SMOKE_URL=http://localhost:8080 SMOKE_TENANT_ID=... SMOKE_EMAIL=... SMOKE_PASSWORD=... \
//     node scripts/check-realtime.mjs
//
// It creates one inventory item and one order, so use it on throw-away stacks only.

import { HttpTransportType, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'

const env = process.env
const base = (env.SMOKE_URL ?? '').replace(/\/+$/, '')
for (const name of ['SMOKE_URL', 'SMOKE_TENANT_ID', 'SMOKE_EMAIL', 'SMOKE_PASSWORD']) {
  if (!env[name]) {
    console.error(`${name} is not set`)
    process.exit(2)
  }
}

async function post(path, body, token) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`POST ${path} answered ${response.status}`)
  return response.json()
}

const { accessToken } = await post('/api/auth/login', {
  tenantId: env.SMOKE_TENANT_ID,
  email: env.SMOKE_EMAIL,
  password: env.SMOKE_PASSWORD,
})

const received = { OrderCreated: null, LowStock: null }
const connection = new HubConnectionBuilder()
  .withUrl(`${base}/hubs/notifications`, {
    accessTokenFactory: () => accessToken,
    // The transport browsers use; fail rather than silently fall back to polling.
    transport: HttpTransportType.WebSockets,
  })
  .configureLogging(LogLevel.Error)
  .build()
connection.on('OrderCreated', (event) => {
  received.OrderCreated = event
})
connection.on('LowStock', (event) => {
  received.LowStock = event
})

await connection.start()
console.log('PASS  connected over WebSockets through the proxy')

const sku = `RT-${Date.now()}`
const item = await post(
  '/api/inventory',
  { sku, name: 'Realtime check', price: 100, cost: 50, quantity: 6, minimumStock: 5 },
  accessToken,
)
const order = await post(
  '/api/orders',
  { paymentMethod: 'Cash', items: [{ inventoryItemId: item.id, quantity: 2 }] },
  accessToken,
)

const deadline = Date.now() + 10_000
while ((!received.OrderCreated || !received.LowStock) && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 100))
}
await connection.stop()

let failed = 0
function check(name, ok, detail) {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`)
}
check(
  'OrderCreated arrived',
  received.OrderCreated?.orderId === order.id,
  `net ${received.OrderCreated?.netAmount}`,
)
check(
  'LowStock arrived when the item crossed its reorder point',
  received.LowStock?.inventoryItemId === item.id && received.LowStock?.quantity === 4,
  `quantity ${received.LowStock?.quantity}, reorder point ${received.LowStock?.minimumStock}`,
)
process.exit(failed ? 1 : 0)
