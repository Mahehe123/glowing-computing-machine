import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
  FunnelChart, Funnel, LabelList,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { RM, num, pct, daysBetween } from '../lib/format'
import { OPEN_STATUSES, STATUS_META } from '../lib/status'
import { reasonLabel, competitorLabel } from '../lib/outcome'

const STATUS_COLORS = { draft: '#94a3b8', sent: '#f59e0b', won: '#16a34a', lost: '#ef4444', expired: '#a855f7' }
const STACK = ['won', 'lost', 'sent', 'expired', 'draft']
const monthFmt = (k) => k // 'YYYY-MM'

export default function Dashboard() {
  const [quotes, setQuotes] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [{ data: q }, { data: it }] = await Promise.all([
        supabase.from('quotations').select('*, customers(company)'),
        supabase.from('quotation_items').select('unit_cost, qty, quotation_id, quotations(status)'),
      ])
      setQuotes(q || [])
      setItems(it || [])
      setLoading(false)
    })()
  }, [])

  const m = useMemo(() => {
    const won = quotes.filter((q) => q.status === 'won')
    const lost = quotes.filter((q) => q.status === 'lost')
    const open = quotes.filter((q) => OPEN_STATUSES.includes(q.status))
    const wonRevenue = won.reduce((s, q) => s + Number(q.total || 0), 0)
    const pipeline = open.reduce((s, q) => s + Number(q.total || 0), 0)
    const decided = won.length + lost.length
    const winRate = decided ? (won.length / decided) * 100 : 0
    const avgDeal = won.length ? wonRevenue / won.length : 0

    // gross margin (cost snapshotted on won quotes)
    const costByQuote = {}
    items.forEach((it) => {
      costByQuote[it.quotation_id] = (costByQuote[it.quotation_id] || 0) + (Number(it.unit_cost) || 0) * (Number(it.qty) || 0)
    })
    const wonCost = won.reduce((s, q) => s + (costByQuote[q.id] || 0), 0)
    const grossMargin = wonRevenue - wonCost
    const marginPct = wonRevenue ? (grossMargin / wonRevenue) * 100 : 0
    const hasCostData = wonCost > 0

    // funnel: count and value per stage (two separate charts)
    const funnel = ['draft', 'sent', 'won', 'lost'].map((s) => {
      const list = quotes.filter((q) => q.status === s)
      return { stage: STATUS_META[s].label, fill: STATUS_COLORS[s], count: list.length, value: Math.round(list.reduce((a, q) => a + Number(q.total || 0), 0)) }
    })

    // monthly stacked by status — counts and value
    const mc = {}, mv = {}
    quotes.forEach((q) => {
      const k = (q.quote_date || '').slice(0, 7)
      if (!k || STATUS_COLORS[q.status] === undefined) return
      mc[k] = mc[k] || { month: k, draft: 0, sent: 0, won: 0, lost: 0, expired: 0 }
      mv[k] = mv[k] || { month: k, draft: 0, sent: 0, won: 0, lost: 0, expired: 0 }
      mc[k][q.status] += 1
      mv[k][q.status] += Number(q.total || 0)
    })
    const byMonthCount = Object.values(mc).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
    const byMonthValue = Object.values(mv).sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
      .map((r) => ({ ...r, ...Object.fromEntries(STACK.map((s) => [s, Math.round(r[s])])) }))

    // win/loss breakdowns
    const breakdown = (list, fn) => {
      const map = {}
      list.forEach((q) => { const k = fn(q) === '—' ? 'Unspecified' : fn(q); map[k] = (map[k] || 0) + 1 })
      return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    }
    const win = { reason: breakdown(won, reasonLabel), brand: breakdown(won, competitorLabel) }
    const loss = { reason: breakdown(lost, reasonLabel), brand: breakdown(lost, competitorLabel) }

    const aging = open.map((q) => ({ ...q, age: daysBetween(q.quote_date), expIn: q.valid_until ? daysBetween(new Date(), q.valid_until) : null }))
      .sort((a, b) => b.age - a.age)

    const thisMonth = new Date().toISOString().slice(0, 7)
    const quotesThisMonth = quotes.filter((q) => (q.quote_date || '').startsWith(thisMonth)).length

    return { wonRevenue, grossMargin, marginPct, hasCostData, pipeline, winRate, avgDeal,
      funnel, byMonthCount, byMonthValue, win, loss, aging, quotesThisMonth, wonCount: won.length, lostCount: lost.length }
  }, [quotes, items])

  if (loading) return <div className="text-slate-500">Loading dashboard…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Sales Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Won revenue" value={RM(m.wonRevenue)} sub={`${m.wonCount} deals`} />
        <Kpi label="Gross margin" value={m.hasCostData ? RM(m.grossMargin) : '—'} sub={m.hasCostData ? pct(m.marginPct) : 'add costs in Catalog'} accent />
        <Kpi label="Open pipeline" value={RM(m.pipeline)} sub="live quotes" />
        <Kpi label="Win rate" value={pct(m.winRate)} sub="won / decided" />
        <Kpi label="Avg deal size" value={RM(m.avgDeal)} />
        <Kpi label="Quotes this month" value={num(m.quotesThisMonth)} />
      </div>

      {/* Funnel — quantity and value, funnel-chart style */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Pipeline funnel — quantity" hint="Number of quotes per stage">
          <ResponsiveContainer width="100%" height={260}>
            <FunnelChart>
              <Tooltip formatter={(v) => [v, 'Quotes']} />
              <Funnel dataKey="count" data={m.funnel} isAnimationActive={false}>
                <LabelList position="right" dataKey="stage" fill="#334155" stroke="none" fontSize={12} />
                <LabelList position="center" dataKey="count" fill="#fff" stroke="none" fontSize={13} fontWeight="bold" />
                {m.funnel.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Pipeline funnel — value" hint="Total value (RM) per stage">
          <ResponsiveContainer width="100%" height={260}>
            <FunnelChart>
              <Tooltip formatter={(v) => [RM(v), 'Value']} />
              <Funnel dataKey="value" data={m.funnel} isAnimationActive={false}>
                <LabelList position="right" dataKey="stage" fill="#334155" stroke="none" fontSize={12} />
                <LabelList position="center" dataKey="value" fill="#fff" stroke="none" fontSize={12} fontWeight="bold" formatter={(v) => `${Math.round(v / 1000)}k`} />
                {m.funnel.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Monthly stacked: count + value */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Quotes per month" hint="Count, stacked by status (full bar = all quotes)">
          <MonthlyStacked data={m.byMonthCount} valueFmt={(v) => v} />
        </Panel>
        <Panel title="Quote value per month" hint="RM, stacked by status">
          <MonthlyStacked data={m.byMonthValue} valueFmt={(v) => RM(v)} yTick={(v) => `${v / 1000}k`} />
        </Panel>
      </div>

      {/* Win / Loss analysis */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Why we win" hint={`${m.wonCount} won deals`}>
          <Breakdown title="By reason" data={m.win.reason} color="#16a34a" />
          <Breakdown title="Won against" data={m.win.brand} color="#0f4c81" />
        </Panel>
        <Panel title="Why we lose" hint={`${m.lostCount} lost deals`}>
          <Breakdown title="By reason" data={m.loss.reason} color="#ef4444" />
          <Breakdown title="Lost to" data={m.loss.brand} color="#a855f7" />
        </Panel>
      </div>

      {/* Action list */}
      <Panel title="Needs follow-up" hint="Open quotes, oldest first — your daily action list">
        {m.aging.length === 0 ? <Empty msg="Nothing open. 🎉" /> : (
          <div className="divide-y">
            {m.aging.slice(0, 8).map((q) => (
              <div key={q.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <Link to={`/quotes/${q.id}`} className="text-brand font-medium hover:underline">{q.quote_no}</Link>
                  <span className="text-slate-500 ml-2">{q.customers?.company || '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{RM(q.total)}</span>
                  <span className="text-xs text-slate-400">{q.age}d old</span>
                  {q.expIn !== null && q.expIn <= 7 && (
                    <span className="badge bg-amber-100 text-amber-700">{q.expIn < 0 ? 'expired' : `exp ${q.expIn}d`}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function MonthlyStacked({ data, valueFmt, yTick }) {
  if (!data.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" fontSize={11} tickFormatter={monthFmt} />
        <YAxis fontSize={11} allowDecimals={false} tickFormatter={yTick} />
        <Tooltip formatter={(v, n) => [valueFmt(v), STATUS_META[n]?.label || n]} />
        <Legend formatter={(n) => STATUS_META[n]?.label || n} wrapperStyle={{ fontSize: 11 }} />
        {STACK.map((s) => <Bar key={s} dataKey={s} stackId="a" fill={STATUS_COLORS[s]} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

function Breakdown({ title, data, color }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-xs font-semibold text-slate-400 mb-1">{title}</div>
      {data.length === 0 ? <div className="text-sm text-slate-400">No data yet.</div> : data.map((d) => (
        <div key={d.name} className="flex items-center gap-2 mb-1">
          <div className="w-28 text-xs text-slate-600 truncate">{d.name}</div>
          <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <div className="w-6 text-xs text-right font-medium">{d.value}</div>
        </div>
      ))}
    </div>
  )
}

function Kpi({ label, value, sub, accent }) {
  return (
    <div className={`card p-4 ${accent ? 'ring-1 ring-brand/30' : ''}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}
function Panel({ title, hint, children }) {
  return (
    <div className="card p-4">
      <div className="mb-2">
        <h2 className="font-semibold text-sm">{title}</h2>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
function Empty({ msg = 'No data yet.' }) {
  return <div className="h-40 flex items-center justify-center text-sm text-slate-400">{msg}</div>
}
