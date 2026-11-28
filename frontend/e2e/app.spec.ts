import { expect, type Page, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

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

  // The shop says it is registered for VAT, with the tax already in its prices. Every later
  // test in this file sells in this shop.
  await page.getByRole('link', { name: 'ตั้งค่าร้าน' }).click()
  await page.getByLabel('ชื่อร้าน').fill('ร้านทดสอบ E2E')
  await page.getByLabel('ร้านกับ VAT').selectOption('Inclusive')
  await page.getByLabel('ยอดซื้อกี่บาทต่อ 1 แต้ม').fill('25')
  await page.getByLabel('1 แต้มใช้เป็นส่วนลดได้กี่บาท').fill('0.5')
  await shot(page, '02b-settings')
  await page.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('บันทึกการตั้งค่าแล้ว')).toBeVisible()

  const item = await addItem(page, { price: '50', quantity: '10' })
  await shot(page, '03-inventory')

  await page.getByRole('link', { name: 'ขายหน้าร้าน' }).click()
  await scan(page, item.barcode)
  const cart = page.getByRole('region', { name: 'ตะกร้า' })
  await expect(cart.getByText(item.name)).toBeVisible()
  await cart.getByRole('button', { name: `เพิ่มจำนวน ${item.name}` }).click()
  // 2 x 50 less a discount of 7 on the line = 93.00 to pay, with 93 x 7/107 = 6.08 of tax in it.
  await cart.getByLabel(`ส่วนลดของ ${item.name} (บาท)`).fill('7')
  await expect(cart.getByText('฿93.00').first()).toBeVisible()
  await expect(cart.getByText('รวมภาษีมูลค่าเพิ่ม 7% แล้ว')).toBeVisible()
  await expect(cart.getByText('฿6.08')).toBeVisible()
  await shot(page, '04-pos')

  await cart.getByRole('button', { name: 'ชำระเงิน' }).click()
  const receipt = page.getByRole('dialog', { name: 'บันทึกการขายแล้ว' })
  await expect(receipt.getByText(/^ORD-\d{8}-[0-9A-F]{8}$/)).toBeVisible()
  await expect(receipt.getByText('฿93.00')).toBeVisible()
  await expect(receipt.getByText('฿6.08')).toBeVisible()
  await shot(page, '05-receipt')

  // Printing: the browser's print dialog is replaced by a recorder. On paper only the receipt
  // is there; the screen behind it is not.
  await page.evaluate(() => {
    window.print = () => document.documentElement.setAttribute('data-printed', 'yes')
  })
  await receipt.getByRole('button', { name: 'พิมพ์ใบเสร็จ' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-printed', 'yes')
  await page.emulateMedia({ media: 'print' })
  const paper = page.locator('.receipt-print')
  await expect(paper.getByRole('heading', { name: 'ใบเสร็จรับเงิน' })).toBeVisible()
  await expect(paper.getByText('ร้านทดสอบ E2E')).toBeVisible()
  await expect(paper.getByRole('rowheader', { name: new RegExp(item.name) })).toBeVisible()
  await expect(paper.getByText('รวมภาษีมูลค่าเพิ่ม 7% แล้ว')).toBeVisible()
  await expect(paper.getByText('เอกสารนี้ไม่ใช่ใบกำกับภาษี')).toBeVisible()
  await expect(paper.getByText('พนักงานขาย')).toBeVisible()
  await expect(cart).toBeHidden()
  await shot(page, '05b-receipt-print')
  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(paper).toHaveCount(0)
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
  // The app itself must be installed too, or it could not be reopened without a connection.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))

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
  const queueButton = page.getByRole('button', { name: 'รายการขายที่รอส่ง 1 รายการ' })
  await expect(queueButton).toBeVisible()

  // The unsent sale can be taken out of the browser as a file ...
  await queueButton.click()
  const queue = page.getByRole('dialog', { name: 'รายการขายที่รอส่ง' })
  const download = page.waitForEvent('download')
  await queue.getByRole('button', { name: 'ส่งออกเป็นไฟล์' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^offline-sales-.*.csv$/)
  expect(readFileSync(await file.path(), 'utf8')).toContain(item.name)
  await shot(page, '06b-offline-queue')
  await page.keyboard.press('Escape')

  // ... signing out asks first ...
  await page.getByRole('button', { name: 'ออกจากระบบ' }).click()
  const warning = page.getByRole('dialog', { name: 'ยังมีรายการขายที่ไม่ได้ส่ง' })
  await expect(warning.getByText(/1 รายการที่ยังไม่ถึงเซิร์ฟเวอร์/)).toBeVisible()
  await shot(page, '06c-sign-out-warning')
  await warning.getByRole('button', { name: 'ยกเลิก' }).click()

  // ... and it is still there after the page is closed and opened again without a connection.
  await page.reload()
  await expect(page.getByText('ออฟไลน์', { exact: true })).toBeVisible()
  await expect(queueButton).toBeVisible()

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

test('finds a sale in the sales history, cancels it and gets the stock back', async ({ page }) => {
  await signIn(page)
  const item = await addItem(page, { price: '30', quantity: '5' })

  await page.getByRole('link', { name: 'ขายหน้าร้าน' }).click()
  await scan(page, item.barcode)
  const cart = page.getByRole('region', { name: 'ตะกร้า' })
  await expect(cart.getByText(item.name)).toBeVisible()
  await cart.getByRole('button', { name: 'ชำระเงิน' }).click()
  const receipt = page.getByRole('dialog', { name: 'บันทึกการขายแล้ว' })
  const number = (await receipt.getByText(/^ORD-/).textContent())!
  await receipt.getByRole('button', { name: 'ขายรายการใหม่' }).click()

  await page.getByRole('link', { name: 'ประวัติการขาย' }).click()
  const row = page.getByRole('row', { name: new RegExp(number) })
  // The price already includes the tax.
  await expect(row.getByText('฿30.00')).toBeVisible()
  await shot(page, '12-orders')

  await row.getByRole('button', { name: `ดูรายละเอียด ${number}` }).click()
  const detail = page.getByRole('dialog', { name: number })
  await expect(detail.getByRole('rowheader', { name: item.name })).toBeVisible()
  await shot(page, '13-order-detail')

  await detail.getByRole('button', { name: 'ยกเลิกบิล' }).click()
  const confirm = page.getByRole('dialog', { name: 'ยกเลิกบิล', exact: true })
  await expect(confirm.getByText(/สินค้าในบิลจะถูกคืนเข้าสต็อก/)).toBeVisible()
  await confirm.getByRole('button', { name: 'ยกเลิกบิล' }).click()
  await expect(page.getByText(`ยกเลิกบิล ${number} แล้ว`)).toBeVisible()
  // The open bill shows its new status and can no longer be cancelled.
  await expect(detail.getByText('ยกเลิกแล้ว')).toBeVisible()
  await expect(detail.getByRole('button', { name: 'ยกเลิกบิล' })).toBeHidden()
  await detail.getByRole('button', { name: 'ปิด', exact: true }).last().click()

  // Sold one of five, cancelled: five again.
  await page.getByRole('link', { name: 'สินค้าคงคลัง' }).click()
  await page.getByRole('searchbox', { name: 'ค้นหา', exact: true }).fill(item.name)
  const stock = page.getByRole('row', { name: new RegExp(item.name) })
  await expect(stock.getByRole('cell', { name: '5', exact: true })).toBeVisible()
})

test('adds a customer, corrects their details, and opens the subscription page', async ({
  page,
}) => {
  await signIn(page)
  const id = `${Date.now()}`.slice(-8)
  await page.getByRole('link', { name: 'ลูกค้า', exact: true }).click()
  await page.getByLabel('ชื่อ', { exact: true }).fill(`ลูกค้า${id}`)
  await page.getByLabel('นามสกุล').fill('ทดสอบ')
  await page.getByRole('button', { name: 'เพิ่มลูกค้า' }).click()
  await expect(page.getByText('เพิ่มลูกค้าแล้ว')).toBeVisible()

  await page.getByRole('button', { name: `แก้ไข ลูกค้า${id} ทดสอบ` }).click()
  const dialog = page.getByRole('dialog', { name: 'แก้ไขลูกค้า' })
  await dialog.getByLabel('นามสกุล').fill('แก้แล้ว')
  await dialog.getByLabel('เบอร์โทร').fill('0811112222')
  await dialog.getByLabel('ที่อยู่').fill('99 ถนนทดสอบ')
  await shot(page, '14-customer-edit')
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('บันทึกลูกค้าแล้ว')).toBeVisible()

  const row = page.getByRole('row', { name: new RegExp(`ลูกค้า${id} แก้แล้ว`) })
  await expect(row.getByText('0811112222')).toBeVisible()
  // The server kept it: still there after a reload, address included.
  await page.reload()
  await page.getByRole('button', { name: `ดูรายละเอียด ลูกค้า${id} แก้แล้ว` }).click()
  await expect(page.getByText('99 ถนนทดสอบ')).toBeVisible()

  // A stack started from scratch has no subscription on record; the page says so plainly.
  await page.getByRole('link', { name: 'แพ็กเกจของร้าน' }).click()
  await expect(page.getByRole('heading', { name: 'แพ็กเกจของร้าน' })).toBeVisible()
  await expect(page.getByText(/ยังไม่มีข้อมูลแพ็กเกจ/)).toBeVisible()
  await shot(page, '15-subscription')
})

test('uses the points of a customer as a discount at the till', async ({ page }) => {
  await signIn(page)
  const id = `${Date.now()}`.slice(-8)
  const customer = `แต้ม${id} ทดสอบ`
  await page.getByRole('link', { name: 'ลูกค้า', exact: true }).click()
  await page.getByLabel('ชื่อ', { exact: true }).fill(`แต้ม${id}`)
  await page.getByLabel('นามสกุล').fill('ทดสอบ')
  await page.getByRole('button', { name: 'เพิ่มลูกค้า' }).click()
  await expect(page.getByText('เพิ่มลูกค้าแล้ว')).toBeVisible()
  await page.getByRole('button', { name: `ดูรายละเอียด ${customer}` }).click()
  await page.getByRole('button', { name: 'เพิ่มแต้ม' }).click()
  const give = page.getByRole('dialog', { name: 'เพิ่มแต้ม' })
  await give.getByLabel('แต้มสะสม').fill('40')
  await give.getByRole('button', { name: 'เพิ่มแต้ม' }).click()
  await expect(page.getByText('เพิ่มแต้มแล้ว')).toBeVisible()

  const item = await addItem(page, { price: '50', quantity: '5' })
  await page.getByRole('link', { name: 'ขายหน้าร้าน' }).click()
  await scan(page, item.barcode)
  const cart = page.getByRole('region', { name: 'ตะกร้า' })
  await expect(cart.getByText(item.name)).toBeVisible()
  await cart.getByLabel('ลูกค้า').selectOption({ label: customer })

  // The shop gives half a baht per point: 20 points take 10 off, 40.00 is paid, and the tax
  // inside it is 40 x 7/107 = 2.62.
  await cart.getByLabel('ใช้แต้มเป็นส่วนลด').fill('20')
  await expect(cart.getByText('ส่วนลดจากแต้ม (20 แต้ม)')).toBeVisible()
  await expect(cart.getByText('-฿10.00')).toBeVisible()
  await expect(cart.getByText('฿40.00').first()).toBeVisible()
  await expect(cart.getByText('฿2.62')).toBeVisible()
  await shot(page, '15b-pos-points')

  await cart.getByRole('button', { name: 'ชำระเงิน' }).click()
  const receipt = page.getByRole('dialog', { name: 'บันทึกการขายแล้ว' })
  await expect(receipt.getByText('฿40.00')).toBeVisible()
  await expect(receipt.getByText('-฿10.00')).toBeVisible()
  await receipt.getByRole('button', { name: 'ขายรายการใหม่' }).click()

  // 40 - 20 used + 1 earned on the 40 baht paid.
  await page.getByRole('link', { name: 'ลูกค้า', exact: true }).click()
  await page.getByRole('button', { name: `ดูรายละเอียด ${customer}` }).click()
  const history = page.getByRole('region', { name: 'ประวัติแต้ม' })
  await expect(history.getByText(/ใช้เป็นส่วนลด ORD-/)).toBeVisible()
  await expect(history.getByText(/จากการขาย ORD-/)).toBeVisible()
  // An exact cell: the customer's generated name may contain the same digits.
  await expect(
    page
      .getByRole('row', { name: new RegExp(customer) })
      .getByRole('cell', { name: '21', exact: true }),
  ).toBeVisible()
})

test('opens the sales report and downloads it as a spreadsheet', async ({ page }) => {
  await signIn(page)
  await page.getByRole('link', { name: 'รายงาน', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'รายงาน', exact: true })).toBeVisible()

  // The earlier tests sold in this shop, so there are sales to report.
  const totals = page.getByRole('region', { name: 'สรุปยอด' })
  await expect(totals.getByText('ยอดขายสุทธิ')).toBeVisible()
  await expect(page.getByRole('table', { name: 'ตามวัน' }).getByRole('row')).toHaveCount(31)
  await shot(page, '16-reports')

  await page.getByRole('button', { name: 'ตามสินค้า' }).click()
  await expect(
    page
      .getByRole('table', { name: 'ตามสินค้า' })
      .getByText(/สินค้า E2E/)
      .first(),
  ).toBeVisible()
  // Every bill of this run was sold with its cost on it, so the profit covers them all.
  await expect(totals.getByText('กำไรขั้นต้น')).toBeVisible()
  await expect(page.getByText(/ก่อนระบบเริ่มเก็บต้นทุน/)).toHaveCount(0)
  await expect(
    page.getByRole('table', { name: 'ตามสินค้า' }).getByRole('columnheader', { name: 'ต้นทุน' }),
  ).toBeVisible()
  await shot(page, '16a-reports-items')
  await page.getByRole('button', { name: 'ตามพนักงาน' }).click()
  // Every bill of this run was sold by the signed-in owner, so nobody is "not recorded".
  const cashiers = page.getByRole('table', { name: 'ตามพนักงาน' })
  await expect(cashiers.getByRole('row')).toHaveCount(2)
  await expect(cashiers.getByText('ไม่ระบุ')).toHaveCount(0)
  await shot(page, '16b-reports-cashier')

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ดาวน์โหลด .xlsx' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^sales-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.xlsx$/)
  // An .xlsx file is a zip: it starts with "PK".
  const file = readFileSync(await download.path())
  expect(file.subarray(0, 2).toString()).toBe('PK')
  expect(file.length).toBeGreaterThan(2000)
})

test('explains a refusal of the server in Thai', async ({ page }) => {
  await signIn(page)
  const item = await addItem(page, { price: '10', quantity: '1' })
  const sku = `E2E-${item.barcode.slice(2)}`

  // The same SKU again: the server refuses, and names the error for the app to translate.
  await page.getByRole('button', { name: 'เพิ่มสินค้า' }).click()
  const dialog = page.getByRole('dialog', { name: 'เพิ่มสินค้า' })
  await dialog.getByLabel('ชื่อสินค้า').fill('สินค้าซ้ำ')
  await dialog.getByLabel('SKU').fill(sku)
  await dialog.getByLabel('ราคาขาย').fill('10')
  await dialog.getByLabel('ต้นทุน').fill('1')
  await dialog.getByLabel('คงเหลือ').fill('1')
  await dialog.getByLabel('จุดสั่งซื้อ').fill('0')
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText(`มี SKU ${sku} อยู่แล้ว`)).toBeVisible()
  await shot(page, '17-error-thai')
})

