import * as XLSX from 'xlsx'
import { SERIES_CATEGORY } from './categories'

// Mirrors scripts/generate_products_sql.py — maps an equipment Excel (same headers)
// into product rows, pulling only each family's spec columns into JSONB `specs`.

const CATEGORY_FAMILY = {
  'Oil free compressor': 'compressor', 'Oil lube compressor': 'compressor',
  'Air Tank': 'tank', 'Air filter': 'filter', 'Dryer': 'dryer',
}

// Spec headers per family (promoted core columns excluded).
const FAMILY_SPEC_HEADERS = {
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
