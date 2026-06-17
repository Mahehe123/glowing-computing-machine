import { RM, fmtDate } from './format'
import { lineNet, sellingUnit, anchorUnit, discountPct, quoteTotals } from './pricing'
import { categoryOf } from './categories'
import { equipmentSpecRows, leadPill, clausesFor, longestLead, leadText, itemLabel } from './quoteDoc'

const BRAND = [15, 76, 129]

// Branded multi-page A4 quotation:
//   Page 1  — header, customer, item summary, totals, lead time, terms.
//   Page 2+ — one equipment specification page per line item, with clauses.
export async function generateQuotePDF({ quote, items, customer, profile }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40

  // ---------- PAGE 1 HEADER ----------
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, W, 96, 'F')
  let textX = M

  if (profile?.logo_url) {
    try {
      const props = doc.getImageProperties(profile.logo_url)
      const h = 46
      const w = (props.width / props.height) * h
      // white plate behind logo so transparent PNGs stay visible on the band
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(M - 6, 25, w + 12, h + 12, 4, 4, 'F')
      doc.addImage(profile.logo_url, 'PNG', M, 31, w, h)
      textX = M + w + 18
    } catch { /* ignore bad image */ }
  }

  doc.setTextColor(255)
  doc.setFontSize(17).setFont('helvetica', 'bold')
  doc.text(profile?.company_name || 'Your Company', textX, 44)
  doc.setFontSize(8.5).setFont('helvetica', 'normal')
  doc.text([profile?.address, profile?.phone, profile?.email].filter(Boolean), textX, 58)

  doc.setFontSize(22).setFont('helvetica', 'bold')
  doc.text('QUOTATION', W - M, 44, { align: 'right' })
  doc.setFontSize(10).setFont('helvetica', 'normal')
  doc.text(quote.quote_no || '(unsaved)', W - M, 62, { align: 'right' })

  doc.setTextColor(30)
  let y = 124

  // ---------- CUSTOMER + META ----------
  doc.setFontSize(9).setFont('helvetica', 'bold')
  doc.text('TO', M, y)
  const toLines = [
    customer?.company, customer?.contact_person, customer?.address,
    [customer?.phone, customer?.email].filter(Boolean).join('  '),
  ].filter(Boolean)
  doc.setFont('helvetica', 'normal')
  doc.text(toLines.length ? toLines : ['—'], M, y + 14)

  const meta = [
    ['Date', fmtDate(quote.quote_date)],
    ['Valid until', fmtDate(quote.valid_until)],
    ['Prepared by', profile?.full_name || ''],
    ['Status', (quote.status || 'draft').toUpperCase()],
  ]
  meta.forEach((m, i) => {
    doc.setFont('helvetica', 'bold')
    doc.text(m[0], W / 2 + 20, y + 14 + i * 14)
    doc.setFont('helvetica', 'normal')
    doc.text(String(m[1] || '—'), W / 2 + 110, y + 14 + i * 14)
  })
  y += 14 + Math.max(toLines.length, meta.length) * 14 + 16

  // ---------- ITEM SUMMARY ----------
  autoTable(doc, {
    startY: y,
    head: [['#', 'Item', 'Qty', 'List (RM)', 'Disc', 'Unit (RM)', 'Amount (RM)']],
    body: items.map((it, i) => {
      const sub = !it.is_custom && it.product ? [categoryOf(it.product), it.product.type].filter(Boolean).join(' · ') : ''
      return [
      i + 1,
      `${itemLabel(it)}${sub ? `\n${sub}` : ''}`,
      it.qty,
      !it.is_custom && discountPct(it) > 0 ? RM(anchorUnit(it)) : '',
      !it.is_custom && discountPct(it) > 0 ? `-${discountPct(it)}%` : '',
      RM(sellingUnit(it)),
      RM(lineNet(it)),
    ]
    }),
    margin: { left: M, right: M },
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: BRAND, halign: 'left' },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
      3: { halign: 'right', textColor: [150, 150, 150] },
      4: { cellWidth: 38, halign: 'center', textColor: [10, 124, 74] },
      5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' },
    },
  })

  // ---------- TOTALS ----------
  const t = quoteTotals(items, quote.tax_pct)
  let ty = doc.lastAutoTable.finalY + 14
  const rows = [
    ['Subtotal', RM(t.subtotal)],
    ...(quote.tax_pct ? [[`Tax (${quote.tax_pct}%)`, RM(t.tax)]] : []),
  ]
  doc.setFontSize(9)
  rows.forEach((r) => {
    doc.setFont('helvetica', 'normal')
    doc.text(r[0], W - M - 200, ty)
    doc.text(r[1], W - M, ty, { align: 'right' })
    ty += 16
  })
  doc.setDrawColor(200).line(W - M - 200, ty - 6, W - M, ty - 6)
  doc.setFont('helvetica', 'bold').setFontSize(11)
  doc.text('TOTAL (MYR)', W - M - 200, ty + 8)
  doc.text(RM(t.total), W - M, ty + 8, { align: 'right' })
  ty += 28

  // ---------- LEAD TIME ----------
  const lead = longestLead(items)
  if (lead) {
    doc.setFillColor(231, 240, 248)
    doc.roundedRect(M, ty, W - M * 2, 22, 3, 3, 'F')
    doc.setTextColor(...BRAND).setFontSize(9.5).setFont('helvetica', 'bold')
    doc.text(`Lead time based on equipment ${lead.model}: ${leadText(lead.weeks)}`, M + 10, ty + 14)
    doc.setTextColor(30)
    ty += 34
  }

  // ---------- SIGNATURE (terms moved to a dedicated final page) ----------
  doc.setFontSize(9).setFont('helvetica', 'normal')
  doc.text(profile?.signature || 'Prepared by', M, ty + 28)
  doc.setFont('helvetica', 'bold').text(profile?.full_name || '', M, ty + 44)

  // ---------- BACK PAGES: equipment spec (products) or scope of works (custom) ----------
  items.filter((it) => it.product || (it.is_custom && it.description)).forEach((it) => {
    doc.addPage()
    doc.setTextColor(30)
    if (it.product) {
      doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(120)
      doc.text('EQUIPMENT SPECIFICATION', M, 48)
      doc.setTextColor(30).setFontSize(16).setFont('helvetica', 'bold')
      const brand = it.product.brand || profile?.company_name || ''
      doc.text(`${brand} / ${it.model || ''}`, M, 66)
      doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(90)
      doc.text(`${categoryOf(it.product)}  ·  ${it.product.type || ''}`, M, 80)

      // Lead-time pill, top-right.
      const lp = leadPill(it.product)
      if (lp) {
        const label = `Lead time: ${lp}`
        doc.setFontSize(8.5).setFont('helvetica', 'bold')
        const tw = doc.getTextWidth(label)
        const padX = 8, ph = 17, py = 52
        const px = W - M - tw - padX * 2
        doc.setFillColor(225, 235, 245)
        doc.roundedRect(px, py, tw + padX * 2, ph, 8, 8, 'F')
        doc.setTextColor(...BRAND)
        doc.text(label, px + padX, py + 11.5)
        doc.setFont('helvetica', 'normal')
      }

      doc.setDrawColor(...BRAND).setLineWidth(1.5).line(M, 88, W - M, 88)
      doc.setTextColor(30)

      const specRows = equipmentSpecRows(it.product).map(([k, v]) => [k, String(v)])

      autoTable(doc, {
        startY: 100,
        body: specRows,
        margin: { left: M, right: M },
        styles: { fontSize: 9.5, cellPadding: 5 },
        columnStyles: { 0: { cellWidth: (W - M * 2) / 2, textColor: [90, 90, 90] }, 1: { fontStyle: 'bold' } },
        theme: 'grid',
        tableLineColor: [225, 225, 225],
      })

      let cy = doc.lastAutoTable.finalY + 16
      doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(110)
      clausesFor(it.product).forEach((c) => { doc.text(`•  ${c}`, M, cy); cy += 12 })
      doc.setTextColor(30)
    } else {
      doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(120)
      doc.text('SCOPE OF WORKS', M, 48)
      doc.setTextColor(30).setFontSize(16).setFont('helvetica', 'bold')
      doc.text(itemLabel(it), M, 66)
      doc.setDrawColor(...BRAND).setLineWidth(1.5).line(M, 74, W - M, 74)
      doc.setTextColor(40).setFontSize(10).setFont('helvetica', 'normal')
      doc.text(doc.splitTextToSize(it.description || '', W - M * 2), M, 92)
    }
  })

  // ---------- TERMS & CONDITIONS: dedicated final page ----------
  if (quote.terms) {
    doc.addPage()
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(120)
    doc.text('TERMS & CONDITIONS', M, 48)
    doc.setDrawColor(...BRAND).setLineWidth(1.5).line(M, 56, W - M, 56)
    doc.setTextColor(40).setFontSize(9).setFont('helvetica', 'normal')
    const pageH = doc.internal.pageSize.getHeight()
    let ty2 = 74
    doc.splitTextToSize(quote.terms, W - M * 2).forEach((line) => {
      if (ty2 > pageH - M) { doc.addPage(); ty2 = M + 20 }
      doc.text(line, M, ty2); ty2 += 12
    })
    doc.setTextColor(30)
  }

  // ---------- FOOTER: page numbers on every page ----------
  const H = doc.internal.pageSize.getHeight()
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(150)
    doc.text(quote.quote_no || '', M, H - 20)
    doc.text(`Page ${i} of ${pageCount}`, W - M, H - 20, { align: 'right' })
  }

  doc.save(`${quote.quote_no || 'quotation'}.pdf`)
}
