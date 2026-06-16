// TCO + efficiency comparison engine (logic adapted from the Hikaku tool).
// Normalises our catalog products and competitor records into a common shape,
// then computes SER, annual energy, multi-year TCO, CO2 and payback.

export const DEFAULT_INPUTS = {
  hours: 6000,      // operating hours / year
  tariff: 0.45,     // RM / kWh (TNB MT band)
  years: 5,         // ownership horizon
  load: 0.7,        // fixed-speed: fraction of time loaded
  unload: 0.3,      // fixed-speed: % rated kW drawn while unloaded
  opFlow: 0.7,      // VSD: average operating flow fraction
  vsdFloor: 0.3,    // VSD: residual power fraction at low flow
  co2Factor: 0.585, // kg CO2e / kWh (Malaysia grid)
}

const isInverterType = (t) => /inverter|vfd|vsd|variable/i.test(t || '')

// Normalise a catalog product -> comparable unit (brand = your company).
export function productToUnit(p, companyName = 'Our offer') {
  return {
    kind: 'ours', id: 'p_' + p.id, brand: companyName, model: p.model, type: p.type,
    pressure: num(p.specs?.['Loading Pressure']),
    flow_m3min: num(p.specs?.['Max m3/min']) ?? num(p.specs?.['Min m3/min']),
    flow_cfm: num(p.cfm_max),
    power_kw: num(p.kw),
    noise: num(p.specs?.['Noise level']),
    is_inverter: isInverterType(p.type),
    capex: num(p.price_rm) || 0,
  }
}

// Normalise a competitor record -> comparable unit.
export function competitorToUnit(c) {
  return {
    kind: 'comp', id: 'c_' + c.id, brand: c.brand, model: c.model, type: c.type,
    pressure: num(c.loading_pressure),
    flow_m3min: num(c.flow_m3min),
    flow_cfm: num(c.flow_cfm),
    power_kw: num(c.real_kw) ?? num(c.rated_kw),
    noise: num(c.noise_db),
    is_inverter: !!c.is_inverter || isInverterType(c.type),
    capex: num(c.price_rm) || 0,
  }
}

export const ser = (u) => (u.power_kw && u.flow_m3min ? u.power_kw / u.flow_m3min : null)

export function annualKWh(u, x) {
  if (!u.power_kw) return null
  if (u.is_inverter) {
    const effKW = u.power_kw * (x.vsdFloor + (1 - x.vsdFloor) * x.opFlow)
    return effKW * x.hours
  }
  // fixed speed: loaded portion at full kW + unloaded portion at unload% kW
  return u.power_kw * (x.load + (1 - x.load) * x.unload) * x.hours
}

export const annualEnergy = (u, x) => { const k = annualKWh(u, x); return k === null ? null : k * x.tariff }
export const annualCO2 = (u, x) => { const k = annualKWh(u, x); return k === null ? null : k * x.co2Factor }
export function tco(u, x) {
  const e = annualEnergy(u, x)
  return e === null ? null : u.capex + e * x.years
}

// Per-metric ranking class for color grading. lowerIsBetter for SER/energy/TCO/noise/CO2.
export function gradeClasses(values, lowerIsBetter = true) {
  const valid = values.map((v, i) => ({ v, i })).filter((o) => o.v !== null && !Number.isNaN(o.v))
  if (valid.length < 2) return values.map(() => '')
  const sorted = [...valid].sort((a, b) => (lowerIsBetter ? a.v - b.v : b.v - a.v))
  const out = values.map(() => '')
  sorted.forEach((o, rank) => {
    const frac = sorted.length === 1 ? 0 : rank / (sorted.length - 1)
    out[o.i] = frac <= 0.001 ? 'best' : frac < 0.4 ? 'good' : frac < 0.7 ? 'mid' : frac < 0.999 ? 'poor' : 'worst'
  })
  return out
}

// Full analysis for a set of units under given inputs.
export function analyze(units, inputs) {
  const x = { ...DEFAULT_INPUTS, ...inputs }
  const rows = units.map((u) => ({
    u, ser: ser(u), energy: annualEnergy(u, x), tco: tco(u, x), co2: annualCO2(u, x),
  }))
  // winner = lowest TCO (fallback lowest SER)
  const withTco = rows.filter((r) => r.tco !== null)
  let winner = null
  if (withTco.length) winner = withTco.reduce((a, b) => (b.tco < a.tco ? b : a))
  else {
    const withSer = rows.filter((r) => r.ser !== null)
    if (withSer.length) winner = withSer.reduce((a, b) => (b.ser < a.ser ? b : a))
  }

  // payback of winner vs the most expensive-to-run alternative
  let payback = null
  if (winner) {
    const others = rows.filter((r) => r !== winner && r.energy !== null && r.tco !== null)
    if (others.length) {
      const baseline = others.reduce((a, b) => (b.tco > a.tco ? b : a))
      const capexGap = winner.u.capex - baseline.u.capex // winner may cost more upfront
      const energySaving = baseline.energy - winner.energy // per year
      if (capexGap > 0 && energySaving > 0) {
        payback = { months: (capexGap / energySaving) * 12, baseline: baseline.u, saving: energySaving }
      } else if (energySaving > 0) {
        payback = { months: 0, baseline: baseline.u, saving: energySaving } // cheaper AND more efficient
      }
    }
  }

  return { x, rows, winner, payback }
}

function num(v) { const n = Number(v); return v === null || v === undefined || v === '' || Number.isNaN(n) ? null : n }