test('imports items from a file, after showing what is wrong with a bad one', async ({ page }) => {
  await signIn(page)
  const id = `${Date.now()}`.slice(-8)
  await page.getByRole('link', { name: 'สินค้าคงคลัง' }).click()
  await page.getByRole('button', { name: 'นำเข้าจากไฟล์' }).click()
  const dialog = page.getByRole('dialog', { name: 'นำเข้าสินค้าจากไฟล์' })
  const csv = (text: string) => ({
    name: 'items.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(text),
  })

  // A row without a name and with a price that is not a number: nothing can be saved.
  await dialog
    .getByLabel('ไฟล์สินค้า')
    .setInputFiles(csv(`SKU,ชื่อสินค้า,ราคาขาย\nIMP-${id}-1,ของดี,10\nIMP-${id}-2,,สิบบาท\n`))
  await expect(dialog.getByText(/พบ 2 ข้อผิดพลาด/)).toBeVisible()
  const errors = dialog.getByRole('table', { name: 'ข้อผิดพลาดในไฟล์' })
  await expect(errors.getByText('ต้องกรอก ชื่อสินค้า')).toBeVisible()
  await expect(errors.getByText('ราคาขาย ต้องเป็นตัวเลขที่ไม่ติดลบ')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'นำเข้า', exact: true })).toBeDisabled()
  await shot(page, '18-import-errors')

  // The corrected file: checked, then saved by the button.
  await dialog
    .getByLabel('ไฟล์สินค้า')
    .setInputFiles(
      csv(
        `SKU,ชื่อสินค้า,หมวดหมู่,ราคาขาย,ต้นทุน,คงเหลือ\nIMP-${id}-1,นำเข้า ${id} ก,ของแห้ง,10,6,5\nIMP-${id}-2,นำเข้า ${id} ข,ของแห้ง,"1,250.50",900,2\n`,
      ),
    )
  await expect(dialog.getByText(/ตรวจแล้วไม่พบข้อผิดพลาด/)).toBeVisible()
  await shot(page, '18b-import-ready')
  await dialog.getByRole('button', { name: 'นำเข้า 2 รายการ' }).click()
  await expect(page.getByText('นำเข้าแล้ว: สินค้าใหม่ 2 รายการ แก้ไข 0 รายการ')).toBeVisible()
  await expect(dialog).toBeHidden()

  await page.getByRole('searchbox', { name: 'ค้นหา', exact: true }).fill(`นำเข้า ${id}`)
  const row = page.getByRole('row', { name: new RegExp(`นำเข้า ${id} ข`) })
  await expect(row.getByText('฿1,250.50')).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(`นำเข้า ${id}`) })).toHaveCount(2)
})

