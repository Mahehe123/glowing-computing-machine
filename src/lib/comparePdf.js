import { RM, num } from './format'
import { ser, gradeClasses } from './compare'

const BRAND = [15, 76, 129]
const GRADE_RGB = {
  best: [214, 245, 232], good: [227, 247, 236], mid: [255, 244, 214],
  poor: [253, 229, 217], worst: [248, 215, 218], '': null,
}

export async function generateComparePDF({ analysis, profile }) {
  const { rows, x, winner, payback } = analysis
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40

  doc.setFillColor(...BRAND); doc.rect(0, 0, W, 80, 'F')
  let textX = M
  if (profile?.logo_url) {
    try {
      const pr = doc.getImageProperties(profile.logo_url)
      const h = 40, w = (pr.width / pr.height) * h
      doc.setFillColor(255, 255, 255); doc.roundedRect(M - 5, 20, w + 10, h + 8, 3, 3, 'F')
      doc.addImage(profile.logo_url, 'PNG', M, 24, w, h); textX = M + w + 16
    } catch { /* ignore */ }
  }
  doc.setTextColor(255).setFont('helvetica', 'bold').setFontSize(16)
  doc.text(profile?.company_name || 'Equipment Comparison', textX, 38)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text('Total Cost of Ownership Comparison', textX, 56)
  doc.setTextColor(30)

  const units = rows.map((r) => r.u)
  const label = (u) => `${u.brand}\n${u.model}`

  // graded metric rows
  const serVals = rows.map((r) => r.ser)
  const energyVals = rows.map((r) => r.energy)
  const tcoVals = rows.map((r) => r.tco)
  const co2Vals = rows.map((r) => r.co2)
  const footVals = units.map((u) => u.dim?.footprint_m2 ?? null)
  const weightVals = units.map((u) => u.weight ?? null)
  const gSer = gradeClasses(serVals), gEnergy = gradeClasses(energyVals), gTco = gradeClasses(tcoVals)
  const gCo2 = gradeClasses(co2Vals), gFoot = gradeClasses(footVals), gWeight = gradeClasses(weightVals)

  const body = [
    ['Type', ...units.map((u) => u.type || '—')],
    ['Working pressure (bar)', ...units.map((u) => fmt(u.pressure))],
    ['Flow (m³/min)', ...units.map((u) => fmt(u.flow_m3min))],
    ['Flow (CFM)', ...units.map((u) => fmt(u.flow_cfm))],
    ['Power (kW)', ...units.map((u) => fmt(u.power_kw))],
    ['CAPEX', ...units.map((u) => RM(u.capex))],
    ['SER (kW/m³/min)', ...rows.map((r) => (r.ser ? r.ser.toFixed(3) : '—'))],
    [`Energy / yr`, ...rows.map((r) => (r.energy === null ? '—' : RM(r.energy)))],
    [`${x.years}-yr TCO`, ...rows.map((r) => (r.tco === null ? '—' : RM(r.tco)))],
    ['CO₂ / yr (kg)', ...rows.map((r) => (r.co2 === null ? '—' : num(r.co2)))],
    ['Dimensions (mm)', ...units.map((u) => (u.dim ? `${fmt(u.dim.l)}×${fmt(u.dim.w)}×${fmt(u.dim.h)}` : '—'))],
    ['Footprint (m²)', ...units.map((u) => (u.dim?.footprint_m2 ? u.dim.footprint_m2.toFixed(2) : '—'))],
    ['Weight (kg)', ...units.map((u) => fmt(u.weight))],
  ]
  // map row index -> grade array
  const gradeForRow = { 6: gSer, 7: gEnergy, 8: gTco, 9: gCo2, 11: gFoot, 12: gWeight }

  autoTable(doc, {
    startY: 100,
    head: [['Metric', ...units.map(label)]],
    body,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 5, halign: 'center' },
    headStyles: { fillColor: BRAND, halign: 'center', fontSize: 9 },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', fillColor: [244, 246, 249], textColor: [60, 60, 60] } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index > 0) {
        const g = gradeForRow[d.row.index]
        if (g) { const rgb = GRADE_RGB[g[d.column.index - 1]]; if (rgb) d.cell.styles.fillColor = rgb }
      }
    },
  })

  let y = doc.lastAutoTable.finalY + 20
  if (winner) {
    doc.setFillColor(231, 240, 248); doc.roundedRect(M, y, W - M * 2, 64, 4, 4, 'F')
    doc.setTextColor(...BRAND).setFont('helvetica', 'bold').setFontSize(9)
    doc.text('RECOMMENDED — LOWEST TOTAL COST', M + 12, y + 16)
    doc.setTextColor(20).setFontSize(15)
    doc.text(`${winner.u.brand} ${winner.u.model}`, M + 12, y + 36)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(70)
    const bits = []
    if (winner.ser) bits.push(`SER ${winner.ser.toFixed(3)} kW/m³/min`)
    if (winner.tco !== null) bits.push(`${x.years}-yr TCO ${RM(winner.tco)}`)
    doc.text(bits.join('   ·   '), M + 12, y + 52)
    y += 80
  }

  // findings
  const findings = buildFindings(analysis)
  doc.setTextColor(30).setFont('helvetica', 'bold').setFontSize(10)
  doc.text('Key findings', M, y); y += 14
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(60)
  findings.forEach((f) => {
    const lines = doc.splitTextToSize(`•  ${f}`, W - M * 2)
    doc.text(lines, M, y); y += lines.length * 12 + 2
  })

  y += 8
  doc.setFontSize(7.5).setTextColor(130)
  doc.text(doc.splitTextToSize(
    `Assumptions: ${x.hours.toLocaleString()} hrs/yr · RM ${x.tariff.toFixed(2)}/kWh · ${x.years}-yr horizon · fixed-speed load ${(x.load * 100).toFixed(0)}%/unload ${(x.unload * 100).toFixed(0)}% · VSD avg flow ${(x.opFlow * 100).toFixed(0)}% · CO₂ ${x.co2Factor} kg/kWh (Malaysia grid). Energy figures are estimates for comparison.`,
    W - M * 2), M, y)

  doc.save('equipment-comparison.pdf')
}

