import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { RM, fmtDate } from './format'
import { lineNet, lineUnitNet, quoteTotals } from './pricing'
import { categoryOf } from './categories'
import { generalSpecRows, clausesFor, longestLead, leadText } from './quoteDoc'

const BRAND = [15, 76, 129]

// Branded multi-page A4 quotation:
//   Page 1  — header, customer, item summary, totals, lead time, terms.
//   Page 2+ — one equipment specification page per line item, with clauses.
export function generateQuotePDF({ quote, items, customer, profile }) {
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
    head: [['#', 'Item', 'Qty', 'Unit (RM)', 'Amount (RM)']],
    body: items.map((it, i) => [
      i + 1,
      `${it.model || ''}${it.description ? `\n${it.description}` : ''}`,
      it.qty,
      RM(lineUnitNet(it)),
      RM(lineNet(it)),
    ]),
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: BRAND, halign: 'left' },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 36, halign: 'center' },
      3: { halign: 'right' }, 4: { halign: 'right' },
    },
  })

  // ---------- TOTALS ----------
  const t = quoteTotals(items, quote.quote_discount_pct, quote.tax_pct)
  let ty = doc.lastAutoTable.finalY + 14
  const rows = [
    ['Subtotal', RM(t.subtotal)],
    ...(quote.quote_discount_pct ? [[`Quote discount (${quote.quote_discount_pct}%)`, `- ${RM(t.quoteDiscount)}`]] : []),
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

  // ---------- TERMS + SIGNATURE ----------
  if (quote.terms) {
    doc.setFontSize(8).setFont('helvetica', 'bold')
    doc.text('Terms & Conditions', M, ty)
    doc.setFont('helvetica', 'normal')
    const split = doc.splitTextToSize(quote.terms, W - M * 2)
    doc.text(split, M, ty + 12)
    ty += 12 + split.length * 10
  }
  doc.setFontSize(9)
  doc.text(profile?.signature || 'Prepared by', M, ty + 28)
  doc.setFont('helvetica', 'bold').text(profile?.full_name || '', M, ty + 44)

  // ---------- SPEC PAGES ----------
  items.filter((it) => it.product).forEach((it) => {
    doc.addPage()
    doc.setTextColor(30)
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(120)
    doc.text('EQUIPMENT SPECIFICATION', M, 48)
    doc.setTextColor(30).setFontSize(16).setFont('helvetica', 'bold')
    doc.text(it.model || '', M, 66)
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(90)
    doc.text(`${categoryOf(it.product)}  ·  ${it.product.type || ''}`, M, 80)
    doc.setDrawColor(...BRAND).setLineWidth(1.5).line(M, 88, W - M, 88)
    doc.setTextColor(30)

    const specRows = [...generalSpecRows(it.product), ...Object.entries(it.product.specs || {})]
      .map(([k, v]) => [k, String(v)])

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
    clausesFor(it.product).forEach((c) => {
      doc.text(`•  ${c}`, M, cy)
      cy += 12
    })
    doc.setTextColor(30)
  })

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
