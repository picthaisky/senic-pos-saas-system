#!/usr/bin/env node
// Smoke test of a running Senic POS stack, through its public address (the web container).
// No dependencies; needs Node 20+.
//
//   SMOKE_URL=http://localhost:8080 node deploy/smoke-test.mjs
//
// Environment:
//   SMOKE_URL        Base address of the web app (required).
//   SMOKE_TENANT_ID, SMOKE_EMAIL, SMOKE_PASSWORD
//                    A user to sign in with. Without them only the checks that need no
//                    account run. Use an Owner or Admin account.
//   SMOKE_MODE       "readonly" (default): never changes data; safe against production.
//                    "full": also creates an item, customers and orders and cancels one.
//                    Only for throw-away stacks (CI, local).
//
// Exit code 0 when every check passed, 1 otherwise. Secrets are never printed.

const env = process.env
const base = (env.SMOKE_URL ?? '').replace(/\/+$/, '')
if (!base) {
  console.error('SMOKE_URL is not set, e.g. SMOKE_URL=http://localhost:8080')
  process.exit(2)
}
const full = env.SMOKE_MODE === 'full'
const credentials =
  env.SMOKE_TENANT_ID && env.SMOKE_EMAIL && env.SMOKE_PASSWORD
    ? { tenantId: env.SMOKE_TENANT_ID, email: env.SMOKE_EMAIL, password: env.SMOKE_PASSWORD }
    : null

let token = ''
let cookie = ''

async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    json = undefined
  }
  return { status: res.status, json, headers: res.headers }
}

