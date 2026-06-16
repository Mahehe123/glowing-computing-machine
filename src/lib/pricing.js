// Smart-markup pricing.
// Catalog lines are priced from COST + a markup %:
//   selling = cost / (1 - markup%)        ← the price the customer actually pays
//   anchor  = selling / (1 - markup%)     ← inflated "list" price shown struck-through
//   the displayed discount = markup%      (anchor − markup% = selling)
// Custom lines (services / M&E) carry a direct selling price, no markup.

const clampM = (m) => Math.min(Math.max(Number(m) || 0, 0), 95)

export function sellingUnit(it) {
  if (it.is_custom) return Number(it.unit_price) || 0
  const m = clampM(it.markup_pct)
  return (Number(it.unit_cost) || 0) / (1 - m / 100)
}
export function anchorUnit(it) {
  if (it.is_custom) return sellingUnit(it)
  const m = clampM(it.markup_pct)
  return sellingUnit(it) / (1 - m / 100)
}
export const lineNet = (it) => sellingUnit(it) * (Number(it.qty) || 0)      // selling subtotal
export const lineAnchor = (it) => anchorUnit(it) * (Number(it.qty) || 0)    // struck-through subtotal
export const lineCost = (it) => (Number(it.unit_cost) || 0) * (Number(it.qty) || 0)
export const discountPct = (it) => (it.is_custom ? 0 : clampM(it.markup_pct))

export function quoteTotals(items, taxPct = 0) {
  const subtotal = items.reduce((s, it) => s + lineNet(it), 0)
  const tax = subtotal * ((Number(taxPct) || 0) / 100)
  const anchorTotal = items.reduce((s, it) => s + lineAnchor(it), 0)
  const cost = items.reduce((s, it) => s + lineCost(it), 0)
  return { subtotal, tax, total: subtotal + tax, anchorTotal, cost }
}
