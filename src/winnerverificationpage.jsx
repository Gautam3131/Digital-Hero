import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Sparkles as SparkleField } from "@react-three/drei"
import { ArrowLeft, ArrowUpRight, BadgeCheck, Banknote, Check, ChevronRight, Clock3, ExternalLink, FileCheck2, History, LockKeyhole, LogOut, RefreshCcw, Search, ShieldCheck, WalletCards, X } from "lucide-react"
import "./winner-verification-page.css"
import { apiFetch } from "./apiBase"

const emptyWorkflow = { metrics: { total: 0, pending: 0, verified: 0, rejected: 0, paid: 0, pendingValueMinor: 0, verifiedValueMinor: 0, paidValueMinor: 0 }, winners: [], events: [], storage: { configured: false, provider: "MongoDB Atlas Data API" } }

async function api(path, options = {}) {
  const response = await apiFetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "The winner workflow could not complete that request.")
  return data
}

const money = (minor) => `INR ${Math.round(Number(minor || 0) / 100).toLocaleString("en-IN")}`
const dateTime = (value) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(value)) : "—"

function LoginPanel({ onLogin }) {
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")
  async function submit(event) {
    event.preventDefault(); setStatus("loading"); setMessage("")
    const form = new FormData(event.currentTarget)
    try { const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) }); if (!data.member || data.member.role !== "admin") throw new Error("Administrator access is required for the verification console."); onLogin(data.member) } catch (error) { setMessage(error.message || "Administrator sign-in could not be completed."); setStatus("error") }
  }
  return <main className="winner-login"><div className="winner-login-card"><div className="winner-brand"><span className="wordmark-dot" /> digital <strong>heroes</strong></div><p className="eyebrow"><span className="eyebrow-line" /> Winner operations / 006</p><h1>Proof before<br /><em>payout.</em></h1><p>Sign in as an administrator to review evidence, record a decision, and complete the controlled payment handoff.</p><form onSubmit={submit}><label>Email<input autoComplete="email" name="email" placeholder="admin@example.com" required type="email" /></label><label>Password<input autoComplete="current-password" name="password" placeholder="Your password" required type="password" /></label>{status === "error" ? <p className="winner-error" role="alert">{message}</p> : null}<button className="button button-primary full-width" disabled={status === "loading"} type="submit">{status === "loading" ? "Opening proofroom..." : "Enter proofroom"}<ArrowUpRight size={16} /></button></form><button className="text-button winner-back-link" onClick={() => window.location.assign("/admin-dashboard")} type="button"><ArrowLeft size={15} /> Back to control room</button></div></main>
}

function SignalScene({ metrics, focus, onFocus }) {
  const group = useRef(null)
  useFrame((state, delta) => { if (!group.current) return; group.current.rotation.y += delta * 0.035; group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.24) * 0.05 })
  const nodes = [{ key: "pending", value: metrics.pending, position: [-1.55, .95, .2], color: "#ff715b" }, { key: "verified", value: metrics.verified, position: [1.55, .82, .25], color: "#d7fa6b" }, { key: "paid", value: metrics.paid, position: [0, -1.3, .4], color: "#74d5d8" }]
  return <group ref={group}><SparkleField count={68} scale={[8, 6, 4]} size={1.5} speed={.15} color="#d7fa6b" opacity={.32} /><mesh><icosahedronGeometry args={[1.15, 2]} /><meshPhysicalMaterial color="#d7fa6b" emissive="#465e1f" emissiveIntensity={.84} metalness={.24} roughness={.3} transparent opacity={.91} /></mesh><mesh rotation={[Math.PI / 2.1, .25, 0]} scale={1.47}><torusGeometry args={[1.05, .014, 10, 96]} /><meshBasicMaterial color="#74d5d8" transparent opacity={.4} /></mesh><mesh rotation={[.4, Math.PI / 2.8, 0]} scale={1.72}><torusGeometry args={[1.05, .01, 10, 96]} /><meshBasicMaterial color="#ff715b" transparent opacity={.3} /></mesh>{nodes.map((node) => <group key={node.key} position={node.position}><mesh scale={focus === node.key ? 1.45 : 1} onClick={(event) => { event.stopPropagation(); onFocus(node.key) }} onPointerOver={() => { document.body.style.cursor = "pointer" }} onPointerOut={() => { document.body.style.cursor = "default" }}><sphereGeometry args={[.16, 24, 24]} /><meshBasicMaterial color={node.color} /></mesh></group>)}</group>
}

