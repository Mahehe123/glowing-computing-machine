import { RM, fmtDate } from '../lib/format'
import { lineNet, sellingUnit, anchorUnit, discountPct, quoteTotals } from '../lib/pricing'
import { categoryOf } from '../lib/categories'
import { equipmentSpecRows, leadPill, clausesFor, longestLead, leadText, itemLabel } from '../lib/quoteDoc'

// On-screen review of the quotation, laid out like the PDF (page 1 + spec pages).
export default function QuoteReview({ quote, items, customer, profile, onClose, onDownload }) {
  const t = quoteTotals(items, quote.tax_pct)
  const lead = longestLead(items)
  const company = profile?.company_name || 'Our brand'
  const backItems = items.filter((it) => it.product || (it.is_custom && it.description))

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="font-semibold text-sm">Quotation preview — {quote.quote_no}</div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={onDownload}>Download PDF</button>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-6">
        {/* PAGE 1 */}
        <Sheet>
          <div className="flex items-start justify-between border-b-2 border-brand pb-4">
            <div className="flex items-center gap-3">
              {profile?.logo_url && <img src={profile.logo_url} alt="logo" className="h-14 object-contain" />}
              <div>
                <div className="text-lg font-bold text-brand">{profile?.company_name || 'Your Company'}</div>
                <div className="text-xs text-slate-500 whitespace-pre-line">
                  {[profile?.address, profile?.phone, profile?.email].filter(Boolean).join('\n')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-tight">QUOTATION</div>
              <div className="text-sm text-slate-500">{quote.quote_no}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mt-4 text-sm">
            <div>
              <div className="text-xs font-semibold text-slate-400">TO</div>
              {customer ? (
                <div className="mt-1">
                  <div className="font-medium">{customer.company}</div>
                  <div className="text-slate-600">{customer.contact_person}</div>
                  <div className="text-slate-500 text-xs whitespace-pre-line">{customer.address}</div>
                  <div className="text-slate-500 text-xs">{[customer.phone, customer.email].filter(Boolean).join(' · ')}</div>
                </div>
              ) : <div className="text-slate-400 mt-1">—</div>}
            </div>
            <div className="text-sm">
              <Meta label="Date" value={fmtDate(quote.quote_date)} />
              <Meta label="Valid until" value={fmtDate(quote.valid_until)} />
              <Meta label="Prepared by" value={profile?.full_name} />
              <Meta label="Status" value={(quote.status || 'draft').toUpperCase()} />
            </div>
          </div>

          <table className="w-full text-sm mt-5">
            <thead>
              <tr className="bg-brand text-white text-xs">
                <th className="text-left p-2 w-6">#</th>
                <th className="text-left p-2">Item</th>
                <th className="text-center p-2">Qty</th>
                <th className="text-right p-2">Unit</th>
                <th className="text-right p-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b align-top">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">
                    <div className="font-medium">{itemLabel(it)}</div>
                    {!it.is_custom && it.product && (
                      <div className="text-xs text-slate-500">{[categoryOf(it.product), it.product.type].filter(Boolean).join(' · ')}</div>
                    )}
                  </td>
                  <td className="p-2 text-center">{it.qty}</td>
                  <td className="p-2 text-right">
                    {!it.is_custom && discountPct(it) > 0 ? (
                      <>
                        <div className="text-xs text-slate-400 line-through">{RM(anchorUnit(it))}</div>
                        <div>{RM(sellingUnit(it))} <span className="text-green-600 text-[10px]">−{discountPct(it)}%</span></div>
                      </>
                    ) : RM(sellingUnit(it))}
                  </td>
                  <td className="p-2 text-right">{RM(lineNet(it))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-3">
            <div className="w-64 text-sm space-y-1">
              <Row label="Subtotal" value={RM(t.subtotal)} />
              {quote.tax_pct > 0 && <Row label={`Tax (${quote.tax_pct}%)`} value={RM(t.tax)} />}
              <div className="flex justify-between border-t pt-1 font-bold text-base">
                <span>Total (MYR)</span><span className="text-brand">{RM(t.total)}</span>
              </div>
            </div>
          </div>

          {lead && (
            <div className="mt-4 text-sm bg-brand-light text-brand-dark rounded px-3 py-2">
              <b>Lead time based on equipment {lead.model}: {leadText(lead.weeks)}</b>
            </div>
          )}

          <div className="mt-8 text-sm">
            <div className="text-slate-500">{profile?.signature || 'Prepared by'}</div>
            <div className="font-medium mt-4 border-t border-slate-300 inline-block pt-1">{profile?.full_name || ''}</div>
          </div>
        </Sheet>

        {/* BACK PAGES — one per equipment (spec) or custom line (description) */}
        {backItems.map((it, i) => it.product ? (
          <Sheet key={i}>
            <div className="border-b-2 border-brand pb-2 mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-400">EQUIPMENT SPECIFICATION</div>
                <div className="text-lg font-bold">{(it.product.brand || company)} / {it.model}</div>
                <span className="badge bg-brand-light text-brand">{categoryOf(it.product)}</span>
                <span className="text-sm text-slate-500 ml-2">{it.product.type}</span>
              </div>
              {leadPill(it.product) && (
                <span className="badge bg-brand-light text-brand whitespace-nowrap shrink-0">Lead time: {leadPill(it.product)}</span>
              )}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {equipmentSpecRows(it.product).map(([k, v], idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-1.5 text-slate-500 w-1/2">{k}</td>
                    <td className="py-1.5 font-medium">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-4 text-[11px] text-slate-500 space-y-0.5">
              {clausesFor(it.product).map((c, idx) => <li key={idx}>• {c}</li>)}
            </ul>
          </Sheet>
        ) : (
          <Sheet key={i}>
            <div className="border-b-2 border-brand pb-2 mb-3">
              <div className="text-xs text-slate-400">SCOPE OF WORKS</div>
              <div className="text-lg font-bold">{itemLabel(it)}</div>
            </div>
            <div className="text-sm whitespace-pre-line text-slate-700">{it.description}</div>
          </Sheet>
        ))}

        {/* TERMS & CONDITIONS — dedicated final page */}
        {quote.terms && (
          <Sheet>
            <div className="border-b-2 border-brand pb-2 mb-3">
              <div className="text-xs text-slate-400">TERMS &amp; CONDITIONS</div>
            </div>
            <div className="text-sm whitespace-pre-line text-slate-700">{quote.terms}</div>
          </Sheet>
        )}
      </div>
    </div>
  )
}

function Sheet({ children }) {
  // shrink-0: the scroll container is a flex column, so without this the sheets get
  // compressed to fit the viewport (content clipped/overlapping) instead of scrolling.
  return <div className="bg-white shadow-lg rounded w-full max-w-[210mm] min-h-[200px] p-8 shrink-0">{children}</div>
}
function Meta({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-right">{value || '—'}</span>
    </div>
  )
}
function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span>{value}</span></div>
}
