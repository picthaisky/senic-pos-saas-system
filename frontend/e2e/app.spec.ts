import { expect, type Page, test } from '@playwright/test'

// The main journeys of the app in a real browser, against a real backend and database.
// Texts are the Thai UI strings (the default language).

const account = {
  tenantId: process.env.E2E_TENANT_ID ?? '',
  email: process.env.E2E_EMAIL ?? '',
  password: process.env.E2E_PASSWORD ?? '',
}

/** Optional: a folder to save a screenshot of each screen into, for a human to look at. */
const shotsDir = process.env.E2E_SCREENSHOTS

async function shot(page: Page, name: string) {
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}.png`, fullPage: true })
}

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('รหัสร้าน (Tenant ID)').fill(account.tenantId)
  await page.getByLabel('อีเมล').fill(account.email)
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  await expect(page.getByRole('heading', { name: 'ภาพรวม' })).toBeVisible()
}

/** Adds an item through the Inventory screen and returns its unique name. */
async function addItem(
  page: Page,
  options: { price: string; quantity: string; minimumStock?: string },
) {
  const id = `${Date.now()}`.slice(-8)
  const name = `สินค้า E2E ${id}`
  await page.getByRole('link', { name: 'สินค้าคงคลัง' }).click()
  await page.getByRole('button', { name: 'เพิ่มสินค้า' }).click()
  const dialog = page.getByRole('dialog', { name: 'เพิ่มสินค้า' })
  await dialog.getByLabel('ชื่อสินค้า').fill(name)
  await dialog.getByLabel('SKU').fill(`E2E-${id}`)
  await dialog.getByLabel('บาร์โค้ด').fill(`99${id}`)
  await dialog.getByLabel('ราคาขาย').fill(options.price)
  await dialog.getByLabel('ต้นทุน').fill('1')
  await dialog.getByLabel('คงเหลือ').fill(options.quantity)
  await dialog.getByLabel('จุดสั่งซื้อ').fill(options.minimumStock ?? '0')
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('บันทึกสินค้าแล้ว')).toBeVisible()
  return { name, barcode: `99${id}` }
}

async function scan(page: Page, barcode: string) {
  const input = page.getByRole('textbox', { name: 'สแกนบาร์โค้ด' })
  await input.fill(barcode)
  await input.press('Enter')
}

test.beforeAll(() => {
  if (!account.tenantId || !account.email || !account.password) {
    throw new Error(
      'Set E2E_TENANT_ID, E2E_EMAIL and E2E_PASSWORD (an Owner account of a throw-away stack).',
    )
  }
})

test('rejects a wrong password and signs in with the right one', async ({ page }) => {
  await page.goto('/inventory')
  // Not signed in: sent to the login page.
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeVisible()
  await shot(page, '01-login')

  await page.getByLabel('รหัสร้าน (Tenant ID)').fill(account.tenantId)
  await page.getByLabel('อีเมล').fill(account.email)
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('wrong-password-123')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  await expect(page.getByText('รหัสร้าน อีเมล หรือรหัสผ่านไม่ถูกต้อง')).toBeVisible()

  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  // After signing in, the page that was asked for opens.
  await expect(page.getByRole('heading', { name: 'สินค้าคงคลัง' })).toBeVisible()
})

test('stays signed in after a reload and signs out', async ({ page }) => {
  await signIn(page)
  await shot(page, '02-dashboard')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'ภาพรวม' })).toBeVisible()

  await page.getByRole('button', { name: 'ออกจากระบบ' }).click()
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeVisible()
})

test('adds an item, sells it at the till and sees the stock go down', async ({ page }) => {
  await signIn(page)
  const item = await addItem(page, { price: '50', quantity: '10' })
  await shot(page, '03-inventory')

  await page.getByRole('link', { name: 'ขายหน้าร้าน' }).click()
  await scan(page, item.barcode)
  const cart = page.getByRole('region', { name: 'ตะกร้า' })
  await expect(cart.getByText(item.name)).toBeVisible()
  await cart.getByRole('button', { name: `เพิ่มจำนวน ${item.name}` }).click()
  // 2 x 50 + 7% tax
  await expect(cart.getByText('฿107.00')).toBeVisible()
  await expect(cart.getByText('ภาษี (7%)')).toBeVisible()
  await shot(page, '04-pos')

  await cart.getByRole('button', { name: 'ชำระเงิน' }).click()
  const receipt = page.getByRole('dialog', { name: 'บันทึกการขายแล้ว' })
  await expect(receipt.getByText(/^ORD-\d{8}-[0-9A-F]{8}$/)).toBeVisible()
  await expect(receipt.getByText('฿107.00')).toBeVisible()
  await shot(page, '05-receipt')
  await receipt.getByRole('button', { name: 'ขายรายการใหม่' }).click()

  await page.getByRole('link', { name: 'สินค้าคงคลัง' }).click()
  await expect(page.getByRole('heading', { name: 'สินค้าคงคลัง' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'ค้นหา', exact: true }).fill(item.name)
  const row = page.getByRole('row', { name: new RegExp(item.name) })
  await expect(row.getByRole('cell', { name: '8', exact: true })).toBeVisible()
})

test('keeps selling while offline and sends the sale when the connection returns', async ({
  page,
  context,
}) => {
  await signIn(page)
  const item = await addItem(page, { price: '20', quantity: '10' })

  // Opening the till downloads the catalogue for offline use.
  await page.getByRole('link', { name: 'ขายหน้าร้าน' }).click()
  await expect(page.getByRole('region', { name: 'ตะกร้า' })).toBeVisible()
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await expect(page.getByText('ออฟไลน์', { exact: true })).toBeVisible()

  await scan(page, item.barcode)
  const cart = page.getByRole('region', { name: 'ตะกร้า' })
  await expect(cart.getByText(item.name)).toBeVisible()
  await cart.getByRole('button', { name: 'ชำระเงิน' }).click()
  const saved = page.getByRole('dialog', { name: 'บันทึกการขายไว้ในเครื่องแล้ว' })
  await expect(saved).toBeVisible()
  await shot(page, '06-offline-sale')
  await saved.getByRole('button', { name: 'ขายรายการใหม่' }).click()
  await expect(page.getByRole('button', { name: 'รายการขายที่รอส่ง 1 รายการ' })).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByText('ส่งรายการขายที่ค้างแล้ว 1 รายการ')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: /รายการขายที่รอส่ง/ })).toBeHidden()

  // The server recorded it: stock went from 10 to 9.
  await page.getByRole('link', { name: 'สินค้าคงคลัง' }).click()
  await expect(page.getByRole('heading', { name: 'สินค้าคงคลัง' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'ค้นหา', exact: true }).fill(item.name)
  const row = page.getByRole('row', { name: new RegExp(item.name) })
  await expect(row.getByRole('cell', { name: '9', exact: true })).toBeVisible()
})

test('updates another open window when a sale happens', async ({ page, context }) => {
  await signIn(page)
  const item = await addItem(page, { price: '100', quantity: '6', minimumStock: '5' })

  // A second window of the same user, on the dashboard.
  const watcher = await context.newPage()
  await watcher.goto('/dashboard')
  const orders = watcher.locator('div', { hasText: /^จำนวนบิล/ }).last()
  await expect(orders).toBeVisible()
  const before = Number((await orders.innerText()).replace(/\D/g, ''))
  // Give the live connection a moment to be established.
  await watcher.waitForTimeout(2000)

  // Sell two in the first window: 6 -> 4 crosses the reorder point of 5.
  await page.getByRole('link', { name: 'ขายหน้าร้าน' }).click()
  await scan(page, item.barcode)
  const cart = page.getByRole('region', { name: 'ตะกร้า' })
  await cart.getByRole('button', { name: `เพิ่มจำนวน ${item.name}` }).click()
  await cart.getByRole('button', { name: 'ชำระเงิน' }).click()
  await expect(page.getByRole('dialog', { name: 'บันทึกการขายแล้ว' })).toBeVisible()

  // Without reloading, the other window shows the alert and the new count.
  await expect(watcher.getByText(`${item.name} ใกล้หมด เหลือ 4`)).toBeVisible({ timeout: 15_000 })
  await expect
    .poll(async () => Number((await orders.innerText()).replace(/\D/g, '')), { timeout: 15_000 })
    .toBe(before + 1)
  await shot(watcher, '07-realtime-dashboard')
})

test('works in English, in dark mode and on a phone-sized screen', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Switch to English' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await shot(page, '08-dashboard-dark-en')

  await page.setViewportSize({ width: 390, height: 844 })
  // On a phone the menu is a drawer.
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Customers' }).click()
  await expect(page.getByRole('heading', { name: 'Customers', level: 1 })).toBeVisible()
  await shot(page, '09-customers-mobile-dark')

  // Leave the shared account as the other tests expect it.
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await page.getByRole('button', { name: 'เปลี่ยนเป็นภาษาไทย' }).click()
  await page.getByRole('button', { name: 'เปลี่ยนเป็นโหมดสว่าง' }).click()
})