function SignalCanvas({ metrics, focus, onFocus }) {
  return <div className="winner-signal-canvas"><Canvas camera={{ position: [0, 0, 6.2], fov: 35 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => gl.setClearColor("#000000", 0)}><ambientLight intensity={.8} /><pointLight color="#d7fa6b" intensity={10} distance={9} position={[3, 3, 3]} /><pointLight color="#ff715b" intensity={6} distance={8} position={[-3, -2, 2]} /><SignalScene focus={focus} metrics={metrics} onFocus={onFocus} /><OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI * .68} minPolarAngle={Math.PI * .32} rotateSpeed={.65} /></Canvas><span className="winner-signal-hint">drag to orbit / select a state</span></div>
}

function ActionModal({ action, winner, onClose, onSubmit, loading }) {
  const isPayout = action === "payout"
  return <div className="winner-modal-backdrop" role="presentation" onMouseDown={onClose}><section aria-modal="true" className="winner-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close action dialog" className="winner-modal-close" onClick={onClose} type="button"><X size={18} /></button><p className="eyebrow"><span className="eyebrow-line" /> {isPayout ? "Payout release" : action === "verified" ? "Approve evidence" : "Reject evidence"}</p><h2>{isPayout ? "Release the reward." : action === "verified" ? "The proof checks out?" : "Send it back for review."}</h2><p className="winner-modal-copy">{winner.name} / {winner.month} / {winner.matchType} / {money(winner.prizeMinor)}</p><form className="winner-modal-form" onSubmit={onSubmit}>{isPayout ? <><label>Provider<select defaultValue="bank_transfer" name="provider"><option value="bank_transfer">Bank transfer</option><option value="manual">Manual payout</option><option value="stripe">Stripe payout</option></select></label><label>Payout reference<input defaultValue={`payout-${winner.id.slice(-8)}`} name="payoutReference" pattern="[a-zA-Z0-9._:-]{3,120}" required /></label><p className="winner-modal-note"><Banknote size={15} /> The payout amount is locked to {money(winner.prizeMinor)}.</p></> : <label>{action === "verified" ? "Review note / optional" : "Reason for rejection"}<textarea minLength={action === "verified" ? undefined : 5} name="note" placeholder={action === "verified" ? "Optional context for the audit trail" : "Explain what needs another review"} required={action !== "verified"} rows="4" /></label>}<div className="winner-modal-actions"><button className="text-button" onClick={onClose} type="button">Cancel</button><button className={`button ${action === "rejected" ? "button-coral" : "button-primary"}`} disabled={loading} type="submit">{loading ? "Writing ledger..." : isPayout ? "Complete payout" : action === "verified" ? "Verify winner" : "Reject proof"}<ArrowUpRight size={15} /></button></div></form></section></div>
}

function WinnerRow({ winner, selected, onSelect }) {
  return <button aria-pressed={selected} className={`winner-workflow-row ${selected ? "winner-workflow-row-selected" : ""}`} onClick={() => onSelect(winner.id)} type="button"><span className="winner-avatar">{winner.name.slice(0, 1)}</span><span className="winner-row-main"><strong>{winner.name}</strong><small>{winner.email} / {winner.month} / {winner.matchType}</small></span><span className="winner-row-value">{money(winner.prizeMinor)}</span><span className={`workflow-status workflow-status-${winner.status}`}>{winner.status}</span><ChevronRight size={16} /></button>
}

function DetailPanel({ winner, events, onAction }) {
  if (!winner) return <aside className="winner-detail winner-detail-empty"><ShieldCheck size={26} /><strong>Select a winner record</strong><span>Review proof and take a controlled next action from the detail rail.</span></aside>
  return <aside className="winner-detail"><div className="winner-detail-top"><div><p className="winner-kicker">Case / {winner.id.slice(-10)}</p><h2>{winner.name}</h2><span>{winner.email}</span></div><span className={`workflow-status workflow-status-${winner.status}`}>{winner.status}</span></div><div className="winner-case-grid"><div><small>Prize value</small><strong>{money(winner.prizeMinor)}</strong></div><div><small>Match</small><strong>{winner.matchedCount} / 5</strong></div><div><small>Draw</small><strong>{winner.month}</strong></div></div><div className="winner-proof-card"><div className="winner-proof-head"><span><FileCheck2 size={16} /> Evidence</span><span>{winner.proofUrl ? "received" : "missing"}</span></div>{winner.proofUrl ? <a href={winner.proofUrl} rel="noreferrer" target="_blank">Open score screenshot <ExternalLink size={14} /></a> : <p>No score screenshot has been submitted. Verification remains locked.</p>}{winner.adminNote ? <small className="winner-admin-note">Last review: {winner.adminNote}</small> : null}</div><div className="winner-detail-actions">{winner.status !== "paid" && winner.proofUrl ? <button className="button button-primary" onClick={() => onAction("verified")} type="button"><BadgeCheck size={16} /> Verify evidence</button> : null}{winner.status !== "paid" && winner.status !== "verified" ? <button className="button button-outline-coral" onClick={() => onAction("rejected")} type="button"><X size={16} /> Reject</button> : null}{winner.status === "verified" ? <button className="button button-primary" onClick={() => onAction("payout")} type="button"><WalletCards size={16} /> Release payout</button> : null}</div>{winner.payout ? <div className="winner-payout-card"><div><Banknote size={16} /><span><small>Payment completed</small><strong>{winner.payout.reference}</strong></span></div><span>{winner.payout.provider.replace("_", " ")}</span></div> : null}<div className="winner-timeline"><div className="winner-timeline-heading"><span><History size={15} /> Audit trail</span><small>{events.length} events</small></div>{events.length ? events.map((event) => <div className="winner-event" key={event.id}><span className={`event-dot event-dot-${event.action.includes("payout") ? "paid" : event.action.includes("reject") ? "rejected" : event.action.includes("verify") ? "verified" : "pending"}`} /><div><strong>{event.action.replaceAll("_", " ")}</strong><small>{dateTime(event.createdAt)} / {event.actor?.name || "System"}</small>{event.note ? <p>{event.note}</p> : null}</div></div>) : <p className="winner-no-events">No workflow events recorded yet.</p>}</div></aside>
}

