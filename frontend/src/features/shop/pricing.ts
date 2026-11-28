// The arithmetic of a bill, the same as the backend's OrderPricing (docs/API_REFERENCE.md,
// "ภาษีและส่วนลด"). The server's figures are the ones saved; this is what the till shows before
// the sale, and it must agree with the server to the satang. Everything is done in whole
// satang, because 0.1 + 0.2 is not 0.3 in floating point.

export type VatMode = 'None' | 'Inclusive' | 'Exclusive'

export interface VatSettings {
  vatMode: VatMode
  /** For example 7 for 7%. */
  vatRatePercent: number
}

export interface PricedLine {
  unitPrice: number
  quantity: number
  /** Baht off this line. */
  discount: number
}

/** A discount on the whole bill: so many baht, or a percentage of the items. */
export interface BillDiscount {
  kind: 'amount' | 'percent'
  value: number
}

export interface BillTotals {
  /** The lines at full price. */
  gross: number
  /** What the line discounts take off. */
  lineDiscounts: number
  /** The lines after their own discounts. */
  itemsTotal: number
  billDiscount: number
  /** What the customer's points take off, after the bill discount. */
  pointsDiscount: number
  /** VAT added (exclusive prices) or contained (inclusive prices); 0 without VAT. */
  tax: number
  /** What the customer pays. */
  total: number
}

const toSatang = (baht: number) => Math.round(baht * 100)
const toBaht = (satang: number) => satang / 100

/** numerator / denominator, rounded half up, without leaving whole numbers. */
function divideHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator))
}

/** The discount a line really gets: never negative, never more than the line is worth. */
export function lineDiscountOf(line: PricedLine): number {
  const gross = toSatang(line.unitPrice) * line.quantity
  return toBaht(Math.min(Math.max(0, toSatang(line.discount)), gross))
}

export function lineSubtotal(line: PricedLine): number {
  return toBaht(toSatang(line.unitPrice) * line.quantity - toSatang(lineDiscountOf(line)))
}

export function billTotals(
  lines: readonly PricedLine[],
  billDiscount: BillDiscount,
  vat: VatSettings,
  /** Baht taken off by the customer's points (see `pointsDiscountOf`). */
  pointsDiscount = 0,
): BillTotals {
  const gross = lines.reduce((sum, line) => sum + toSatang(line.unitPrice) * line.quantity, 0)
  const lineDiscounts = lines.reduce((sum, line) => sum + toSatang(lineDiscountOf(line)), 0)
  const itemsTotal = gross - lineDiscounts

  const asked =
    billDiscount.kind === 'percent'
      ? divideHalfUp(itemsTotal * Math.round(billDiscount.value * 100), 10_000)
      : toSatang(billDiscount.value)
  const discount = Math.min(Math.max(0, asked), itemsTotal)
  // Points are a discount like the others, taken last and before tax.
  const points = Math.min(Math.max(0, toSatang(pointsDiscount)), itemsTotal - discount)
  const afterDiscount = itemsTotal - discount - points

  // The rate in hundredths of a percent, so 7.5% stays a whole number too.
  const rate = Math.round(vat.vatRatePercent * 100)
  let tax = 0
  let total = afterDiscount
  if (vat.vatMode === 'Inclusive') {
    tax = divideHalfUp(afterDiscount * rate, 10_000 + rate)
  } else if (vat.vatMode === 'Exclusive') {
    tax = divideHalfUp(afterDiscount * rate, 10_000)
    total = afterDiscount + tax
  }

  return {
    gross: toBaht(gross),
    lineDiscounts: toBaht(lineDiscounts),
    itemsTotal: toBaht(itemsTotal),
    billDiscount: toBaht(discount),
    pointsDiscount: toBaht(points),
    tax: toBaht(tax),
    total: toBaht(total),
  }
}

/** What so many points take off a bill, when one point is worth `pointValueBaht`. */
export function pointsDiscountOf(points: number, pointValueBaht: number): number {
  const whole = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0
  return toBaht(whole * Math.max(0, toSatang(pointValueBaht)))
}

/**
 * The most points a bill can take: no more than the customer has, and the bill must still
 * leave something to pay (the server refuses a bill paid entirely with points).
 * `remaining` is the items after the line and bill discounts.
 */
export function maxRedeemablePoints(
  remaining: number,
  pointValueBaht: number,
  balance: number,
): number {
  const value = toSatang(pointValueBaht)
  if (value <= 0 || balance <= 0) return 0
  const byBill = Math.floor((toSatang(remaining) - 1) / value)
  return Math.max(0, Math.min(Math.floor(balance), byBill))
}

/** One point for every full `bahtPerPoint` paid; none when the scheme is off. */
export function pointsFor(amount: number, bahtPerPoint: number): number {
  return bahtPerPoint > 0 && amount > 0 ? Math.floor(toSatang(amount) / toSatang(bahtPerPoint)) : 0
}
