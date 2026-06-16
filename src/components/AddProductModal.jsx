import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SERIES_CATEGORY } from '../lib/categories'
import { CATEGORY_FAMILY, FAMILY_SPEC_HEADERS } from '../lib/xlsxImport'

const SERIES = Object.keys(SERIES_CATEGORY)
const CORE_NUM = ['kw', 'hp', 'cfm_min', 'cfm_max', 'price_rm', 'cost_rm', 'lead_time_weeks']

// Manual single-product entry (admin). Fields mirror the equipment headers; family-specific
// spec fields appear based on the chosen series.
export default function AddProductModal({ defaultBrand, onClose, onDone }) {
  const [f, setF] = useState({
    brand: defaultBrand || '', model: '', tpl: '', type: '', series: '', air_quality: '', wc_ac: '',
    kw: '', hp: '', cfm_min: '', cfm_max: '', price_rm: '', cost_rm: '', lead_time_weeks: '',
  })
  const [specs, setSpecs] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const category = SERIES_CATEGORY[f.series] || null
  const family = CATEGORY_FAMILY[category]
  const specHeaders = useMemo(() => (family ? FAMILY_SPEC_HEADERS[family] : []), [family])

  async function save(e) {
    e.preventDefault()
    if (!f.model) return alert('Model is required.')
    setBusy(true)
    const row = {
      brand: f.brand || null, model: f.model.trim(), tpl: f.tpl || null, type: f.type || null,
      series: f.series || null, category,
      air_quality: f.air_quality || null, wc_ac: f.wc_ac || null,
      specs: Object.fromEntries(Object.entries(specs).filter(([, v]) => v !== '' && v != null)),
    }
    for (const k of CORE_NUM) row[k] = f[k] === '' ? null : Number(f[k])
    if (row.cost_rm) row.cost_updated_at = new Date().toISOString()
    const { error } = await supabase.from('products').insert(row)
    setBusy(false)
    if (error) return alert(error.message)
    onDone?.(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} className="card w-full max-w-2xl max-h-[88vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Add product</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>

        <div className="text-xs font-semibold text-slate-400 mb-2">GENERAL</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          <Fld label="Brand" value={f.brand} onChange={set('brand')} placeholder={defaultBrand} />
          <Fld label="Model *" value={f.model} onChange={set('model')} />
          <Fld label="TPL / Part no." value={f.tpl} onChange={set('tpl')} />
          <div>
            <label className="label">Series</label>
            <select className="input py-1" value={f.series} onChange={set('series')}>
              <option value="">— select —</option>
              {SERIES.map((s) => <option key={s} value={s}>{s} · {SERIES_CATEGORY[s]}</option>)}
            </select>
          </div>
          <Fld label="Type" value={f.type} onChange={set('type')} />
          <Fld label="Air quality" value={f.air_quality} onChange={set('air_quality')} />
          <Fld label="Cooling (WC/AC)" value={f.wc_ac} onChange={set('wc_ac')} />
          <Fld label="kW" type="number" value={f.kw} onChange={set('kw')} />
          <Fld label="hp" type="number" value={f.hp} onChange={set('hp')} />
          <Fld label="Min CFM" type="number" value={f.cfm_min} onChange={set('cfm_min')} />
          <Fld label="Max CFM" type="number" value={f.cfm_max} onChange={set('cfm_max')} />
          <Fld label="Selling RM" type="number" value={f.price_rm} onChange={set('price_rm')} />
          <Fld label="Cost RM" type="number" value={f.cost_rm} onChange={set('cost_rm')} />
          <Fld label="Lead (wks)" type="number" value={f.lead_time_weeks} onChange={set('lead_time_weeks')} />
        </div>

        {specHeaders.length > 0 && (
          <>
            <div className="text-xs font-semibold text-slate-400 mb-2">{category?.toUpperCase()} SPECS</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {specHeaders.map((h) => (
                <Fld key={h} label={h} value={specs[h] ?? ''} onChange={(e) => setSpecs((s) => ({ ...s, [h]: e.target.value }))} />
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add product'}</button>
        </div>
      </form>
    </div>
  )
}

function Fld({ label, type = 'text', ...props }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input py-1" {...props} />
    </div>
  )
}