const results = []
function check(name, ok, detail = '') {
  results.push(!!ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

// ---------- No account needed ----------

const page = await fetch(base + '/')
check('web serves the app', page.status === 200 && (await page.text()).includes('<div id="root">'))

const spa = await fetch(base + '/inventory')
check('client-side routes fall back to index.html', spa.status === 200)

const sw = await fetch(base + '/sw.js')
check(
  'service worker is served and never cached',
  sw.status === 200 && sw.headers.get('cache-control') === 'no-cache',
  `cache-control: ${sw.headers.get('cache-control')}`,
)

const health = await call('GET', '/health')
check('API is healthy', health.status === 200 && health.json?.status === 'healthy', `version ${health.json?.version}`)
const ready = await call('GET', '/health/ready')
check('API can reach its database', ready.status === 200, `status ${ready.status}`)
if (env.EXPECTED_VERSION) {
  check('running the expected version', health.json?.version === env.EXPECTED_VERSION, `got ${health.json?.version}`)
}

const anonymous = await call('GET', '/api/inventory')
check('API requires sign-in', anonymous.status === 401, `status ${anonymous.status}`)

// ---------- With an account ----------

if (!credentials) {
  console.log('SKIP  signed-in checks (SMOKE_TENANT_ID, SMOKE_EMAIL, SMOKE_PASSWORD not set)')
} else {
  const bad = await call('POST', '/api/auth/login', { ...credentials, password: `${credentials.password}-wrong` })
  check('wrong password is rejected', bad.status === 401, `status ${bad.status}`)

  const login = await call('POST', '/api/auth/login', credentials)
  check('sign-in works', login.status === 200 && !!login.json?.accessToken, `status ${login.status}`)
  token = login.json?.accessToken ?? ''
  const setCookie = login.headers.get('set-cookie') ?? ''
  cookie = setCookie.split(';')[0]
  check(
    'refresh cookie is HttpOnly, Secure, SameSite=Strict',
    /httponly/i.test(setCookie) && /secure/i.test(setCookie) && /samesite=strict/i.test(setCookie),
  )

  const refresh = await call('POST', '/api/auth/refresh')
  check('refresh issues a new token', refresh.status === 200 && !!refresh.json?.accessToken, `status ${refresh.status}`)
  token = refresh.json?.accessToken ?? token

  const inventory = await call('GET', '/api/inventory')
  check('inventory list', inventory.status === 200 && Array.isArray(inventory.json), `status ${inventory.status}`)
  const customers = await call('GET', '/api/customers')
  check('customer list', customers.status === 200 && Array.isArray(customers.json), `status ${customers.status}`)
  const dashboard = await call('GET', '/api/dashboard/summary')
  check(
    'dashboard summary (also proves time zone data is present)',
    dashboard.status === 200 && dashboard.json?.salesByDay?.length === 7,
    `status ${dashboard.status}`,
  )
  const users = await call('GET', '/api/users')
  check(
    'user list includes the signed-in account',
    users.status === 200 && users.json?.some((u) => u.email === credentials.email.toLowerCase()),
    `status ${users.status}`,
  )
  const negotiate = await call('POST', '/hubs/notifications/negotiate?negotiateVersion=1')
  check('SignalR hub is reachable through the proxy', negotiate.status === 200 && !!negotiate.json?.connectionId, `status ${negotiate.status}`)

  if (full) {
    const sku = `SMOKE-${Date.now()}`
    const item = await call('POST', '/api/inventory', {
      sku,
      name: 'น้ำดื่ม smoke',
      barcode: sku,
      price: 19.99,
      cost: 10,
      quantity: 6,
      minimumStock: 5,
      category: 'เครื่องดื่ม',
    })
    check('create item (Thai text, decimals)', item.status === 201 && item.json?.name === 'น้ำดื่ม smoke', `status ${item.status}`)

    const duplicate = await call('POST', '/api/inventory', { sku, name: 'dup', price: 1, cost: 1, quantity: 1, minimumStock: 0 })
    check('duplicate SKU is a 409', duplicate.status === 409, `status ${duplicate.status}`)

    const search = await call('GET', `/api/inventory?search=${encodeURIComponent('น้ำดื่ม SMOKE')}`)
    check('case-insensitive search', search.status === 200 && search.json?.some((i) => i.sku === sku))

    const byBarcode = await call('GET', `/api/inventory/barcode/${sku}`)
    check('barcode lookup', byBarcode.status === 200)

    const customer = await call('POST', '/api/customers', { firstName: 'มาลี', lastName: '', phone: '0812345678' })
    check('create customer without email', customer.status === 201 && customer.json?.email === null, `status ${customer.status}`)
    const second = await call('POST', '/api/customers', { firstName: 'สมชาย', lastName: 'ใจดี' })
    check('a second customer without email', second.status === 201, `status ${second.status}`)

    const sale = {
      customerId: customer.json?.id,
      paymentMethod: 'Cash',
      discountAmount: 0,
      clientOrderId: crypto.randomUUID(),
      items: [{ inventoryItemId: item.json?.id, quantity: 3, discount: 0 }],
    }
    const order = await call('POST', '/api/orders', sale)
    check(
      'sale is recorded with rounded tax',
      order.status === 201 && order.json?.taxAmount === 4.2 && order.json?.netAmount === 64.17 && order.json?.status === 'Completed',
      `status ${order.status}, tax ${order.json?.taxAmount}, net ${order.json?.netAmount}`,
    )
    const again = await call('POST', '/api/orders', sale)
    check('the same clientOrderId returns the same order', again.json?.id === order.json?.id)

    const walkIn = await call('POST', '/api/orders', {
      customerId: null,
      paymentMethod: 'QRCode',
      items: [{ inventoryItemId: item.json?.id, quantity: 1 }],
    })
    check('walk-in sale', walkIn.status === 201, `status ${walkIn.status}`)

    const tooMany = await call('POST', '/api/orders', { paymentMethod: 'Cash', items: [{ inventoryItemId: item.json?.id, quantity: 99 }] })
    check('insufficient stock is a 409', tooMany.status === 409, `status ${tooMany.status}`)

    const afterSales = await call('GET', `/api/inventory/${item.json?.id}`)
    check('stock deducted once per sale (6 - 3 - 1)', afterSales.json?.quantity === 2, `quantity ${afterSales.json?.quantity}`)

    await call('POST', `/api/customers/${customer.json?.id}/loyalty/earn`, { points: 50, description: 'ทดสอบ' })
    const redeem = await call('POST', `/api/customers/${customer.json?.id}/loyalty/redeem`, { points: 20, description: 'แลก' })
    const history = await call('GET', `/api/customers/${customer.json?.id}/loyalty`)
    check('loyalty earn, redeem and history', redeem.json?.loyaltyPoints === 30 && history.json?.length === 2, `points ${redeem.json?.loyaltyPoints}`)

    const orders = await call('GET', '/api/orders?status=Completed')
    check('order list shows the customer name', orders.status === 200 && orders.json?.some((o) => o.customerName === 'มาลี'))

    const cancel = await call('POST', `/api/orders/${walkIn.json?.id}/cancel`)
    const afterCancel = await call('GET', `/api/inventory/${item.json?.id}`)
    check('cancelling returns the stock', cancel.status === 200 && afterCancel.json?.quantity === 3, `quantity ${afterCancel.json?.quantity}`)

    const trail = await call('GET', `/api/audit-logs?entityType=Order&entityId=${walkIn.json?.id}`)
    check(
      'the cancellation is in the change history, with who did it',
      trail.status === 200 && trail.json?.items?.[0]?.changes?.status?.new === 'Cancelled' && !!trail.json.items[0].userName,
      `status ${trail.status}`,
    )

    const remove = await call('DELETE', `/api/customers/${second.json?.id}`)
    check('delete customer', remove.status === 204, `status ${remove.status}`)

    // A throw-away member of staff: added, signs in, is deactivated, can no longer sign in.
    const staff = {
      tenantId: credentials.tenantId,
      email: `smoke-${Date.now()}@smoke.test`,
      password: `Smoke-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    }
    const signInAsStaff = () =>
      fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staff),
      })
    const created = await call('POST', '/api/users', { email: staff.email, name: 'Smoke Staff', role: 'Cashier', password: staff.password })
    check('add a user', created.status === 201 && created.json?.role === 'Cashier', `status ${created.status}`)
    check('the new user can sign in', (await signInAsStaff()).status === 200)
    const deactivated = await call('PUT', `/api/users/${created.json?.id}`, { isActive: false })
    const refused = await signInAsStaff()
    check('a deactivated user cannot sign in', deactivated.status === 200 && refused.status === 401, `status ${refused.status}`)
    const self = users.json?.find((u) => u.email === credentials.email.toLowerCase())
    const lockOut = await call('PUT', `/api/users/${self?.id}`, { isActive: false })
    check('a manager cannot deactivate their own account', lockOut.status === 409, `status ${lockOut.status}`)
  }

  const logout = await call('POST', '/api/auth/logout')
  const afterLogout = await call('POST', '/api/auth/refresh')
  check('sign-out ends the session', logout.status === 204 && afterLogout.status === 401)
}

const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed (${full ? 'full' : 'read-only'} mode)`)
process.exit(failed ? 1 : 0)