function buildFindings(analysis) {
  const { rows, winner, payback, x } = analysis
  const out = []
  const sers = rows.filter((r) => r.ser !== null)
  if (sers.length >= 2) {
    const best = sers.reduce((a, b) => (b.ser < a.ser ? b : a))
    const worst = sers.reduce((a, b) => (b.ser > a.ser ? b : a))
    const diff = ((worst.ser - best.ser) / worst.ser) * 100
    out.push(`${best.u.brand} ${best.u.model} is the most efficient — SER ${best.ser.toFixed(3)} kW/m³/min, ${diff.toFixed(0)}% better than ${worst.u.brand} ${worst.u.model}.`)
  }
  if (payback && winner) {
    if (payback.months <= 0) out.push(`${winner.u.brand} ${winner.u.model} is both cheaper to buy and cheaper to run than ${payback.baseline.brand} ${payback.baseline.model} — saving ${RM(payback.saving)}/yr in energy.`)
    else out.push(`${winner.u.brand} ${winner.u.model} pays back its price premium over ${payback.baseline.brand} ${payback.baseline.model} in ${Math.round(payback.months)} months via ${RM(payback.saving)}/yr energy savings.`)
  }
  const tcos = rows.filter((r) => r.tco !== null)
  if (tcos.length >= 2 && winner) {
    const worst = tcos.reduce((a, b) => (b.tco > a.tco ? b : a))
    if (worst !== winner) out.push(`Over ${x.years} years, ${winner.u.brand} ${winner.u.model} costs ${RM(worst.tco - winner.tco)} less in total than ${worst.u.brand} ${worst.u.model}.`)
  }
  if (!out.length) out.push('Enter power, flow and price for each unit to unlock energy and TCO findings.')
  return out
}

const fmt = (v) => (v === null || v === undefined ? '—' : num(v))
