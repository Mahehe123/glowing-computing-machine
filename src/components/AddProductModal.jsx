import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EQUIPMENT_TYPES } from '../lib/categories'

const STARTERS = ['Star delta', 'Inverter', 'DOL']
const COOLING = ['Air Cooled', 'Water Cooled']
const EQUIPMENT = Object.keys(EQUIPMENT_TYPES)
const hasPower = (eq) => eq === 'Air compressor' || eq === 'Dryer'  // cooling/kW/power supply
const hasFlow = (eq) => eq === 'Air compressor' || eq === 'Dryer' || eq === 'Filter' // Max CFM

// Manual single-product entry (admin), dynamic by equipment type. Cost-only (selling via smart markup).
export default function AddProductModal({ defaultBrand, onClose, onDone }) {
  const [f, setF] = useState({
    brand: defaultBrand || '', model: '', tpl: '', equipment: '', type: '', starter: '', cooling: '',
    kw: '', cfm_min: '', cfm_max: '', power_supply: '', cost_rm: '', lead_time_weeks: '',
    water_flow: '', water_pressure: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  const typeOptions = f.equipment ? EQUIPMENT_TYPES[f.equipment] : []
  const hp = f.kw ? (Number(f.kw) * 1.341).toFixed(1) : ''
  const showCooling = hasPower(f.equipment)
  const showKw = hasPower(f.equipment)
  const showMinCfm = f.equipment === 'Air compressor' && f.starter === 'Inverter'
  const showMaxCfm = hasFlow(f.equipment)
  const showWater = f.cooling === 'Water Cooled'

  const num = (v) => (v === '' ? null : Number(v))

  async function save(e) {
    e.preventDefault()
    if (!f.model) return alert('Model is required.')
    if (!f.equipment) return alert('Equipment is required.')
    if (showKw && !f.kw) return alert('kW is required for compressors and dryers.')
    setBusy(true)
    const specs = {}
    if (f.starter) specs['Starter Type'] = f.starter
    if (f.power_supply) specs['Power Supply'] = f.power_supply
    if (showWater && f.water_flow) specs['Input water flow'] = num(f.water_flow)
    if (showWater && f.water_pressure) specs['water pressure'] = num(f.water_pressure)

    const row = {
      brand: f.brand || null, model: f.model.trim(), tpl: f.tpl || null,
      category: f.equipment, type: f.type || null, series: null,
      wc_ac: showCooling ? (f.cooling || null) : null,
      kw: showKw ? num(f.kw) : null, hp: showKw && f.kw ? Number(hp) : null,
      cfm_min: showMinCfm ? num(f.cfm_min) : null,
      cfm_max: showMaxCfm ? num(f.cfm_max) : null,
      cost_rm: num(f.cost_rm), lead_time_weeks: num(f.lead_time_weeks),
      price_rm: 0, specs,
    }
    if (row.cost_rm) row.cost_updated_at = new Date().toISOString()
    const { error } = await supabase.from('products').insert(row)
    setBusy(false)
    if (error) return alert(error.message)
    onDone?.(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} className="card w-full max-w-2xl max-h-[88vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Add product</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Fld label="Brand" value={f.brand} onChange={set('brand')} placeholder={defaultBrand} />
          <Fld label="Model *" value={f.model} onChange={set('model')} />
          <Fld label="Part No." value={f.tpl} onChange={set('tpl')} />

          <Sel label="Equipment *" value={f.equipment} onChange={(e) => setF((s) => ({ ...s, equipment: e.target.value, type: '' }))} options={EQUIPMENT} />
          <Sel label="Type" value={f.type} onChange={set('type')} options={typeOptions} disabled={!f.equipment} />
          <Sel label="Starter type" value={f.starter} onChange={set('starter')} options={STARTERS} />

          {showCooling && <Sel label="Cooling *" value={f.cooling} onChange={set('cooling')} options={COOLING} />}
          {showKw && <Fld label="kW *" type="number" value={f.kw} onChange={set('kw')} />}
          {showKw && <Fld label="hp (auto)" value={hp} readOnly />}

          {showMinCfm && <Fld label="Min CFM" type="number" value={f.cfm_min} onChange={set('cfm_min')} />}
          {showMaxCfm && <Fld label="Max CFM" type="number" value={f.cfm_max} onChange={set('cfm_max')} />}
          {showCooling && <Fld label="Power Supply" value={f.power_supply} onChange={set('power_supply')} placeholder="400v/3ph/50hz" />}

          {showWater && <Fld label="Cooling water flow" type="number" value={f.water_flow} onChange={set('water_flow')} />}
          {showWater && <Fld label="Cooling water pressure" type="number" value={f.water_pressure} onChange={set('water_pressure')} />}

          <Fld label="Cost RM" type="number" value={f.cost_rm} onChange={set('cost_rm')} />
          <Fld label="Lead (weeks)" type="number" value={f.lead_time_weeks} onChange={set('lead_time_weeks')} />
        </div>

        <p className="text-xs text-slate-400 mt-3">Selling price is derived from cost + smart markup at quote time — no selling price needed here.</p>

        <div className="flex justify-end gap-2 mt-4">
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
function Sel({ label, options, ...props }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input py-1" {...props}>
        <option value="">— select —</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
