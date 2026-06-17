import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { RM, num, fmtDate } from '../lib/format'
import { lineNet, quoteTotals, sellingUnit } from '../lib/pricing'
import { STATUSES } from '../lib/status'
import { categoryOf, sortCategories } from '../lib/categories'
import { longestLead, leadText, itemLabel } from '../lib/quoteDoc'
import { reasonLabel, competitorLabel } from '../lib/outcome'
import { generateQuotePDF } from '../lib/pdf'
import SpecModal from '../components/SpecModal'
import QuoteReview from '../components/QuoteReview'
import OutcomeModal from '../components/OutcomeModal'
import TermsTemplateModal from '../components/TermsTemplateModal'

function newQuoteNo() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `Q-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

const todayISO = () => new Date().toISOString().slice(0, 10)
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

export default function QuotationEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const toast = useToast()

  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [minMargin, setMinMargin] = useState(15)
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)

  const [head, setHead] = useState({
    quote_no: newQuoteNo(),
    customer_id: '',
    quote_date: todayISO(),
    valid_until: plusDays(30),
    status: 'draft',
    tax_pct: 0,
    notes: '',
    terms: '',
    outcome_reason: '', outcome_reason_note: '', competitor: '', competitor_note: '',
  })

  const [f, setF] = useState({ q: '', cat: '', type: '', air: '' })
  const [specProduct, setSpecProduct] = useState(null)
  const [showReview, setShowReview] = useState(false)
  const [showOutcome, setShowOutcome] = useState(null) // 'won' | 'lost' | null
  const [showTemplates, setShowTemplates] = useState(false)

  useEffect(() => {
    supabase.from('products').select('*').order('series').then(({ data }) => setProducts(data || []))
    supabase.from('customers').select('*').order('company').then(({ data }) => setCustomers(data || []))
    supabase.from('app_settings').select('min_margin_pct').eq('id', 1).single()
      .then(({ data }) => { if (data?.min_margin_pct != null) setMinMargin(data.min_margin_pct) })
  }, [])

  useEffect(() => {
    if (!id && profile?.default_terms) setHead((h) => (h.terms ? h : { ...h, terms: profile.default_terms }))
  }, [profile, id])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: q } = await supabase.from('quotations').select('*').eq('id', id).single()
      if (q) setHead({
        quote_no: q.quote_no, customer_id: q.customer_id || '', quote_date: q.quote_date,
        valid_until: q.valid_until, status: q.status, tax_pct: q.tax_pct || 0,
        notes: q.notes || '', terms: q.terms || '',
        outcome_reason: q.outcome_reason || '', outcome_reason_note: q.outcome_reason_note || '',
        competitor: q.competitor || '', competitor_note: q.competitor_note || '',
      })
      const { data: its } = await supabase.from('quotation_items').select('*').eq('quotation_id', id).order('position')
      setItems((its || []).map((it) => ({
        product_id: it.product_id, model: it.model, description: it.description,
        is_custom: it.is_custom || false, title: it.title || '',
        unit_price: Number(it.unit_price) || 0, unit_cost: Number(it.unit_cost) || 0,
        markup_pct: Number(it.markup_pct) || 0, qty: Number(it.qty),
      })))
    })()
  }, [id])

  const filtered = useMemo(() => {
    const q = f.q.toLowerCase()
    return products.filter((p) =>
      (!f.cat || categoryOf(p) === f.cat) &&
      (!f.type || p.type === f.type) &&
      (!f.air || p.air_quality === f.air) &&
      (!q || `${p.model} ${p.tpl} ${p.type}`.toLowerCase().includes(q)))
  }, [products, f])

  const opts = (key) => [...new Set(products.map((p) => p[key]).filter(Boolean))].sort()
  const catOpts = useMemo(() => sortCategories([...new Set(products.map(categoryOf))]), [products])

  function addProduct(p) {
    if (!p.cost_rm) { toast(`Set a cost for ${p.model} in the Catalog before quoting it.`, 'warn'); return }
    setItems((prev) => {
      const i = prev.findIndex((it) => it.product_id === p.id)
      if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c }
      return [...prev, {
        product_id: p.id, model: p.model, description: p.type, is_custom: false, title: '',
        unit_cost: Number(p.cost_rm) || 0, markup_pct: 0, qty: 1,
      }]
    })
  }
  function addCustom() {
    setItems((prev) => [...prev, {
      product_id: null, model: null, is_custom: true, title: '', description: '',
      unit_price: 0, unit_cost: 0, markup_pct: 0, qty: 1,
    }])
  }
  const updateItem = (i, patch) => setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i))

  // Equipment first, then custom lines (everywhere: editor, totals, PDF). Keep original index for edits.
  const ordered = useMemo(
    () => items.map((it, idx) => ({ it, idx })).sort((a, b) => (a.it.is_custom ? 1 : 0) - (b.it.is_custom ? 1 : 0)),
    [items],
  )

  const totals = useMemo(() => quoteTotals(items, head.tax_pct), [items, head.tax_pct])
  const totalCost = totals.cost
  const marginPct = totals.subtotal > 0 ? ((totals.subtotal - totals.cost) / totals.subtotal) * 100 : null
  const customer = customers.find((c) => c.id === head.customer_id)
  const company = profile?.company_name || 'Our brand'

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const docItems = useMemo(
    () => ordered.map(({ it }) => {
      const product = it.is_custom ? null : productById[it.product_id] || null
      return { ...it, product, lead_time_weeks: product?.lead_time_weeks }
    }),
    [ordered, productById],
  )
  const lead = useMemo(() => longestLead(docItems), [docItems])

  function changeStatus(s) {
    setHead((h) => ({ ...h, status: s }))
    if (s === 'won' || s === 'lost') setShowOutcome(s)
  }

  async function save() {
    if (items.length === 0) return toast('Add at least one item.', 'warn')
    setBusy(true)
    const isOutcome = head.status === 'won' || head.status === 'lost'
    const payload = {
      quote_no: head.quote_no, customer_id: head.customer_id || null, salesperson_id: user.id,
      quote_date: head.quote_date, valid_until: head.valid_until, status: head.status,
      tax_pct: Number(head.tax_pct) || 0, subtotal: totals.subtotal, total: totals.total,
      notes: head.notes, terms: head.terms,
      outcome_reason: isOutcome ? head.outcome_reason || null : null,
      outcome_reason_note: isOutcome ? head.outcome_reason_note || null : null,
      competitor: isOutcome ? head.competitor || null : null,
      competitor_note: isOutcome ? head.competitor_note || null : null,
    }
    let quoteId = id
    if (id) {
      const { error } = await supabase.from('quotations').update(payload).eq('id', id)
      if (error) { setBusy(false); return toast(error.message, 'error') }
    } else {
      const { data, error } = await supabase.from('quotations').insert(payload).select('id').single()
      if (error) { setBusy(false); return toast(error.message, 'error') }
      quoteId = data.id
    }
    await supabase.from('quotation_items').delete().eq('quotation_id', quoteId)
    const rows = ordered.map(({ it }, idx) => ({
      quotation_id: quoteId, product_id: it.product_id, model: it.model,
      is_custom: !!it.is_custom, title: it.title || null, description: it.description,
      unit_price: sellingUnit(it), unit_cost: Number(it.unit_cost) || 0, markup_pct: Number(it.markup_pct) || 0,
      qty: it.qty, line_total: lineNet(it), position: idx,
    }))
    const { error: ie } = await supabase.from('quotation_items').insert(rows)
    setBusy(false)
    if (ie) return toast(ie.message, 'error')
    navigate(`/quotes/${quoteId}`, { replace: true })
    toast('Quote saved.', 'success')
  }

  const downloadPDF = () => generateQuotePDF({ quote: head, items: docItems, customer, profile })

  function emailDraft() {
    const lines = docItems.map((it) => `- ${itemLabel(it)} x${it.qty}: ${RM(lineNet(it))}`).join('\n')
    const body = `Dear ${customer?.contact_person || 'Sir/Madam'},\n\nPlease find our quotation ${head.quote_no}:\n\n${lines}\n\nTotal (MYR): ${RM(totals.total)}\nValid until: ${fmtDate(head.valid_until)}\n\n(Quotation PDF attached.)\n\nRegards,\n${profile?.full_name || ''}\n${profile?.company_name || ''}`
    window.location.href = `mailto:${customer?.email || ''}?subject=${encodeURIComponent('Quotation ' + head.quote_no)}&body=${encodeURIComponent(body)}`
  }

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      {/* LEFT: catalog + line items */}
      <div className="space-y-6">
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Product catalog</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <input className="input col-span-2 md:col-span-1" placeholder="Search model…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <Select value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })} placeholder="All categories" options={catOpts} />
            <Select value={f.air} onChange={(e) => setF({ ...f, air: e.target.value })} placeholder="All air quality" options={opts('air_quality')} />
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} placeholder="All types" options={opts('type')} />
          </div>
          <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
            {filtered.map((p) => (
              <div key={p.id} className="p-2.5 hover:bg-brand-light flex items-center justify-between gap-2">
                <button onClick={() => addProduct(p)} className="text-left min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {(p.brand || company)} {p.model}
                    <span className="badge bg-brand-light text-brand ml-1">{categoryOf(p)}</span>
                    {p.specs?.['Technology'] && <span className="badge bg-slate-100 text-slate-600 ml-1">{p.specs['Technology']}</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {[
                      p.kw ? `${num(p.kw)} kW` : null,
                      p.hp ? `${num(p.hp)} hp` : null,
                      p.specs?.['Loading Pressure'] ? `${num(p.specs['Loading Pressure'])} bar` : null,
                      p.cfm_max ? `${num(p.cfm_max)} CFM` : null,
                      p.specs?.['Max m3/min'] ? `${num(p.specs['Max m3/min'], 2)} m³/min` : null,
                    ].filter(Boolean).join(' · ')}
                    {!p.cost_rm ? ' · ⚠ no cost' : ''}
                  </div>
                </button>
                <button onClick={() => setSpecProduct(p)} className="text-xs text-slate-400 hover:text-brand px-1" title="View specs">ⓘ</button>
                <div className="text-sm font-semibold text-brand whitespace-nowrap">{p.price_rm ? RM(p.price_rm) : 'TBD'}</div>
                <button onClick={() => addProduct(p)} className="text-brand hover:text-brand-dark font-bold px-1" title="Add">＋</button>
              </div>
            ))}
            {filtered.length === 0 && <div className="p-3 text-sm text-slate-400">No matching products.</div>}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Line items</h2>
            <button onClick={addCustom} className="btn-ghost py-1 px-2 text-xs">+ Add custom line / service</button>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">Click products above, or add a custom line (e.g. M&amp;E / civil works).</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-500 px-1">
                <div className="col-span-3">Equipment</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-2">Cost (RM)</div>
                <div className="col-span-2">Markup %</div>
                <div className="col-span-2 text-right">Unit, RM</div>
                <div className="col-span-2 text-right">Sub Total, RM</div>
              </div>
              {ordered.map(({ it, idx }) => (
                it.is_custom ? (
                  <div key={idx} className="border border-amber-200 bg-amber-50/40 rounded-md p-2 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <input className="input py-1 col-span-5 text-sm" placeholder="Title (shown on quote line, e.g. M&E Works)" value={it.title} onChange={(e) => updateItem(idx, { title: e.target.value })} />
                      <input type="number" min="1" className="input py-1 col-span-2" value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} />
                      <input type="number" className="input py-1 col-span-3" placeholder="Unit RM" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} />
                      <div className="col-span-2 text-right text-sm font-medium flex items-center justify-end gap-2">
                        {num(lineNet(it), 2)}
                        <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">✕</button>
                      </div>
                    </div>
                    <textarea className="input py-1 text-sm" rows={2} placeholder="Full description — shown on its own page at the back of the quote" value={it.description || ''} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                    <div className="text-[11px] text-amber-700">Custom line · prints after equipment, with a description page</div>
                  </div>
                ) : (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3 min-w-0">
                      <div className="text-sm font-medium truncate">{(productById[it.product_id]?.brand || company)} / {it.model}</div>
                    </div>
                    <input type="number" min="1" className="input py-1 col-span-1" value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} />
                    <input type="text" inputMode="numeric" className="input py-1 col-span-2"
                      value={it.unit_cost ? Number(it.unit_cost).toLocaleString('en-US') : ''}
                      onChange={(e) => updateItem(idx, { unit_cost: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} />
                    <input type="number" className="input py-1 col-span-2" value={it.markup_pct} onChange={(e) => updateItem(idx, { markup_pct: Number(e.target.value) })} />
                    <div className="col-span-2 text-right text-xs text-slate-600">{num(sellingUnit(it), 2)}</div>
                    <div className="col-span-2 text-right text-sm font-medium flex items-center justify-end gap-2">
                      {num(lineNet(it), 2)}
                      <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">✕</button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: quote settings + totals */}
      <div className="space-y-6">
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Quotation</h2>
            <span className="text-xs text-slate-400">{head.quote_no}</span>
          </div>
          <div>
            <label className="label">Customer</label>
            <select className="input" value={head.customer_id} onChange={(e) => setHead({ ...head, customer_id: e.target.value })}>
              <option value="">— select —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
            <a href="#/customers" className="text-xs text-brand hover:underline">+ manage customers</a>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Labeled label="Date"><input type="date" className="input" value={head.quote_date} onChange={(e) => setHead({ ...head, quote_date: e.target.value })} /></Labeled>
            <Labeled label="Valid until"><input type="date" className="input" value={head.valid_until} onChange={(e) => setHead({ ...head, valid_until: e.target.value })} /></Labeled>
            <Labeled label="Status">
              <select className="input" value={head.status} onChange={(e) => changeStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Labeled>
            <Labeled label="Tax / SST %"><input type="number" className="input" value={head.tax_pct} onChange={(e) => setHead({ ...head, tax_pct: Number(e.target.value) })} /></Labeled>
          </div>
          {(head.status === 'won' || head.status === 'lost') && (
            <div className="text-xs bg-slate-50 border rounded px-2 py-1.5 flex items-center justify-between">
              <span className="text-slate-600">
                {head.status === 'won' ? 'Won' : 'Lost'} · {reasonLabel(head)} · vs {competitorLabel(head)}
              </span>
              <button className="text-brand hover:underline" onClick={() => setShowOutcome(head.status)}>edit</button>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <label className="label mb-0">Terms &amp; conditions</label>
              <button className="text-slate-400 hover:text-brand text-sm" title="Templates" onClick={() => setShowTemplates(true)}>✎</button>
            </div>
            <textarea className="input mt-1" rows={3} value={head.terms} onChange={(e) => setHead({ ...head, terms: e.target.value })} />
          </div>
        </div>

        <div className="card p-4 space-y-1.5 text-sm">
          <Row label="Subtotal" value={RM(totals.subtotal)} />
          {head.tax_pct > 0 && <Row label={`Tax (${head.tax_pct}%)`} value={RM(totals.tax)} />}
          <div className="border-t pt-2 mt-1 flex justify-between font-bold text-base">
            <span>Total</span><span className="text-brand">{RM(totals.total)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-dashed mt-1">
            <span>Total cost (internal)</span><span>{RM(totalCost)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Margin (internal)</span>
            <span className={marginPct === null ? 'text-slate-400' : marginPct < minMargin ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>
              {marginPct === null ? '—' : `${marginPct.toFixed(1)}%`}
            </span>
          </div>
          {lead && (
            <div className="text-[11px] text-brand-dark bg-brand-light rounded px-2 py-1 mt-1">
              Lead time based on equipment <b>{lead.model}</b>: {leadText(lead.weeks)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : id ? 'Update quote' : 'Save quote'}</button>
          <button className="btn-ghost" disabled={items.length === 0} onClick={() => setShowReview(true)}>Preview / Review</button>
          <button className="btn-ghost" disabled={items.length === 0} onClick={downloadPDF}>Download PDF</button>
          <button className="btn-ghost" disabled={items.length === 0} onClick={emailDraft}>Email draft (attach PDF)</button>
        </div>
      </div>

      <SpecModal product={specProduct} onClose={() => setSpecProduct(null)} />
      {showReview && (
        <QuoteReview
          quote={head} items={docItems} customer={customer} profile={profile}
          onClose={() => setShowReview(false)} onDownload={downloadPDF}
        />
      )}
      {showOutcome && (
        <OutcomeModal
          mode={showOutcome} initial={head}
          onSave={(fields) => { setHead((h) => ({ ...h, ...fields })); setShowOutcome(null) }}
          onCancel={() => setShowOutcome(null)}
        />
      )}
      {showTemplates && (
        <TermsTemplateModal
          onApply={(body) => setHead((h) => ({ ...h, terms: body }))}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  )
}

function Select({ placeholder, options, ...props }) {
  return (
    <select className="input" {...props}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}
function Labeled({ label, children }) {
  return <div><label className="label">{label}</label>{children}</div>
}
function Row({ label, value }) {
  return <div className="flex justify-between"><span>{label}</span><span>{value}</span></div>
}
