import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RM, num } from '../lib/format'
import {
  productToUnit, competitorToUnit, analyze, gradeClasses, DEFAULT_INPUTS,
} from '../lib/compare'
import { generateComparePDF } from '../lib/comparePdf'
import CompetitorsModal from '../components/CompetitorsModal'

const GRADE_BG = {
  best: 'bg-green-100 text-green-800', good: 'bg-green-50 text-green-700',
  mid: 'bg-amber-50 text-amber-700', poor: 'bg-orange-100 text-orange-700',
  worst: 'bg-red-100 text-red-700', '': '',
}

export default function Comparison() {
  const { profile, isAdmin } = useAuth()
  const [products, setProducts] = useState([])
  const [competitors, setCompetitors] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)
  const [showManage, setShowManage] = useState(false)

  const company = profile?.company_name || 'Our offer'

  async function load() {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('products').select('*').order('model'),
      supabase.from('competitors').select('*').order('brand').order('model'),
    ])
    setProducts(p || [])
    setCompetitors(c || [])
  }
  useEffect(() => { load() }, [])

  const units = useMemo(() => [
    ...products.map((p) => productToUnit(p, company)),
    ...competitors.map(competitorToUnit),
  ], [products, competitors, company])

  const selectedUnits = units.filter((u) => selected.has(u.id))
  const analysis = useMemo(
    () => (selectedUnits.length >= 2 ? analyze(selectedUnits, inputs) : null),
    [selectedUnits, inputs],
  )

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const setIn = (k) => (e) => setInputs((x) => ({ ...x, [k]: Number(e.target.value) }))

  // grades across selected units
  const grades = useMemo(() => {
    if (!analysis) return null
    return {
      ser: gradeClasses(analysis.rows.map((r) => r.ser)),
      energy: gradeClasses(analysis.rows.map((r) => r.energy)),
      tco: gradeClasses(analysis.rows.map((r) => r.tco)),
      co2: gradeClasses(analysis.rows.map((r) => r.co2)),
    }
  }, [analysis])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Comparison</h1>
          <p className="text-sm text-slate-500">Pit your equipment against competitors on lifetime cost, not just price.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && <button className="btn-ghost" onClick={() => setShowManage(true)}>Manage competitors</button>}
          <button className="btn-primary" disabled={!analysis} onClick={() => generateComparePDF({ analysis, profile })}>Export PDF</button>
        </div>
      </div>

      {/* selection */}
      <div className="grid md:grid-cols-2 gap-4">
        <Picker title="Your products" empty="No products." items={units.filter((u) => u.kind === 'ours')} selected={selected} toggle={toggle} />
        <Picker title="Competitors" empty="No competitors yet — add some via Manage competitors." items={units.filter((u) => u.kind === 'comp')} selected={selected} toggle={toggle} />
      </div>

      {/* inputs */}
      <div className="card p-4">
        <h2 className="font-semibold text-sm mb-3">Assumptions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <In label="Hours / yr" v={inputs.hours} on={setIn('hours')} />
          <In label="Tariff RM/kWh" step="0.01" v={inputs.tariff} on={setIn('tariff')} />
          <In label="Horizon (yrs)" v={inputs.years} on={setIn('years')} />
          <In label="Load %" v={pctv(inputs.load)} on={(e) => setInputs((x) => ({ ...x, load: e.target.value / 100 }))} />
          <In label="Unload %" v={pctv(inputs.unload)} on={(e) => setInputs((x) => ({ ...x, unload: e.target.value / 100 }))} />
          <In label="VSD flow %" v={pctv(inputs.opFlow)} on={(e) => setInputs((x) => ({ ...x, opFlow: e.target.value / 100 }))} />
          <In label="CO₂ kg/kWh" step="0.001" v={inputs.co2Factor} on={setIn('co2Factor')} />
        </div>
      </div>

      {/* results */}
      {!analysis ? (
        <div className="card p-10 text-center text-sm text-slate-400">Select at least two units above to compare.</div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs">
                  <th className="text-left p-3 text-slate-500">Metric</th>
                  {analysis.rows.map((r) => (
                    <th key={r.u.id} className="p-3 text-center">
                      <div className="font-bold">{r.u.brand}</div>
                      <div className="text-xs text-slate-400 font-normal">{r.u.model}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                <Metric label="Type" units={analysis.rows} get={(r) => r.u.type || '—'} />
                <Metric label="Pressure (bar)" units={analysis.rows} get={(r) => fmt(r.u.pressure)} />
                <Metric label="Flow (m³/min)" units={analysis.rows} get={(r) => fmt(r.u.flow_m3min)} />
                <Metric label="Flow (CFM)" units={analysis.rows} get={(r) => fmt(r.u.flow_cfm)} />
                <Metric label="Power (kW)" units={analysis.rows} get={(r) => fmt(r.u.power_kw)} />
                <Metric label="CAPEX" units={analysis.rows} get={(r) => RM(r.u.capex)} />
                <Metric label="SER (kW/m³/min)" units={analysis.rows} get={(r) => (r.ser ? r.ser.toFixed(3) : '—')} grade={grades.ser} />
                <Metric label="Energy / yr" units={analysis.rows} get={(r) => (r.energy === null ? '—' : RM(r.energy))} grade={grades.energy} />
                <Metric label={`${inputs.years}-yr TCO`} units={analysis.rows} get={(r) => (r.tco === null ? '—' : RM(r.tco))} grade={grades.tco} bold />
                <Metric label="CO₂ / yr (kg)" units={analysis.rows} get={(r) => (r.co2 === null ? '—' : num(r.co2))} grade={grades.co2} />
              </tbody>
            </table>
          </div>

          {analysis.winner && (
            <div className="card p-5 bg-brand-light/40">
              <div className="text-xs font-semibold text-brand">RECOMMENDED — LOWEST TOTAL COST</div>
              <div className="text-xl font-bold mt-1">{analysis.winner.u.brand} {analysis.winner.u.model}</div>
              <div className="text-sm text-slate-600 mt-0.5">
                {[analysis.winner.ser && `SER ${analysis.winner.ser.toFixed(3)} kW/m³/min`,
                  analysis.winner.tco !== null && `${inputs.years}-yr TCO ${RM(analysis.winner.tco)}`].filter(Boolean).join('  ·  ')}
              </div>
              {analysis.payback && (
                <div className="text-sm mt-2 text-green-700">
                  {analysis.payback.months <= 0
                    ? `Cheaper to buy AND run than ${analysis.payback.baseline.brand} ${analysis.payback.baseline.model} — saves ${RM(analysis.payback.saving)}/yr.`
                    : `Pays back its premium vs ${analysis.payback.baseline.brand} ${analysis.payback.baseline.model} in ${Math.round(analysis.payback.months)} months (${RM(analysis.payback.saving)}/yr energy savings).`}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showManage && <CompetitorsModal onClose={() => setShowManage(false)} onChanged={load} />}
    </div>
  )
}

function Picker({ title, items, selected, toggle, empty }) {
  return (
    <div className="card p-3">
      <div className="text-xs font-semibold text-slate-500 mb-2">{title}</div>
      <div className="max-h-56 overflow-y-auto divide-y">
        {items.length === 0 && <div className="p-2 text-sm text-slate-400">{empty}</div>}
        {items.map((u) => (
          <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer text-sm">
            <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
            <span className="flex-1 min-w-0">
              <span className="font-medium">{u.brand} {u.model}</span>
              <span className="text-xs text-slate-400 ml-2">
                {[u.power_kw && `${u.power_kw}kW`, u.flow_m3min && `${u.flow_m3min} m³/min`, u.is_inverter && 'VSD'].filter(Boolean).join(' · ')}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, units, get, grade, bold }) {
  return (
    <tr>
      <td className="p-3 text-slate-500 font-medium">{label}</td>
      {units.map((r, i) => (
        <td key={r.u.id} className={`p-3 text-center ${grade ? GRADE_BG[grade[i]] : ''} ${bold ? 'font-bold' : ''}`}>{get(r)}</td>
      ))}
    </tr>
  )
}

function In({ label, v, on, step }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" step={step} className="input py-1" value={v} onChange={on} />
    </div>
  )
}

const fmt = (v) => (v === null || v === undefined ? '—' : num(v))
const pctv = (f) => Math.round(f * 100)
