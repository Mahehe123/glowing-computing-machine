import { describe, it, expect } from 'vitest'
import { parseDim, ser, annualKWh, annualEnergy, tco, analyze, DEFAULT_INPUTS } from './compare'

describe('parseDim', () => {
  it('parses L x W x H and derives footprint/volume', () => {
    const d = parseDim('3045 x 1870 x 1982')
    expect(d.l).toBe(3045); expect(d.w).toBe(1870); expect(d.h).toBe(1982)
    expect(d.footprint_m2).toBeCloseTo(5.69, 2)   // 3045*1870/1e6
    expect(d.volume_m3).toBeCloseTo(11.28, 1)
  })
  it('returns null on junk', () => {
    expect(parseDim('')).toBeNull()
    expect(parseDim('n/a')).toBeNull()
  })
})

describe('energy + SER', () => {
  const x = { ...DEFAULT_INPUTS, hours: 6000, tariff: 0.45, load: 0.7, unload: 0.3, opFlow: 0.7, vsdFloor: 0.3 }

  it('SER = power / flow', () => {
    expect(ser({ power_kw: 75, flow_m3min: 12.86 })).toBeCloseTo(5.832, 3)
  })
  it('fixed-speed annual kWh uses load + unload', () => {
    // 100kW * (0.7 + 0.3*0.3) * 6000 = 100 * 0.79 * 6000
    expect(annualKWh({ power_kw: 100, is_inverter: false }, x)).toBeCloseTo(474000, 0)
  })
  it('VSD annual kWh uses floor + proportional flow', () => {
    // 100 * (0.3 + 0.7*0.7) * 6000 = 100 * 0.79 * 6000  (opFlow 0.7)
    expect(annualKWh({ power_kw: 100, is_inverter: true }, x)).toBeCloseTo(474000, 0)
  })
  it('annualEnergy = kWh * tariff; tco = capex + energy*years', () => {
    const u = { power_kw: 100, is_inverter: false, capex: 50000 }
    const e = annualEnergy(u, x)
    expect(e).toBeCloseTo(474000 * 0.45, 0)
    expect(tco(u, x)).toBeCloseTo(50000 + e * x.years, 0)
  })
  it('no power => null metrics', () => {
    expect(annualKWh({ power_kw: null }, x)).toBeNull()
  })
})

describe('analyze picks lowest-TCO winner', () => {
  it('cheaper-to-run unit wins despite higher capex', () => {
    const units = [
      { id: 'a', brand: 'X', model: 'A', power_kw: 110, flow_m3min: 12, is_inverter: false, capex: 0 },
      { id: 'b', brand: 'Y', model: 'B', power_kw: 75, flow_m3min: 12, is_inverter: false, capex: 105000 },
    ]
    const r = analyze(units, DEFAULT_INPUTS)
    expect(r.winner.u.id).toBe('b') // lower energy wins over 5 years
    expect(r.payback).toBeTruthy()
  })
})