export default function WinnerVerificationPage() {
  const [session, setSession] = useState(null)
  const [workflow, setWorkflow] = useState(emptyWorkflow)
  const [selectedId, setSelectedId] = useState(null)
  const [events, setEvents] = useState([])
  const [focus, setFocus] = useState("pending")
  const [statusFilter, setStatusFilter] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState("")
  const selected = workflow.winners.find((winner) => winner.id === selectedId) || workflow.winners[0] || null

  async function loadWorkflow() {
    const params = new URLSearchParams()
    if (statusFilter) params.set("status", statusFilter)
    if (query.trim()) params.set("query", query.trim())
    const data = await api(`/api/admin/winner-workflow${params.toString() ? `?${params}` : ""}`)
    setWorkflow(data); setLoading(false)
    setSelectedId((current) => data.winners.some((winner) => winner.id === current) ? current : data.winners[0]?.id || null)
  }

  useEffect(() => {
    api("/api/auth/session").then((data) => { if (!data.member || data.member.role !== "admin") throw new Error("Administrator access is required."); setSession(data.member) }).catch((error) => { if (error.message !== "Sign in is required.") setNotice(error.message || "Administrator access could not be verified."); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!session) return undefined
    const timer = window.setTimeout(() => loadWorkflow().catch((error) => { setNotice(error.message); setLoading(false) }), 180)
    const interval = window.setInterval(() => loadWorkflow().catch(() => {}), 10000)
    return () => { window.clearTimeout(timer); window.clearInterval(interval) }
  }, [session?.id, statusFilter, query])

  useEffect(() => {
    if (!selected) { setEvents([]); return undefined }
    let active = true
    api(`/api/admin/winners/${selected.id}/events`).then((data) => { if (active) setEvents(data.events || []) }).catch(() => { if (active) setEvents([]) })
    return () => { active = false }
  }, [selected?.id])

  async function submitAction(event) {
    event.preventDefault(); setActionLoading(true); setNotice("")
    const form = new FormData(event.currentTarget)
    try {
      const body = action === "payout" ? { provider: form.get("provider"), payoutReference: form.get("payoutReference") } : { decision: action, note: form.get("note") }
      const path = action === "payout" ? `/api/admin/winners/${selected.id}/pay` : `/api/admin/winners/${selected.id}/verify`
      const data = await api(path, { method: "POST", body: JSON.stringify(body) })
      setNotice(action === "payout" ? `Payout ${data.winner.payout?.reference || "completed"} recorded.` : action === "verified" ? "Winner verified. The reward is ready for payout." : "Proof rejected and returned for follow-up.")
      setAction(null); await loadWorkflow()
    } catch (error) { setNotice(error.message) } finally { setActionLoading(false) }
  }

  async function logout() { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); setSession(null); window.location.assign("/admin-dashboard") }
  function focusStatus(nextFocus) { setFocus(nextFocus); setStatusFilter(nextFocus === "all" ? "" : nextFocus) }

  if (!session) return <LoginPanel onLogin={(member) => { setNotice(""); setSession(member) }} />
  const metrics = workflow.metrics
  return <div className="winner-page"><header className="winner-header"><div className="winner-announcement"><span className="live-dot" /> Digital Heroes / proofroom <span className="winner-storage-indicator"><span className={`live-dot ${workflow.storage.configured ? "storage-live" : "storage-muted"}`} /> {workflow.storage.configured ? "MongoDB mirror live" : "Local audit ledger"}</span></div><nav className="winner-nav container"><button className="wordmark" onClick={() => window.location.assign("/admin-dashboard")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><div className="winner-nav-links"><button onClick={() => window.location.assign("/admin-dashboard")} type="button"><ArrowLeft size={14} /> Control room</button><button onClick={() => document.getElementById("winner-list")?.scrollIntoView({ behavior: "smooth" })} type="button">Case list</button><button className="nav-cta" onClick={logout} type="button"><LogOut size={14} /> Sign out</button></div></nav></header><main className="winner-main container"><section className="winner-hero"><div><p className="eyebrow"><span className="eyebrow-line" /> Winner verification & payout / 006</p><h1>Trust is the<br /><em>real reward.</em></h1><p className="winner-hero-copy">A focused operations surface for reviewing score evidence, preserving every decision, and releasing only verified rewards.</p><div className="winner-hero-meta"><span><ShieldCheck size={15} /> Admin: {session.email}</span><i /><span><Clock3 size={15} /> Live workflow sync</span></div></div><div className="winner-signal-card"><div className="winner-signal-topline"><span>Workflow constellation / 01</span><span>proof → decision → payout</span></div><SignalCanvas focus={focus} metrics={metrics} onFocus={focusStatus} /><div className="winner-signal-legend"><button aria-pressed={focus === "pending"} onClick={() => focusStatus("pending")} type="button"><b>{metrics.pending}</b> pending</button><button aria-pressed={focus === "verified"} onClick={() => focusStatus("verified")} type="button"><b>{metrics.verified}</b> verified</button><button aria-pressed={focus === "paid"} onClick={() => focusStatus("paid")} type="button"><b>{metrics.paid}</b> paid</button></div></div></section>{notice ? <div className="winner-notice" role="status"><Check size={15} /> {notice}<button aria-label="Dismiss notice" onClick={() => setNotice("")} type="button"><X size={15} /></button></div> : null}<section className="winner-metric-grid"><article><span>Needs review</span><strong>{metrics.pending}</strong><small>{money(metrics.pendingValueMinor)} awaiting decision</small></article><article className="metric-lime"><span>Ready to release</span><strong>{metrics.verified}</strong><small>{money(metrics.verifiedValueMinor)} verified value</small></article><article className="metric-aqua"><span>Paid out</span><strong>{metrics.paid}</strong><small>{money(metrics.paidValueMinor)} completed value</small></article><article className="metric-coral"><span>All winner cases</span><strong>{metrics.total}</strong><small>{metrics.rejected} rejected / returned</small></article></section><section className="winner-workspace" id="winner-list"><div className="winner-list-panel"><div className="winner-list-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Operational queue</p><h2>Read the<br /><em>evidence.</em></h2></div><button aria-label="Refresh winner queue" className="winner-icon-button" disabled={loading} onClick={() => loadWorkflow().catch((error) => setNotice(error.message))} type="button"><RefreshCcw size={16} /></button></div><div className="winner-tools"><label className="winner-search"><Search size={15} /><input aria-label="Search winner cases" onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, month..." value={query} /></label><div className="winner-status-tabs" role="group" aria-label="Winner status filter">{["", "pending", "verified", "rejected", "paid"].map((value) => <button aria-pressed={statusFilter === value} key={value || "all"} onClick={() => { setStatusFilter(value); setFocus(value || "all") }} type="button">{value || "all"}</button>)}</div></div><div className="winner-queue">{workflow.winners.length ? workflow.winners.map((winner) => <WinnerRow key={winner.id} onSelect={setSelectedId} selected={selected?.id === winner.id} winner={winner} />) : <div className="winner-queue-empty"><FileCheck2 size={24} /><strong>{loading ? "Loading case queue..." : "No winner cases match."}</strong><span>Try another state or search term.</span></div>}</div></div><DetailPanel events={events} onAction={setAction} winner={selected} /></section><section className="winner-event-strip"><div><p className="eyebrow"><span className="eyebrow-line" /> Latest audit movement</p><h2>Nothing gets<br /><em>lost in the handoff.</em></h2></div><div className="winner-event-feed">{workflow.events.length ? workflow.events.slice(0, 4).map((event) => <div key={event.id}><span className={`event-dot event-dot-${event.action.includes("payout") ? "paid" : event.action.includes("reject") ? "rejected" : event.action.includes("verify") ? "verified" : "pending"}`} /><span><strong>{event.action.replaceAll("_", " ")}</strong><small>{dateTime(event.createdAt)} / {event.actor?.name || "System"}</small></span><ChevronRight size={15} /></div>) : <p>No workflow events yet. New proof submissions and decisions will appear here.</p>}</div></section></main><footer className="winner-footer container"><button className="wordmark" onClick={() => window.location.assign("/admin-dashboard")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><span>Private operations surface / controlled payouts</span><a href="mailto:hello@digitalheroes.co.in">Support <ArrowUpRight size={14} /></a></footer>{action && selected ? <ActionModal action={action} loading={actionLoading} onClose={() => setAction(null)} onSubmit={submitAction} winner={selected} /> : null}</div>
}
