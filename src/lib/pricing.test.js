import { describe, it, expect } from 'vitest'
import { sellingUnit, anchorUnit, lineNet, lineCost, discountPct, quoteTotals } from './pricing'

describe('smart markup', () => {
  const line = { is_custom: false, unit_cost: 100, markup_pct: 20, qty: 1 }

  it('selling = cost / (1 - markup%)', () => {
    expect(sellingUnit(line)).toBeCloseTo(125, 6) // 100 / 0.8
  })
  it('anchor = selling / (1 - markup%)', () => {
    expect(anchorUnit(line)).toBeCloseTo(156.25, 6) // 125 / 0.8
  })
  it('displayed discount equals markup%', () => {
    expect(discountPct(line)).toBe(20)
    // anchor * (1 - disc) == selling
    expect(anchorUnit(line) * (1 - discountPct(line) / 100)).toBeCloseTo(sellingUnit(line), 6)
  })
  it('margin% equals markup% under smart markup', () => {
    const selling = sellingUnit(line)
    expect(((selling - line.unit_cost) / selling) * 100).toBeCloseTo(20, 6)
  })
  it('lineNet scales by qty', () => {
    expect(lineNet({ ...line, qty: 3 })).toBeCloseTo(375, 6)
    expect(lineCost({ ...line, qty: 3 })).toBe(300)
  })
  it('markup 0 => selling equals cost', () => {
    expect(sellingUnit({ ...line, markup_pct: 0 })).toBe(100)
  })
  it('custom line uses direct unit_price, no markup', () => {
    const c = { is_custom: true, unit_price: 500, qty: 2 }
    expect(sellingUnit(c)).toBe(500)
    expect(anchorUnit(c)).toBe(500)
    expect(discountPct(c)).toBe(0)
    expect(lineNet(c)).toBe(1000)
  })
})

describe('quoteTotals', () => {
  it('sums selling, applies tax, and reports cost', () => {
    const items = [
      { is_custom: false, unit_cost: 100, markup_pct: 20, qty: 1 }, // selling 125
      { is_custom: true, unit_price: 75, qty: 2 },                  // selling 150
    ]
    const t = quoteTotals(items, 10)
    expect(t.subtotal).toBeCloseTo(275, 6)
    expect(t.tax).toBeCloseTo(27.5, 6)
    expect(t.total).toBeCloseTo(302.5, 6)
    expect(t.cost).toBe(100) // only the catalog line has cost
  })
})
