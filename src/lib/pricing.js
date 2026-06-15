// Central pricing logic — used by the quote editor, PDF, and totals.
// A line carries: unit_price (snapshot from catalog), qty, adjust_type, adjust_pct.

export function lineNet(item) {
  const base = (Number(item.unit_price) || 0) * (Number(item.qty) || 0)
  const p = Number(item.adjust_pct) || 0
  if (item.adjust_type === 'markup') return base * (1 + p / 100)
  if (item.adjust_type === 'discount') return base * (1 - p / 100)
  return base
}

export function lineGross(item) {
  return (Number(item.unit_price) || 0) * (Number(item.qty) || 0)
}

// Returns the effective per-unit price after the line adjustment.
export function lineUnitNet(item) {
  const qty = Number(item.qty) || 0
  return qty ? lineNet(item) / qty : 0
}

export function quoteTotals(items, quoteDiscountPct = 0, taxPct = 0) {
  const subtotal = items.reduce((s, it) => s + lineNet(it), 0)
  const quoteDiscount = subtotal * ((Number(quoteDiscountPct) || 0) / 100)
  const afterDiscount = subtotal - quoteDiscount
  const tax = afterDiscount * ((Number(taxPct) || 0) / 100)
  const total = afterDiscount + tax
  // Total list value (before any adjustment) — for discount-leakage analytics.
  const listValue = items.reduce((s, it) => s + lineGross(it), 0)
  return { listValue, subtotal, quoteDiscount, afterDiscount, tax, total }
}