test('gives an item a picture, which the till then shows', async ({ page }) => {
  await signIn(page)
  const item = await addItem(page, { price: '45', quantity: '3' })
  await page.getByRole('searchbox', { name: 'ค้นหา', exact: true }).fill(item.name)
  await page.getByRole('button', { name: `แก้ไข ${item.name}` }).click()
  const dialog = page.getByRole('dialog', { name: 'แก้ไขสินค้า' })

  // A real picture, larger than the app keeps: 1600 x 1200, drawn here.
  const big = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 1200
    const context = canvas.getContext('2d')!
    context.fillStyle = '#2563eb'
    context.fillRect(0, 0, 1600, 1200)
    context.fillStyle = '#ffffff'
    context.fillRect(400, 300, 800, 600)
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png'),
    )
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await dialog
    .getByLabel('รูปสินค้า')
    .setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(big) })
  await expect(dialog.getByRole('img')).toBeVisible()
  await shot(page, '19-item-picture')
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('บันทึกสินค้าแล้ว')).toBeVisible()

  // The list shows it. It was made smaller and turned into a JPEG before it was sent.
  const thumbnail = page.getByRole('row', { name: new RegExp(item.name) }).locator('img')
  await expect(thumbnail).toHaveAttribute('src', /^\/api\/images\/[0-9a-f-]+\/[0-9a-f]{32}\.jpg$/)
  const size = await thumbnail.evaluate(async (img: HTMLImageElement) => {
    await img.decode()
    return [img.naturalWidth, img.naturalHeight]
  })
  expect(size).toEqual([800, 600])

  // The till shows the same picture on the item's card.
  await page.getByRole('link', { name: 'ขายหน้าร้าน' }).click()
  const search = page.getByLabel('ค้นหาสินค้า')
  await search.fill(item.name)
  await search.press('Enter')
  const card = page.getByRole('button', { name: new RegExp(item.name) }).first()
  await expect(card.locator('img')).toHaveAttribute('src', /\.jpg$/)
  await shot(page, '19b-pos-picture')

  // The picture has been shown once, so the device keeps it: the till still has it offline.
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await search.fill(item.name)
  await search.press('Enter')
  await expect(card.locator('img')).toHaveAttribute('src', /.jpg$/)
  await page.context().setOffline(true)
  try {
    await page.reload()
    await page.getByLabel('ค้นหาสินค้า').fill(item.name)
    await page.getByLabel('ค้นหาสินค้า').press('Enter')
    const offlineCard = page.getByRole('button', { name: new RegExp(item.name) }).first()
    const shown = await offlineCard.locator('img').evaluate(async (img: HTMLImageElement) => {
      await img.decode()
      return img.naturalWidth
    })
    expect(shown).toBe(800)
  } finally {
    await page.context().setOffline(false)
  }
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

