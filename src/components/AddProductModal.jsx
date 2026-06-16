import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { EQUIPMENT_TYPES } from '../lib/categories'

const STARTERS = ['Star delta', 'Inverter', 'DOL']
const COOLING = ['Air Cooled', 'Water Cooled']
const EQUIPMENT = Object.keys(EQUIPMENT_TYPES)
const TECH_BY_TYPE = { 'Oil Lubricated': ['Oil lubricated'], 'Oil-Free': ['Water lubricated', 'Dry Screw'] }
const CFM_TO_M3 = 0.0283168

const EMPTY = {
  brand: '', model: '', tpl: '', equipment: '', type: '', starter: '', cooling: '',
  kw: '', real_kw: '', cfm_min: '', cfm_max: '', filter_cfm: '',
  loading_pressure: '', unload_pressure: '', max_working_pressure: '',
  ie_rating: '', motor_type: '', noise: '', outlet: '', outlet_air_temp: '', technology: '',
  particle_removal: '', oil_carryover: '', weight: '', dimension: '',
  tank_volume: '', tank_pressure: '', tank_material: '',
  power_supply: '', cost_rm: '', lead_time_weeks: '', water_flow: '', water_pressure: '',
}

export default function AddProductModal({ defaultBrand, onClose, onDone }) {
  const [f, setF] = useState({ ...EMPTY, brand: defaultBrand || '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const num = (v) => (v === '' ? null : Number(v))

  const eq = f.equipment
  const isComp = eq === 'Air compressor', isDryer = eq === 'Dryer', isFilter = eq === 'Filter', isTank = eq === 'Air receiver tank'
  const powered = isComp || isDryer
  const showMinCfm = isComp && f.starter === 'Inverter'
  const showWater = (powered) && f.cooling === 'Water Cooled'
  const hp = f.kw ? (Number(f.kw) * 1.341).toFixed(1) : ''
  const flowM3 = f.cfm_max ? (Number(f.cfm_max) * CFM_TO_M3).toFixed(2) : ''
  const filterM3 = f.filter_cfm ? (Number(f.filter_cfm) * CFM_TO_M3).toFixed(2) : ''
  const techOptions = TECH_BY_TYPE[f.type] || []

  async function save(e) {
    e.preventDefault()
    if (!f.model) return alert('Model is required.')
    if (!eq) return alert('Equipment is required.')
    if (powered && !f.kw) return alert('kW is required for compressors and dryers.')
    setBusy(true)

    const specs = {}
    const put = (k, v) => { if (v !== '' && v != null) specs[k] = v }
    // shared
    put('Weight', num(f.weight)); put('Dimension', f.dimension); put('Outlet size', f.outlet)
    if (powered) { put('Power Supply', f.power_supply); put('Noise level', num(f.noise)) }
    if (isComp) {
      put('IE Rating', f.ie_rating); put('Motor Type', f.motor_type)
      put('Loading Pressure', num(f.loading_pressure)); put('Unload Pressure', num(f.unload_pressure))
      put('Outlet air temperature', f.outlet_air_temp); put('Technology', f.technology)
    }
    if (isDryer) put('Max working pressure', num(f.max_working_pressure))
    if (isComp || isDryer) put('Max m3/min', flowM3 ? Number(flowM3) : null)
    if (isFilter) {
      put('filter, cfm', num(f.filter_cfm)); put('Filter, m3/min', filterM3 ? Number(filterM3) : null)
      put('Particle removal', num(f.particle_removal)); put('filter oil carry over', num(f.oil_carryover))
    }
    if (isTank) { put('tank volume', num(f.tank_volume)); put('tank pressure', num(f.tank_pressure)); put('Air tank Material', f.tank_material) }
    if (showWater) { put('Input water flow', num(f.water_flow)); put('water pressure', num(f.water_pressure)) }
    if (f.starter) put('Starter Type', f.starter)

    const row = {
      brand: f.brand || null, model: f.model.trim(), tpl: f.tpl || null,
      category: eq, type: f.type || null, series: null,
      wc_ac: powered ? (f.cooling || null) : null,
      kw: powered ? num(f.kw) : null, hp: powered && f.kw ? Number(hp) : null,
      real_kw: powered ? num(f.real_kw) : null,
      cfm_min: showMinCfm ? num(f.cfm_min) : null,
      cfm_max: powered ? num(f.cfm_max) : null,
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
      <form onSubmit={save} className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Add product</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>

        <Section title="General">
          <Fld label="Brand" value={f.brand} onChange={set('brand')} placeholder={defaultBrand} />
          <Fld label="Model *" value={f.model} onChange={set('model')} />
          <Fld label="Part No." value={f.tpl} onChange={set('tpl')} />
          <Sel label="Equipment *" value={eq} onChange={(e) => setF((s) => ({ ...s, equipment: e.target.value, type: '', technology: '' }))} options={EQUIPMENT} />
          <Sel label="Type" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value, technology: '' }))} options={eq ? EQUIPMENT_TYPES[eq] : []} disabled={!eq} />
          {isComp && <Sel label="Technology" value={f.technology} onChange={set('technology')} options={techOptions} disabled={!f.type} />}
          <Sel label="Starter type" value={f.starter} onChange={set('starter')} options={STARTERS} />
        </Section>

        {powered && (
          <Section title="Power & cooling">
            <Sel label="Cooling *" value={f.cooling} onChange={set('cooling')} options={COOLING} />
            <Fld label="kW *" type="number" value={f.kw} onChange={set('kw')} />
            <Fld label="hp (auto)" value={hp} readOnly />
            {isComp && <Fld label="Real / input kW" type="number" value={f.real_kw} onChange={set('real_kw')} />}
            <Fld label="Power Supply" value={f.power_supply} onChange={set('power_supply')} placeholder="400v/3ph/50hz" />
            {showWater && <Fld label="Cooling water flow" type="number" value={f.water_flow} onChange={set('water_flow')} />}
            {showWater && <Fld label="Cooling water pressure" type="number" value={f.water_pressure} onChange={set('water_pressure')} />}
          </Section>
        )}

        {(powered || isFilter) && (
          <Section title="Flow & pressure">
            {showMinCfm && <Fld label="Min CFM" type="number" value={f.cfm_min} onChange={set('cfm_min')} />}
            {powered && <Fld label="Flow Capacity, CFM" type="number" value={f.cfm_max} onChange={set('cfm_max')} />}
            {powered && <Fld label="Flow Capacity, m³/min (auto)" value={flowM3} readOnly />}
            {isFilter && <Fld label="Filter flow rate, CFM" type="number" value={f.filter_cfm} onChange={set('filter_cfm')} />}
            {isFilter && <Fld label="Filter flow rate, m³/min (auto)" value={filterM3} readOnly />}
            {isComp && <Fld label="Loading Pressure, bar" type="number" value={f.loading_pressure} onChange={set('loading_pressure')} />}
            {isComp && <Fld label="Cut-off / Unload Pressure, bar" type="number" value={f.unload_pressure} onChange={set('unload_pressure')} />}
            {isDryer && <Fld label="Max working pressure, bar" type="number" value={f.max_working_pressure} onChange={set('max_working_pressure')} />}
          </Section>
        )}

        {isComp && (
          <Section title="Motor & output">
            <Fld label="IE Rating" value={f.ie_rating} onChange={set('ie_rating')} />
            <Fld label="Motor Type" value={f.motor_type} onChange={set('motor_type')} />
            <Fld label="Outlet air temperature, °C" type="number" value={f.outlet_air_temp} onChange={set('outlet_air_temp')} />
          </Section>
        )}

        {isFilter && (
          <Section title="Filter ratings">
            <Fld label="Particle removal, micron" type="number" value={f.particle_removal} onChange={set('particle_removal')} />
            <Fld label="Oil carry over, ppm" type="number" value={f.oil_carryover} onChange={set('oil_carryover')} />
          </Section>
        )}

        {isTank && (
          <Section title="Air receiver tank">
            <Fld label="Volume, L" type="number" value={f.tank_volume} onChange={set('tank_volume')} />
            <Fld label="Working pressure, bar" type="number" value={f.tank_pressure} onChange={set('tank_pressure')} />
            <Fld label="Material" value={f.tank_material} onChange={set('tank_material')} />
          </Section>
        )}

        <Section title="Physical & commercial">
          {(isComp || isDryer) && <Fld label="Noise level, dB" type="number" value={f.noise} onChange={set('noise')} />}
          <Fld label="Outlet" value={f.outlet} onChange={set('outlet')} />
          <Fld label="Weight" type="number" value={f.weight} onChange={set('weight')} />
          <Fld label="Dimension (L x W x H mm)" value={f.dimension} onChange={set('dimension')} />
          <Fld label="Cost RM" type="number" value={f.cost_rm} onChange={set('cost_rm')} />
          <Fld label="Lead (weeks)" type="number" value={f.lead_time_weeks} onChange={set('lead_time_weeks')} />
        </Section>

        <p className="text-xs text-slate-400 mt-3">Selling price is derived from cost + smart markup at quote time.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add product'}</button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-slate-400 mb-2">{title.toUpperCase()}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
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
