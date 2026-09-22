import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronRight, CircleDollarSign, Filter, HeartHandshake, RefreshCcw, Search, Trophy, X } from "lucide-react"
import "./past-draws-page.css"
import { apiFetch } from "./apiBase"

const emptyArchive = { draws: [], total: 0, limit: 8, offset: 0, hasMore: false, months: [], charityImpact: { totalMinor: 0, charities: [] } }

async function readJson(path) {
  const response = await apiFetch(path)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "The public archive could not be loaded.")
  return data
}

function money(minor) {
  return `INR ${(Number(minor || 0) / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

function DrawCard({ draw, selected, onSelect }) {
  return <button aria-pressed={selected} className={`draw-archive-card ${selected ? "draw-archive-card-selected" : ""}`} onClick={() => onSelect(draw.id)} type="button"><div className="draw-card-meta"><span>{draw.month}</span><span>{draw.status}</span></div><div className="draw-card-heading"><strong>Draw {draw.month.replace("-", " / ")}</strong><ChevronRight size={18} /></div><div className="draw-number-row">{draw.winningNumbers.length ? draw.winningNumbers.map((number) => <span key={number}>{number}</span>) : <span className="draw-number-empty">Results pending</span>}</div><div className="draw-card-footer"><span><CircleDollarSign size={14} /> {money(draw.poolMinor)} pool</span><span><Trophy size={14} /> {draw.winnerCount} winners</span></div></button>
}

function ImpactPanel({ impact, onPlans }) {
  const total = Number(impact.totalMinor || 0)
  return <aside className="impact-ledger-panel"><div className="draws-panel-kicker"><span className="eyebrow-line" /> Charity impact ledger</div><div className="impact-total"><span>Total contribution</span><strong>{money(total)}</strong><small>{impact.charities.reduce((sum, item) => sum + item.contributionCount, 0)} recorded contribution{impact.charities.reduce((sum, item) => sum + item.contributionCount, 0) === 1 ? "" : "s"}</small></div><div className="impact-charity-list">{impact.charities.length ? impact.charities.map((item) => { const percentage = total ? Math.max(4, Math.round((item.amountMinor / total) * 100)) : 0; return <div className="impact-charity" key={item.charity}><div><span>{item.charity}</span><strong>{money(item.amountMinor)}</strong></div><i><i style={{ width: `${percentage}%` }} /></i><small>{item.contributionCount} contribution{item.contributionCount === 1 ? "" : "s"}</small></div> }) : <p className="draws-muted">No contribution records yet.</p>}</div><div className="impact-panel-footer"><HeartHandshake size={18} /><span>At least 10% of active membership flows to a chosen cause.</span></div><button className="button button-light full-width" onClick={onPlans} type="button">See membership plans <ArrowUpRight size={15} /></button></aside>
}

function DrawDetail({ draw, loading, onClose }) {
  if (loading) return <aside className="draw-detail-panel"><div className="draw-detail-loading">Loading draw detail…</div></aside>
  if (!draw) return <aside className="draw-detail-panel draw-detail-empty"><CalendarDays size={23} /><strong>Select a published draw</strong><span>Winning numbers, prize tiers, and pool history will open here.</span></aside>
  const tiers = Array.isArray(draw.tiers) ? draw.tiers : Object.entries(draw.tiers || {}).map(([matchType, item]) => ({ matchType, winnerCount: item.winnerCount, prizeMinor: item.prizeMinor }))
  return <aside className="draw-detail-panel"><div className="draw-detail-top"><div><span className="draws-panel-kicker">Draw detail / {draw.month}</span><h2>{draw.winningNumbers.join(" · ")}</h2></div><button aria-label="Close draw detail" className="draw-icon-button" onClick={onClose} type="button"><X size={17} /></button></div><div className="draw-detail-numbers">{draw.winningNumbers.map((number) => <span key={number}>{number}</span>)}</div><div className="draw-detail-stats"><div><span>Prize pool</span><strong>{money(draw.poolMinor)}</strong></div><div><span>Winners</span><strong>{draw.winnerCount}</strong></div><div><span>Entries</span><strong>{draw.entriesCount || "—"}</strong></div></div><div className="draw-tier-list"><div className="draw-tier-heading"><span>Match tier</span><span>Prize total</span></div>{tiers.length ? tiers.map((tier) => <div className="draw-tier-row" key={tier.matchType}><span>{tier.matchType}</span><strong>{money(tier.prizeMinor)}</strong><small>{tier.winnerCount} winner{tier.winnerCount === 1 ? "" : "s"}</small></div>) : <p className="draws-muted">No winning tiers were recorded.</p>}</div><div className="draw-detail-foot"><span>Published {draw.publishedAt ? new Date(draw.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span><span>{draw.mode} selection</span></div></aside>
}

export default function PastDrawsPage() {
  const [archive, setArchive] = useState(emptyArchive)
  const [query, setQuery] = useState("")
  const [month, setMonth] = useState("")
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDraw, setSelectedDraw] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const filtersRef = useRef({ query: "", month: "" })
  const requestRef = useRef(0)
  filtersRef.current = { query, month }

  async function loadArchive({ append = false, silent = false } = {}) {
    const requestId = ++requestRef.current
    if (!silent) setLoading(true)
    const params = new URLSearchParams({ limit: "8", offset: append ? String(archive.draws.length) : "0" })
    if (filtersRef.current.query) params.set("query", filtersRef.current.query)
    if (filtersRef.current.month) params.set("month", filtersRef.current.month)
    try {
      const data = await readJson(`/api/past-draws?${params}`)
      if (requestId !== requestRef.current) return
      setArchive((current) => append ? { ...data, draws: [...current.draws, ...data.draws] } : data)
      setError("")
    } catch (loadError) { if (requestId === requestRef.current) setError(loadError.message) } finally { if (!silent && requestId === requestRef.current) setLoading(false) }
  }

  async function selectDraw(id) {
    setSelectedId(id); setDetailLoading(true); setSelectedDraw(null)
    try { const data = await readJson(`/api/past-draws/${encodeURIComponent(id)}`); setSelectedDraw(data.draw) } catch (loadError) { setError(loadError.message) } finally { setDetailLoading(false) }
  }

  useEffect(() => { loadArchive(); const interval = window.setInterval(() => loadArchive({ silent: true }), 15000); return () => window.clearInterval(interval) }, [])
  useEffect(() => { const timer = window.setTimeout(() => loadArchive(), 250); return () => window.clearTimeout(timer) }, [query, month])

  const impact = archive.charityImpact || emptyArchive.charityImpact
  return <div className="draws-page"><header className="draws-header"><div className="draws-announcement"><span className="live-dot" /> Public archive / transparent by design <span><span className="live-dot" /> Live database</span></div><nav className="draws-nav container"><button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><div className="draws-nav-links"><button onClick={() => window.location.assign("/")} type="button">The signal</button><button onClick={() => window.location.assign("/subscription-scores")} type="button">Plans & scores</button><button className="nav-cta" onClick={() => window.location.assign("/objectives-roles")} type="button"><ArrowLeft size={15} /> Objectives</button></div></nav></header><main className="draws-main container"><section className="draws-hero"><div><p className="eyebrow"><span className="eyebrow-line" /> The public ledger / 005</p><h1>Past draws.<br /><em>Visible impact.</em></h1><p>Search every published result, see the numbers that moved the pool, and follow the contribution trail back to the causes people chose.</p><div className="draws-hero-actions"><button className="button button-primary" onClick={() => document.getElementById("draw-archive")?.scrollIntoView({ behavior: "smooth" })} type="button">Explore the archive <ChevronRight size={16} /></button><button className="text-button" onClick={() => document.getElementById("impact-ledger")?.scrollIntoView({ behavior: "smooth" })} type="button">See charity impact <HeartHandshake size={15} /></button></div></div><div className="draws-hero-figure"><div className="draws-figure-core"><Trophy size={27} /><span>PUBLIC<br />SIGNAL</span></div><span>NUMBERS / 01</span><span>POOL / 02</span><span>CAUSES / 03</span></div></section><section className="draws-stat-grid"><article><span>Published draws</span><strong>{archive.total}</strong><small>database records</small></article><article><span>Charity contributions</span><strong>{money(impact.totalMinor)}</strong><small>active and completed memberships</small></article><article><span>Latest result</span><strong>{archive.draws[0]?.month || "—"}</strong><small>{archive.draws[0] ? `${archive.draws[0].winnerCount} winners recorded` : "No published draw yet"}</small></article></section><section className="draws-content" id="draw-archive"><div className="draws-archive-column"><div className="draws-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Searchable archive</p><h2>Follow the<br /><em>signal back.</em></h2></div><button aria-label="Refresh archive" className="draw-refresh-button" disabled={loading} onClick={() => loadArchive()} type="button"><RefreshCcw className={loading ? "draw-refresh-spinning" : ""} size={16} /> Refresh</button></div><form className="draw-search-bar" onSubmit={(event) => { event.preventDefault(); loadArchive() }}><Search size={17} /><input aria-label="Search past draws" onChange={(event) => setQuery(event.target.value)} placeholder="Search by month or winning number" value={query} /><button aria-label="Clear search" disabled={!query} onClick={() => setQuery("")} type="button"><X size={15} /></button></form><div className="draw-filter-row"><label><Filter size={14} /> Month<select aria-label="Filter by month" onChange={(event) => setMonth(event.target.value)} value={month}><option value="">All published months</option>{archive.months.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><span>{loading ? "Updating archive…" : `${archive.total} result${archive.total === 1 ? "" : "s"}`}</span></div>{error ? <div className="draws-error" role="alert">{error}<button className="text-button" onClick={() => loadArchive()} type="button">Retry <RefreshCcw size={14} /></button></div> : null}<div className="draw-archive-list">{loading && !archive.draws.length ? <div className="draws-empty"><RefreshCcw className="draw-refresh-spinning" size={22} /><strong>Reading the public ledger…</strong></div> : archive.draws.length ? archive.draws.map((draw) => <DrawCard draw={draw} key={draw.id} onSelect={selectDraw} selected={selectedId === draw.id} />) : <div className="draws-empty"><CalendarDays size={23} /><strong>No published draws match.</strong><span>Try another month or winning number.</span></div>}</div>{archive.hasMore ? <button className="button button-quiet full-width" disabled={loading} onClick={() => loadArchive({ append: true })} type="button">Load more results <ChevronRight size={15} /></button> : null}</div><div className="draws-side-column" id="impact-ledger"><ImpactPanel impact={impact} onPlans={() => window.location.assign("/subscription-scores")} /><DrawDetail draw={selectedDraw} loading={detailLoading} onClose={() => { setSelectedId(null); setSelectedDraw(null) }} /></div></section></main><footer className="draws-footer container"><span>digital heroes / public archive</span><button className="text-button" onClick={() => window.location.assign("/")} type="button">Return to the main signal <ArrowUpRight size={14} /></button></footer></div>
}