test('adds a cashier who signs in, changes their password, and is later deactivated', async ({
  page,
  browser,
}) => {
  const id = `${Date.now()}`.slice(-8)
  const staff = { name: `พนักงาน E2E ${id}`, email: `e2e-${id}@e2e.test` }
  const firstPassword = `First-${id}-pass`
  const ownPassword = `Own-${id}-pass`

  await signIn(page)
  await page.getByRole('link', { name: 'ผู้ใช้งาน' }).click()
  await page.getByRole('button', { name: 'เพิ่มผู้ใช้' }).click()
  const form = page.getByRole('dialog', { name: 'เพิ่มผู้ใช้' })
  await form.getByLabel('ชื่อ', { exact: true }).fill(staff.name)
  await form.getByLabel('อีเมล').fill(staff.email)
  await form.getByLabel('สิทธิ์').selectOption('Cashier')
  await form.getByLabel('รหัสผ่านเริ่มต้น').fill(firstPassword)
  await form.getByRole('button', { name: 'บันทึก' }).click()
  await expect(page.getByText('บันทึกผู้ใช้แล้ว')).toBeVisible()
  const row = page.getByRole('row', { name: new RegExp(staff.name) })
  await expect(row.getByText('แคชเชียร์')).toBeVisible()
  await shot(page, '10-users')

  // The cashier, on their own device.
  const device = await browser.newContext({ locale: 'th-TH' })
  const till = await device.newPage()
  const signInAsStaff = async (password: string) => {
    await till.goto('/')
    await till.getByLabel('รหัสร้าน (Tenant ID)').fill(account.tenantId)
    await till.getByLabel('อีเมล').fill(staff.email)
    await till.getByLabel('รหัสผ่าน', { exact: true }).fill(password)
    await till.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  }
  await signInAsStaff(firstPassword)
  // A cashier starts at the till and is not offered the management pages.
  await expect(till.getByRole('heading', { name: 'ขายหน้าร้าน', level: 1 })).toBeVisible()
  await expect(till.getByRole('link', { name: 'ผู้ใช้งาน' })).toHaveCount(0)

  await till.getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }).click()
  const change = till.getByRole('dialog', { name: 'เปลี่ยนรหัสผ่าน' })
  await change.getByLabel('รหัสผ่านปัจจุบัน').fill('not-the-password')
  await change.getByLabel('รหัสผ่านใหม่', { exact: true }).fill(ownPassword)
  await change.getByLabel('ยืนยันรหัสผ่านใหม่').fill(ownPassword)
  await change.getByRole('button', { name: 'บันทึก' }).click()
  await expect(change.getByText('รหัสผ่านปัจจุบันไม่ถูกต้อง')).toBeVisible()
  await change.getByLabel('รหัสผ่านปัจจุบัน').fill(firstPassword)
  await change.getByRole('button', { name: 'บันทึก' }).click()
  await expect(till.getByText('เปลี่ยนรหัสผ่านแล้ว')).toBeVisible()

  // Still signed in on this device after the change, and the new password works.
  await till.reload()
  await expect(till.getByRole('heading', { name: 'ขายหน้าร้าน', level: 1 })).toBeVisible()
  await till.getByRole('button', { name: 'ออกจากระบบ' }).click()
  // Wait for the sign-out to finish; navigating away earlier would cancel it.
  await expect(till.getByRole('form', { name: 'เข้าสู่ระบบ' })).toBeVisible()
  await signInAsStaff(ownPassword)
  await expect(till.getByRole('heading', { name: 'ขายหน้าร้าน', level: 1 })).toBeVisible()

  // The owner deactivates them: their open session ends and they cannot come back.
  await row.getByRole('button', { name: `ปิดการใช้งาน ${staff.name}` }).click()
  await page
    .getByRole('dialog', { name: 'ปิดการใช้งาน' })
    .getByRole('button', { name: 'ปิดการใช้งาน' })
    .click()
  await expect(row.getByText('ปิดการใช้งาน', { exact: true })).toBeVisible()

  await till.reload()
  await expect(till.getByRole('form', { name: 'เข้าสู่ระบบ' })).toBeVisible()
  await signInAsStaff(ownPassword)
  await expect(till.getByText('รหัสร้าน อีเมล หรือรหัสผ่านไม่ถูกต้อง')).toBeVisible()
  await device.close()
})

test('shows a stock correction in the change history', async ({ page }) => {
  await signIn(page)
  const item = await addItem(page, { price: '15', quantity: '4' })
  // The list is paged: look the item up instead of counting on it being on the first page.
  await page.getByRole('searchbox', { name: 'ค้นหา', exact: true }).fill(item.name)
  await page.getByRole('button', { name: `แก้ไข ${item.name}` }).click()
  const dialog = page.getByRole('dialog', { name: 'แก้ไขสินค้า' })
  await dialog.getByLabel('คงเหลือ').fill('9')
  await dialog.getByRole('button', { name: 'บันทึก' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('link', { name: 'ประวัติการแก้ไข' }).click()
  // Newest first: the correction, then the creation of the item.
  const rows = page.getByRole('row', { name: new RegExp(item.name) })
  await expect(rows).toHaveCount(2)
  await expect(rows.first().getByRole('listitem').filter({ hasText: 'คงเหลือ' })).toHaveText(
    /คงเหลือ\s*4\s*9/,
  )
  await expect(rows.last().getByText('เพิ่ม', { exact: true })).toBeVisible()
  await shot(page, '11-audit')
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
