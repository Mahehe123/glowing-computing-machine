import * as XLSX from 'xlsx'
import { SERIES_CATEGORY } from './categories'

// Mirrors scripts/generate_products_sql.py — maps an equipment Excel (same headers)
// into product rows, pulling only each family's spec columns into JSONB `specs`.

export const CATEGORY_FAMILY = {
  'Air compressor': 'compressor', 'Air receiver tank': 'tank', 'Filter': 'filter', 'Dryer': 'dryer',
}

// Spec headers per family (promoted core columns excluded).
export const FAMILY_SPEC_HEADERS = {
  compressor: ['Loading Pressure', 'Unload Pressure', 'Min m3/min', 'Max m3/min', 'IE Rating',
    'Motor Type', 'Dimension', 'Outlet size', 'Weight', 'Noise level', 'Power Supply',
    'Outlet air temperature', 'Starter Type', 'Input water flow', 'water pressure', 'Pressure drop'],
  tank: ['tank volume', 'Air tank Material', 'tank pressure', 'tank dimension', 'tank outlet'],
  filter: ['Filter, m3/min', 'filter, cfm', 'filter oil carry over', 'Particle removal',
    'filter dimension', 'filter outlet', 'filter weight'],
  dryer: ['Refrigerant', 'Flow, m3/min', 'Flow, cfm', 'Power Supply', 'Dimension',
    'Outlet size', 'Weight, KG', 'Noise, dB'],
}

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const numOrNull = (v) => { const n = Number(v); return v === null || v === '' || Number.isNaN(n) ? null : n }
const roundMoney = (v) => { const n = Number(v); return v === null || v === '' || Number.isNaN(n) ? null : Math.round(n) }

// Build a normalized header lookup for one row so minor header variations still match.
function rowGetter(row) {
  const map = {}
  for (const k of Object.keys(row)) map[norm(k)] = row[k]
  return (header) => {
    const v = map[norm(header)]
    return v === undefined || v === '' ? null : v
  }
}

// ---- Competitor import (flexible header aliases) ----
const COMP_ALIASES = {
  brand: ['brand', 'make', 'manufacturer'],
  model: ['model', 'model no', 'model number'],
  type: ['type', 'compressor type'],
  loading_pressure: ['working pressure (bar g)', 'working pressure', 'loading pressure', 'pressure (bar)', 'pressure', 'bar'],
  rated_kw: ['rated power (kw)', 'rated power', 'motor power (kw)', 'motor power', 'power kw', 'kw'],
  real_kw: ['real power (kw)', 'real power', 'actual power (kw)', 'actual power', 'input power (kw)', 'package input power'],
  flow_m3min: ['flow (m3/min)', 'flow m3/min', 'capacity (m3/min)', 'capacity', 'fad (m3/min)', 'fad', 'm3/min'],
  flow_cfm: ['flow (cfm)', 'flow cfm', 'cfm', 'capacity (cfm)'],
  noise_db: ['noise level (db(a))', 'noise (db(a))', 'noise level', 'noise', 'db(a)', 'db'],
  dimension: ['dimension', 'dimension (mm)', 'dimensions', 'lxwxh', 'l x w x h', 'size'],
  weight_kg: ['weight (kg)', 'weight kg', 'weight', 'kg'],
  price_rm: ['price (rm)', 'price', 'capex', 'rm/ unit', 'rm/unit', 'cost'],
}

function pick(get, aliases) {
  for (const a of aliases) { const v = get(a); if (v !== null) return v }
  return null
}

export async function parseCompetitorsWorkbook(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })
  const competitors = []
  const errors = []
  rows.forEach((row, i) => {
    const get = rowGetter(row)
    const brand = pick(get, COMP_ALIASES.brand)
    const model = pick(get, COMP_ALIASES.model)
    if (!model) return
    if (!brand) errors.push(`Row ${i + 2}: missing Brand for ${model}`)
    const type = pick(get, COMP_ALIASES.type)
    competitors.push({
      brand: brand ? String(brand).trim() : 'Unknown',
      model: String(model).trim(), type,
      loading_pressure: numOrNull(pick(get, COMP_ALIASES.loading_pressure)),
      rated_kw: numOrNull(pick(get, COMP_ALIASES.rated_kw)),
      real_kw: numOrNull(pick(get, COMP_ALIASES.real_kw)),
      flow_m3min: numOrNull(pick(get, COMP_ALIASES.flow_m3min)),
      flow_cfm: numOrNull(pick(get, COMP_ALIASES.flow_cfm)),
      noise_db: numOrNull(pick(get, COMP_ALIASES.noise_db)),
      dimension: pick(get, COMP_ALIASES.dimension),
      weight_kg: numOrNull(pick(get, COMP_ALIASES.weight_kg)),
      price_rm: roundMoney(pick(get, COMP_ALIASES.price_rm)) || 0,
      is_inverter: /inverter|vfd|vsd|variable/i.test(type || ''),
    })
  })
  return { competitors, errors }
}

export async function parseProductsWorkbook(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets['Product'] || wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null })

  const products = []
  const errors = []
  rows.forEach((row, i) => {
    const get = rowGetter(row)
    const model = get('Model')
    if (!model) return
    const series = get('Series')
    const category = SERIES_CATEGORY[series] || series || null
    const family = CATEGORY_FAMILY[category]

    const specs = {}
    if (family) {
      for (const h of FAMILY_SPEC_HEADERS[family]) {
        const v = get(h)
        if (v !== null) specs[h] = v
      }
    } else {
      errors.push(`Row ${i + 2}: unknown series "${series}" for ${model} — imported without specs`)
    }

    products.push({
      model: String(model).trim(),
      tpl: get('TPL'), type: get('Type'), series, category,
      air_quality: get('Air Quality'), wc_ac: get('WC/AC'),
      kw: numOrNull(get('kW')), hp: numOrNull(get('hp')),
      cfm_min: numOrNull(get('Min CFM')), cfm_max: numOrNull(get('Max CFM')),
      price_rm: roundMoney(get('RM/ Unit')),
      specs,
    })
  })
  return { products, errors }
}
