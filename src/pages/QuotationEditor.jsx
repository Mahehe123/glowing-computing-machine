import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RM, num } from '../lib/format'
import { lineNet, quoteTotals } from '../lib/pricing'
import { STATUSES } from '../lib/status'
import { categoryOf, sortCategories } from '../lib/categories'
import { longestLead, leadText } from '../lib/quoteDoc'
import { generateQuotePDF } from '../lib/pdf'
import SpecModal from '../components/SpecModal'
import QuoteReview from '../components/QuoteReview'

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

  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)

  const [head, setHead] = useState({
    quote_no: newQuoteNo(),
    customer_id: '',
    quote_date: todayISO(),
    valid_until: plusDays(30),
    status: 'draft',
    quote_discount_pct: 0,
    tax_pct: 0,
    notes: '',
    terms: '',
  })

  // filters
  const [f, setF] = useState({ q: '', cat: '', type: '', air: '' })
  const [specProduct, setSpecProduct] = useState(null)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    supabase.from('products').select('*').order('series').then(({ data }) => setProducts(data || []))
    supabase.from('customers').select('*').order('company').then(({ data }) => setCustomers(data || []))
  }, [])

  // default terms from profile (only for a brand-new quote)
  useEffect(() => {
    if (!id && profile?.default_terms) setHead((h) => (h.terms ? h : { ...h, terms: profile.default_terms }))
  }, [profile, id])

  // load existing quote
  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: q } = await supabase.from('quotations').select('*').eq('id', id).single()
      if (q) setHead({
        quote_no: q.quote_no, customer_id: q.customer_id || '', quote_date: q.quote_date,
        valid_until: q.valid_until, status: q.status, quote_discount_pct: q.quote_discount_pct || 0,
        tax_pct: q.tax_pct || 0, notes: q.notes || '', terms: q.terms || '',
      })
      const { data: its } = await supabase.from('quotation_items').select('*').eq('quotation_id', id).order('position')
      setItems((its || []).map((it) => ({
        product_id: it.product_id, model: it.model, description: it.description,
        unit_price: Number(it.unit_price), unit_cost: Number(it.unit_cost) || 0, qty: Number(it.qty),
        adjust_type: it.adjust_type || 'discount', adjust_pct: Number(it.adjust_pct) || 0,
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
    setItems((prev) => {
      const i = prev.findIndex((it) => it.product_id === p.id)
      if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c }
      return [...prev, {
        product_id: p.id, model: p.model, description: p.type,
        unit_price: Number(p.price_rm) || 0, unit_cost: Number(p.cost_rm) || 0,
        qty: 1, adjust_type: 'discount', adjust_pct: 0,
      }]
    })
  }
  const updateItem = (i, patch) => setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i))

  const totals = useMemo(() => quoteTotals(items, head.quote_discount_pct, head.tax_pct), [items, head])
  const customer = customers.find((c) => c.id === head.customer_id)

  // Enrich each line with its full product record (specs + lead time) for the PDF / review.
  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const docItems = useMemo(
    () => items.map((it) => {
      const product = productById[it.product_id] || null
      return { ...it, product, lead_time_weeks: product?.lead_time_weeks }
    }),
    [items, productById],
  )
  const lead = useMemo(() => longestLead(docItems), [docItems])

  async function save() {
    if (items.length === 0) return alert('Add at least one product.')
    setBusy(true)
    const payload = {
      quote_no: head.quote_no, customer_id: head.customer_id || null, salesperson_id: user.id,
      quote_date: head.quote_date, valid_until: head.valid_until, status: head.status,
      quote_discount_pct: Number(head.quote_discount_pct) || 0, tax_pct: Number(head.tax_pct) || 0,
      subtotal: totals.subtotal, total: totals.total, notes: head.notes, terms: head.terms,
    }
    let quoteId = id
    if (id) {
      const { error } = await supabase.from('quotations').update(payload).eq('id', id)
      if (error) { setBusy(false); return alert(error.message) }
    } else {
      const { data, error } = await supabase.from('quotations').insert(payload).select('id').single()
      if (error) { setBusy(false); return alert(error.message) }
      quoteId = data.id
    }
    await supabase.from('quotation_items').delete().eq('quotation_id', quoteId)
    const rows = items.map((it, idx) => ({
      quotation_id: quoteId, product_id: it.product_id, model: it.model, description: it.description,
      unit_price: it.unit_price, unit_cost: Number(it.unit_cost) || 0, qty: it.qty,
      adjust_type: it.adjust_type, adjust_pct: Number(it.adjust_pct) || 0,
      line_total: lineNet(it), position: idx,
    }))
    const { error: ie } = await supabase.from('quotation_items').insert(rows)
    setBusy(false)
    if (ie) return alert(ie.message)
    navigate(`/quotes/${quoteId}`, { replace: true })
    alert('Quote saved.')
  }

  function downloadPDF() {
    generateQuotePDF({ quote: head, items: docItems, customer, profile })
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
                  <div className="text-sm font-medium truncate">{p.model} <span className="badge bg-brand-light text-brand ml-1">{categoryOf(p)}</span></div>
                  <div className="text-xs text-slate-500 truncate">{p.type}{p.kw ? ` · ${p.kw}kW/${p.hp}hp` : ''}{p.cfm_max ? ` · ${num(p.cfm_max)} CFM` : ''}{p.lead_time_weeks ? ` · Lead: ${p.lead_time_weeks} wks` : ''}</div>
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
          <h2 className="font-semibold mb-3">Line items</h2>
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">Click products above to add them.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-500 px-1">
                <div className="col-span-4">Item</div><div className="col-span-1">Qty</div>
                <div className="col-span-2">Unit (RM)</div><div className="col-span-3">Adjustment</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <input className="input py-1 text-sm" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
                    <div className="text-[11px] text-slate-400 mt-0.5">{it.model}</div>
                  </div>
                  <input type="number" min="1" className="input py-1 col-span-1" value={it.qty} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })} />
                  <input type="number" className="input py-1 col-span-2" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })} />
                  <div className="col-span-3 flex gap-1">
                    <select className="input py-1 w-24" value={it.adjust_type} onChange={(e) => updateItem(i, { adjust_type: e.target.value })}>
                      <option value="discount">Disc %</option>
                      <option value="markup">Markup %</option>
                    </select>
                    <input type="number" className="input py-1" value={it.adjust_pct} onChange={(e) => updateItem(i, { adjust_pct: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium flex items-center justify-end gap-2">
                    {RM(lineNet(it))}
                    <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700">✕</button>
                  </div>
                </div>
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
              <select className="input" value={head.status} onChange={(e) => setHead({ ...head, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Labeled>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Labeled label="Quote discount %"><input type="number" className="input" value={head.quote_discount_pct} onChange={(e) => setHead({ ...head, quote_discount_pct: Number(e.target.value) })} /></Labeled>
            <Labeled label="Tax / SST %"><input type="number" className="input" value={head.tax_pct} onChange={(e) => setHead({ ...head, tax_pct: Number(e.target.value) })} /></Labeled>
          </div>
          <Labeled label="Terms & conditions"><textarea className="input" rows={3} value={head.terms} onChange={(e) => setHead({ ...head, terms: e.target.value })} /></Labeled>
        </div>

        <div className="card p-4 space-y-1.5 text-sm">
          <Row label="List value" value={RM(totals.listValue)} muted />
          <Row label="Subtotal (after line adj.)" value={RM(totals.subtotal)} />
          {head.quote_discount_pct > 0 && <Row label={`Quote discount (${head.quote_discount_pct}%)`} value={`- ${RM(totals.quoteDiscount)}`} />}
          {head.tax_pct > 0 && <Row label={`Tax (${head.tax_pct}%)`} value={RM(totals.tax)} />}
          <div className="border-t pt-2 mt-1 flex justify-between font-bold text-base">
            <span>Total</span><span className="text-brand">{RM(totals.total)}</span>
          </div>
          {totals.listValue > totals.subtotal && (
            <div className="text-[11px] text-amber-600 pt-1">
              You're giving away {RM(totals.listValue - totals.subtotal)} ({((1 - totals.subtotal / totals.listValue) * 100).toFixed(1)}%) in line discounts.
            </div>
          )}
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
        </div>
      </div>

      <SpecModal product={specProduct} onClose={() => setSpecProduct(null)} />
      {showReview && (
        <QuoteReview
          quote={head} items={docItems} customer={customer} profile={profile}
          onClose={() => setShowReview(false)} onDownload={downloadPDF}
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
function Row({ label, value, muted }) {
  return <div className={`flex justify-between ${muted ? 'text-slate-400' : ''}`}><span>{label}</span><span>{value}</span></div>
}
