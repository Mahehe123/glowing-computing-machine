import { categoryOf } from './categories'

export const COMPRESSOR_CATEGORIES = ['Oil free compressor', 'Oil lube compressor']
export const isCompressor = (product) => COMPRESSOR_CATEGORIES.includes(categoryOf(product))

// Clauses printed below each equipment spec table.
export const FAD_CLAUSES = [
  'FAD is according to ISO1217',
  'FAD tolerance is according to ISO1217',
]
export const IMPROVEMENT_CLAUSE =
  'Specification may be updated as we are actively improving our product range'

// FAD clauses only on compressors; improvement clause on everything.
export function clausesFor(product) {
  return isCompressor(product) ? [...FAD_CLAUSES, IMPROVEMENT_CLAUSE] : [IMPROVEMENT_CLAUSE]
}

// Quote shows a range: minimum lead time .. minimum + 2 weeks.
export function leadRange(weeks) {
  const w = Number(weeks) || 0
  return w ? { min: w, max: w + 2 } : null
}
export const leadText = (weeks) => {
  const r = leadRange(weeks)
  return r ? `${r.min} - ${r.max} weeks` : null
}

// The line item with the longest minimum lead time (drives the front-page note).
export function longestLead(items) {
  let best = null
  items.forEach((it) => {
    const w = Number(it.lead_time_weeks) || 0
    if (w > (best?.weeks || 0)) best = { weeks: w, model: it.model }
  })
  return best && best.weeks ? best : null
}

// Build the GENERAL spec rows shared by the modal, the review, and the PDF.
export function generalSpecRows(product) {
  if (!product) return []
  return [
    ['Series', product.series],
    ['Category', categoryOf(product)],
    ['Air quality', product.air_quality],
    ['Cooling', product.wc_ac],
    ['Power', product.kw ? `${product.kw} kW / ${product.hp} hp` : null],
    ['Capacity (CFM)', product.cfm_max ? `${product.cfm_min ?? ''}${product.cfm_min ? ' – ' : ''}${product.cfm_max}` : null],
    ['Min. lead time', leadText(product.lead_time_weeks)],
  ].filter(([, v]) => v)
}
