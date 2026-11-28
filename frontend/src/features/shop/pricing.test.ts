import {
  billTotals,
  lineDiscountOf,
  lineSubtotal,
  maxRedeemablePoints,
  pointsDiscountOf,
  pointsFor,
  type PricedLine,
} from './pricing'

// The same figures as the backend's OrderPricingTests and ShopSettingsApiTests: the till and
// the server must agree to the satang.

/** The worked cart of the tax rules: items total 353.50 after a line discount of 10. */
const cart: PricedLine[] = [
  { unitPrice: 59, quantity: 2, discount: 10 },
  { unitPrice: 199, quantity: 1, discount: 0 },
  { unitPrice: 15.5, quantity: 3, discount: 0 },
]
const fivePercent = { kind: 'percent', value: 5 } as const
const none = { kind: 'amount', value: 0 } as const
const vat = (vatMode: 'None' | 'Inclusive' | 'Exclusive', vatRatePercent = 7) => ({
  vatMode,
  vatRatePercent,
})

describe('bill totals', () => {
  it('takes the discounts off before the tax, for prices that include VAT', () => {
    expect(billTotals(cart, fivePercent, vat('Inclusive'))).toEqual({
      gross: 363.5,
      lineDiscounts: 10,
      itemsTotal: 353.5,
      billDiscount: 17.68, // 5% of 353.50 = 17.675, half up
      pointsDiscount: 0,
      tax: 21.97, // 335.82 × 7/107 = 21.9695
      total: 335.82,
    })
  })

  it('adds the tax on top for prices before VAT', () => {
    const totals = billTotals(cart, fivePercent, vat('Exclusive'))
    expect(totals.tax).toBe(23.51) // 335.82 × 7% = 23.5074
    expect(totals.total).toBe(359.33)
  })

  it('charges no tax in a shop without VAT', () => {
    const totals = billTotals(cart, fivePercent, vat('None'))
    expect(totals.tax).toBe(0)
    expect(totals.total).toBe(335.82)
  })

  it('works the tax out once per bill, not per line', () => {
    const three = [{ unitPrice: 10, quantity: 3, discount: 0 }]
    // Per line it would be 3 × 0.65 = 1.95.
    expect(billTotals(three, none, vat('Inclusive')).tax).toBe(1.96)
    expect(
      billTotals([{ unitPrice: 100, quantity: 1, discount: 0 }], none, vat('Inclusive')),
    ).toMatchObject({ tax: 6.54, total: 100 })
  })

  it('agrees with the server on amounts that floating point gets wrong', () => {
    const lines = [
      { unitPrice: 19.99, quantity: 3, discount: 0 },
      { unitPrice: 0.1, quantity: 3, discount: 0 },
    ]
    expect(billTotals(lines, none, vat('Exclusive'))).toMatchObject({
      itemsTotal: 60.27,
      tax: 4.22, // 4.2189
      total: 64.49,
    })
    // 0.50 × 7% = 0.035: half goes up.
    expect(
      billTotals([{ unitPrice: 0.5, quantity: 1, discount: 0 }], none, vat('Exclusive')).tax,
    ).toBe(0.04)
  })

  it('never lets a discount exceed what it applies to, or go below zero', () => {
    const line = { unitPrice: 50, quantity: 2, discount: 500 }
    expect(lineDiscountOf(line)).toBe(100)
    expect(lineSubtotal(line)).toBe(0)
    expect(lineDiscountOf({ ...line, discount: -5 })).toBe(0)

    const lines = [{ unitPrice: 50, quantity: 2, discount: 10 }]
    expect(billTotals(lines, { kind: 'amount', value: 1000 }, vat('Inclusive'))).toMatchObject({
      billDiscount: 90,
      tax: 0,
      total: 0,
    })
    expect(billTotals(lines, { kind: 'percent', value: 150 }, vat('None')).total).toBe(0)
    expect(billTotals(lines, { kind: 'amount', value: -20 }, vat('None')).total).toBe(90)
  })

  it('uses the rate it is given', () => {
    const lines = [{ unitPrice: 110, quantity: 1, discount: 0 }]
    expect(billTotals(lines, none, vat('Inclusive', 10)).tax).toBe(10)
    expect(billTotals(lines, none, vat('Exclusive', 7.5)).tax).toBe(8.25)
  })
})

describe('points', () => {
  it('gives one point per full step of spend, never a fraction', () => {
    expect(pointsFor(335.82, 25)).toBe(13)
    expect(pointsFor(25, 25)).toBe(1)
    expect(pointsFor(24.99, 25)).toBe(0)
    expect(pointsFor(0, 25)).toBe(0)
  })

  it('gives none when the scheme is off', () => {
    expect(pointsFor(1000, 0)).toBe(0)
  })

  it('takes points off after the other discounts and before tax', () => {
    const lines = [{ unitPrice: 500, quantity: 1, discount: 0 }]
    // 100 points at 0.50: 450 is paid, and the tax is 7/107 of 450, not of 500.
    const discount = pointsDiscountOf(100, 0.5)
    expect(discount).toBe(50)
    expect(billTotals(lines, none, vat('Inclusive'), discount)).toMatchObject({
      pointsDiscount: 50,
      tax: 29.44,
      total: 450,
    })
    expect(billTotals(lines, none, vat('Exclusive'), discount)).toMatchObject({
      tax: 31.5,
      total: 481.5,
    })
    expect(pointsDiscountOf(2.9, 0.25)).toBe(0.5)
    expect(pointsDiscountOf(-3, 1)).toBe(0)
  })

  it('lets a bill take no more points than the customer has, and leaves something to pay', () => {
    expect(maxRedeemablePoints(95, 10, 20)).toBe(9)
    // 90 baht of points on a 90 baht bill would leave nothing to pay.
    expect(maxRedeemablePoints(90, 10, 20)).toBe(8)
    expect(maxRedeemablePoints(1000, 10, 20)).toBe(20)
    expect(maxRedeemablePoints(10, 0.25, 500)).toBe(39)
    expect(maxRedeemablePoints(100, 0, 500)).toBe(0)
    expect(maxRedeemablePoints(100, 1, -10)).toBe(0)
    expect(maxRedeemablePoints(0, 1, 50)).toBe(0)
  })
})
