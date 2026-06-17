import { categoryOf, isCompressor } from './categories'

export { isCompressor }

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

// Label for a line item: product model, or the custom line's title.
export const itemLabel = (it) => (it?.is_custom ? (it.title || 'Custom item') : (it?.model || ''))

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

const CFM_TO_M3 = 0.0283168
// Flow figures are surfaced by generalSpecRows, so they must not repeat in the detail spec list.
const FLOW_SPEC_KEYS = new Set(['Min m3/min', 'Max m3/min'])
const round2 = (n) => Math.round(n * 100) / 100

// Flow capacity rows. Inverter compressors carry a cfm_min and read as a min–max range
// (CFM and m³/min); fixed-speed units show a single figure.
function flowRows(product) {
  if (product.cfm_max == null || product.cfm_max === '') return []
  const isRange = product.cfm_min != null && product.cfm_min !== ''
  const minM3 = product.specs?.['Min m3/min'] ?? (isRange ? round2(Number(product.cfm_min) * CFM_TO_M3) : null)
  const maxM3 = product.specs?.['Max m3/min'] ?? round2(Number(product.cfm_max) * CFM_TO_M3)
  if (isRange) {
    return [
      ['Minimum to Maximum Flow Capacity, CFM', `${product.cfm_min} to ${product.cfm_max}`],
      minM3 != null && maxM3 != null ? ['Minimum to Maximum Flow Capacity, m³/min', `${minM3} to ${maxM3}`] : null,
    ]
  }
  return [
    ['Flow Capacity, CFM', `${product.cfm_max}`],
    maxM3 != null ? ['Flow Capacity, m³/min', `${maxM3}`] : null,
  ]
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
    ...flowRows(product),
    ['Min. lead time', leadText(product.lead_time_weeks)],
  ].filter((r) => r && r[1])
}

// Detail spec entries for display, excluding flow figures already shown by generalSpecRows.
export function detailSpecEntries(product) {
  return Object.entries(product?.specs || {}).filter(([k]) => !FLOW_SPEC_KEYS.has(k))
}

// Lead-time text for the spec-page header pill (e.g. "6 - 8 weeks").
export const leadPill = (product) =>
  product ? leadText(product.lead_time_weeks) : null

// Ordered specification rows for the quotation technical page, curated per equipment
// family so each spec sheet reads in a consistent, sensible order. Empty fields drop out.
export function equipmentSpecRows(product) {
  if (!product) return []
  const p = product
  const s = p.specs || {}
  const power = p.kw ? `${p.kw} kW / ${p.hp} hp` : null
  const flow = flowRows(p) // [ [cfmLabel, cfm], [m3Label, m3] ] (handles inverter ranges)

  let rows
  switch (categoryOf(p)) {
    case 'Air compressor':
      rows = [
        ['Model', p.model],
        ['Technology', s['Technology']],
        ['Starter Type', s['Starter Type']],
        ['Power', power],
        ['Cooling', p.wc_ac],
        ['Loading Pressure, bar', s['Loading Pressure']],
        ['Unloading Pressure, bar', s['Unload Pressure']],
        ...flow,
        ['Motor Type', s['Motor Type']],
        ['IE Rating', s['IE Rating']],
        ['Power Supply', s['Power Supply']],
        ['Dimension', s['Dimension']],
        ['Weight, KG', s['Weight']],
        ['Outlet Size', s['Outlet size']],
        ['Outlet Air Temperature, °C', s['Outlet air temperature']],
      ]
      break
    case 'Dryer':
      rows = [
        ['Model', p.model],
        ['Power', power],
        ['Cooling', p.wc_ac],
        ['Max Working Pressure, bar', s['Max working pressure']],
        ...flow,
        ['Power Supply', s['Power Supply']],
        ['Noise Level, dB', s['Noise level']],
        ['Dimension', s['Dimension']],
        ['Weight, KG', s['Weight']],
        ['Outlet Size', s['Outlet size']],
      ]
      break
    case 'Filter':
      rows = [
        ['Model', p.model],
        ['Flow Capacity, CFM', s['filter, cfm']],
        ['Flow Capacity, m³/min', s['Filter, m3/min']],
        ['Particle Removal, micron', s['Particle removal']],
        ['Oil Carry Over, ppm', s['filter oil carry over']],
        ['Dimension', s['Dimension']],
        ['Weight, KG', s['Weight']],
        ['Outlet Size', s['Outlet size']],
      ]
      break
    case 'Air receiver tank':
      rows = [
        ['Model', p.model],
        ['Volume, L', s['tank volume']],
        ['Working Pressure, bar', s['tank pressure']],
        ['Material', s['Air tank Material']],
        ['Dimension', s['Dimension']],
        ['Weight, KG', s['Weight']],
        ['Outlet Size', s['Outlet size']],
      ]
      break
    default:
      rows = [['Model', p.model], ['Power', power], ...flow, ...Object.entries(s)]
  }
  return rows.filter(([, v]) => v != null && v !== '')
}
