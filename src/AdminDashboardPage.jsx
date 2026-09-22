import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html, OrbitControls, Sparkles as SparkleField } from "@react-three/drei"
import { ArrowLeft, ArrowUpRight, BarChart3, Check, ChevronRight, CircleDollarSign, Clock3, FlaskConical, HeartHandshake, LogOut, Plus, RefreshCcw, ShieldCheck, Sparkles, Trophy, Users, X } from "lucide-react"
import "./admin-page.css"
import { apiFetch } from "./apiBase"

const todayMonth = new Date().toISOString().slice(0, 7)

async function api(path, options = {}) {
  const response = await apiFetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "The control room could not complete that action.")
  return data
}

function AdminLogin({ onLogin }) {
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")
  async function submit(event) {
    event.preventDefault(); setStatus("loading"); setMessage("")
    const form = new FormData(event.currentTarget)
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) })
      if (data.member.role !== "admin") throw new Error("Administrator access is required for this surface.")
      onLogin(data.member)
    } catch (error) { setMessage(error.message); setStatus("error") }
  }
  return <main className="admin-login-shell"><div className="admin-login-card"><div className="admin-brand"><span className="admin-brand-mark" /> digital <strong>heroes</strong></div><p className="eyebrow"><span className="eyebrow-line" /> Control room / 004</p><h1>Keep the good<br /><em>moving cleanly.</em></h1><p>Administrator access opens the draw engine, winner verification, charity directory, and live platform signals.</p><form onSubmit={submit}><label>Email<input name="email" required type="email" placeholder="admin@example.com" /></label><label>Password<input name="password" required type="password" placeholder="Your password" /></label>{status === "error" ? <p className="admin-error" role="alert">{message}</p> : null}<button className="button button-primary full-width" disabled={status === "loading"} type="submit">{status === "loading" ? "Opening control room..." : "Enter as administrator"}<ArrowUpRight size={16} /></button></form><button className="text-button admin-back-link" onClick={() => window.location.assign("/")} type="button"><ArrowLeft size={15} /> Back to public signal</button></div></main>
}

function Metric({ label, value, detail, icon: Icon, tone = "lime" }) {
  return <article className={`admin-metric admin-metric-${tone}`}><div className="admin-metric-top"><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><small>{detail}</small>{label === "Total users" ? <AdminSignalPortal /> : null}</article>
}

function ControlRoomScene({ overview, onFocus }) {
  const group = useRef(null)
  const { pointer } = useThree()
  const nodes = [
    { key: "people", label: "ACTIVE MEMBERS", value: overview?.activeMembers?.toLocaleString() || "—", position: [-1.65, 0.95, 0.2], color: "#d7fa6b" },
    { key: "draw", label: "PUBLISHED DRAWS", value: overview?.publishedDraws?.toString() || "0", position: [1.65, 0.78, 0.25], color: "#ff715b" },
    { key: "proof", label: "PENDING PROOF", value: overview?.pendingWinners?.toString() || "0", position: [0, -1.3, 0.45], color: "#74d5d8" },
  ]
  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 0.045
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.22) * 0.06
    group.current.position.x += (pointer.x * 0.16 - group.current.position.x) * 0.04
    group.current.position.y += (pointer.y * 0.1 - group.current.position.y) * 0.04
  })
  return <group ref={group}><SparkleField count={70} scale={[8, 6, 4]} size={1.6} speed={0.16} color="#d7fa6b" opacity={0.35} /><mesh><icosahedronGeometry args={[1.15, 2]} /><meshPhysicalMaterial color="#d7fa6b" emissive="#465e1f" emissiveIntensity={0.8} metalness={0.24} roughness={0.3} transparent opacity={0.9} /></mesh><mesh rotation={[Math.PI / 2.1, .3, 0]} scale={1.45}><torusGeometry args={[1.05, .014, 10, 96]} /><meshBasicMaterial color="#74d5d8" transparent opacity={.42} /></mesh><mesh rotation={[.4, Math.PI / 2.8, 0]} scale={1.7}><torusGeometry args={[1.05, .01, 10, 96]} /><meshBasicMaterial color="#ff715b" transparent opacity={.32} /></mesh>{nodes.map((node) => <group key={node.key} position={node.position}><mesh onClick={(event) => { event.stopPropagation(); onFocus(node.key) }} onPointerOver={() => { document.body.style.cursor = "pointer" }} onPointerOut={() => { document.body.style.cursor = "default" }}><sphereGeometry args={[.16, 24, 24]} /><meshBasicMaterial color={node.color} /></mesh><Html distanceFactor={2.5} position={[0, -.35, 0]}><span className={`admin-node-label admin-node-${node.key}`}><b>{node.value}</b>{node.label}</span></Html></group>)}</group>
}

function AdminSignalCanvas({ overview }) {
  const [focus, setFocus] = useState("draw")
  return <div className="admin-signal-canvas"><Canvas camera={{ position: [0, 0, 6.3], fov: 35 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => gl.setClearColor("#000000", 0)}><ambientLight intensity={.75} /><pointLight color="#d7fa6b" intensity={10} distance={9} position={[3, 3, 3]} /><pointLight color="#ff715b" intensity={6} distance={8} position={[-3, -2, 2]} /><ControlRoomScene onFocus={setFocus} overview={overview} /><OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI * .68} minPolarAngle={Math.PI * .32} rotateSpeed={.65} /></Canvas><div className="admin-signal-focus"><span>Signal focus</span><strong>{focus}</strong></div><span className="admin-signal-hint">drag to orbit / click a signal</span></div>
}

function AdminSignalPortal() {
  const [host, setHost] = useState(null)
  const [overview, setOverview] = useState(null)
  useEffect(() => {
    setHost(document.querySelector(".admin-hero-orbit"))
    const loadOverview = () => apiFetch("/api/admin/overview").then((response) => response.ok ? response.json() : null).then(setOverview).catch(() => {})
    loadOverview()
    const interval = window.setInterval(loadOverview, 10000)
    return () => window.clearInterval(interval)
  }, [])
  return host ? createPortal(<AdminSignalCanvas overview={overview} />, host) : null
}

function DrawEngine({ draws, onRefresh, setNotice }) {
  const [month, setMonth] = useState(todayMonth)
  const [mode, setMode] = useState("algorithmic")
  const [pool, setPool] = useState("48260")
  const [simulation, setSimulation] = useState(null)
  const [loading, setLoading] = useState(false)

  async function simulate() {
    setLoading(true); setNotice("")
    try {
      const created = await api("/api/admin/draws", { method: "POST", body: JSON.stringify({ month, mode, poolMinor: Math.round(Number(pool) * 100) }) })
      const result = await api(`/api/admin/draws/${created.draw.id}/simulate`, { method: "POST" })
      setSimulation(result.draw); await onRefresh(); setNotice("Simulation locked. Review the numbers and publish when ready.")
    } catch (error) { setNotice(error.message) } finally { setLoading(false) }
  }

  async function publish() {
    if (!simulation) return
    setLoading(true); setNotice("")
    try { const data = await api(`/api/admin/draws/${simulation.id}/publish`, { method: "POST" }); setSimulation(data.draw); await onRefresh(); setNotice("Draw published. Winner verification is now open.") } catch (error) { setNotice(error.message) } finally { setLoading(false) }
  }

  const frequency = simulation?.frequency ? Object.entries(simulation.frequency).sort((a, b) => b[1] - a[1]).slice(0, 8) : []
  return <section className="admin-panel draw-engine-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Draw management</p><h2>Shape the next<br /><em>reward signal.</em></h2></div><span className="admin-panel-id">ENGINE / 01</span></div><div className="draw-controls"><label>Draw month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label>Prize pool / INR<input min="100" step="100" type="number" value={pool} onChange={(event) => setPool(event.target.value)} /></label><div className="draw-mode-field"><span>Selection logic</span><div className="draw-mode-toggle"><button aria-pressed={mode === "algorithmic"} onClick={() => setMode("algorithmic")} type="button"><Sparkles size={14} /> Frequency</button><button aria-pressed={mode === "random"} onClick={() => setMode("random")} type="button"><FlaskConical size={14} /> Random</button></div></div><button className="button button-primary draw-simulate-button" disabled={loading} onClick={simulate} type="button"><FlaskConical size={16} /> {loading ? "Running..." : "Run simulation"}</button></div>{simulation ? <div className="simulation-result"><div className="simulation-result-head"><div><span className="admin-kicker">{simulation.status === "published" ? "Published result" : "Simulation result"} / {simulation.month}</span><h3>{simulation.winningNumbers.join(" · ")}</h3><p>{simulation.result?.entriesCount || 0} active entries · {simulation.mode === "algorithmic" ? "score-frequency weighted" : "uniform random"}</p></div><div className="simulation-actions"><span className={`state-pill state-${simulation.status}`}>{simulation.status}</span>{simulation.status !== "published" ? <button className="button button-primary" disabled={loading} onClick={publish} type="button"><Check size={16} /> Publish results</button> : null}</div></div><div className="simulation-grid"><div className="frequency-chart"><div className="mini-heading"><span>Hot numbers</span><span>frequency</span></div>{frequency.map(([number, count]) => <div className="frequency-row" key={number}><span>{number.padStart(2, "0")}</span><i><i style={{ width: `${Math.max(8, count * 18)}%` }} /></i><strong>{count}</strong></div>)}</div><div className="tier-grid">{Object.entries(simulation.result?.tiers || {}).map(([tier, value]) => <div className="tier-card" key={tier}><span>{tier}</span><strong>INR {(value.poolMinor / 100).toLocaleString("en-IN")}</strong><small>{value.winnerCount ? `${value.winnerCount} winner${value.winnerCount > 1 ? "s" : ""} / INR ${(value.prizeMinor / 100).toLocaleString("en-IN")} each` : value.rolloverMinor ? "Jackpot rolls forward" : "No winners"}</small></div>)}</div></div></div> : <div className="simulation-empty"><FlaskConical size={22} /><strong>Nothing simulated yet.</strong><span>Configure the month, choose the logic, and preview the weighted draw before publishing.</span></div>}<div className="recent-draws"><div className="mini-heading"><span>Recent draw ledger</span><button className="text-button" onClick={onRefresh} type="button"><RefreshCcw size={14} /> Refresh</button></div>{draws.length ? draws.slice(0, 4).map((draw) => <button className="draw-ledger-row" key={draw.id} onClick={() => setSimulation(draw)} type="button"><span>{draw.month}</span><strong>{draw.winningNumbers?.length ? draw.winningNumbers.join(" · ") : "Awaiting simulation"}</strong><span className={`state-pill state-${draw.status}`}>{draw.status}</span><ChevronRight size={15} /></button>) : <p className="muted-copy">The ledger will appear after the first simulation.</p>}</div></section>
}

function WinnersPanel({ winners, onRefresh, setNotice, filter: externalFilter, onFilterChange: externalOnFilterChange }) {
  const [localFilter, setLocalFilter] = useState("")
  const filter = externalFilter ?? localFilter
  const onFilterChange = externalOnFilterChange || setLocalFilter
  if (filter) winners = winners.filter((winner) => winner.status === filter)
  async function verify(id, decision) { try { await api(`/api/admin/winners/${id}/verify`, { method: "POST", body: JSON.stringify({ decision, note: decision === "verified" ? "Reviewed by administrator." : "Proof requires another review." }) }); await onRefresh(); setNotice(decision === "verified" ? "Winner verified. Payment is ready for release." : "Winner marked for follow-up.") } catch (error) { setNotice(error.message) } }
  async function pay(id) { try { await api(`/api/admin/winners/${id}/pay`, { method: "POST" }); await onRefresh(); setNotice("Payout marked complete.") } catch (error) { setNotice(error.message) } }
  return <section className="admin-panel winners-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Winner verification</p><h2>Proof before<br /><em>payout.</em></h2></div><div className="admin-heading-tools"><select aria-label="Filter winners" className="winner-filter" value={filter} onChange={(event) => onFilterChange(event.target.value)}><option value="">All states</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="paid">Paid</option></select><a className="winner-console-link" href="/winner-verification">Open proofroom <ArrowUpRight size={13} /></a><span className="admin-panel-id">CONTROL / 04</span></div></div><div className="winner-list">{winners.length ? winners.map((winner) => <article className="winner-row" key={winner.id}><div className="winner-avatar">{winner.name.slice(0, 1)}</div><div className="winner-main"><strong>{winner.name}</strong><span>{winner.month} / {winner.matchType} match / INR {(winner.prizeMinor / 100).toLocaleString("en-IN")}</span>{winner.proofUrl ? <a href={winner.proofUrl} rel="noreferrer" target="_blank">View score proof <ArrowUpRight size={13} /></a> : <small>Proof not uploaded</small>}</div><span className={`state-pill state-${winner.status}`}>{winner.status}</span><div className="winner-actions">{winner.status === "pending" ? <><button aria-label={`Verify ${winner.name}`} onClick={() => verify(winner.id, "verified")} title="Verify"><Check size={15} /></button><button aria-label={`Reject ${winner.name}`} onClick={() => verify(winner.id, "rejected")} title="Reject"><X size={15} /></button></> : null}{winner.status === "verified" ? <button className="pay-button" onClick={() => pay(winner.id)} type="button">Mark paid <ArrowUpRight size={13} /></button> : null}</div></article>) : <div className="empty-panel"><ShieldCheck size={22} /><strong>No winners in this state.</strong><span>New draw and verification updates appear automatically.</span></div>}</div></section>
}

function MembersPanel({ members, onRefresh, setNotice }) {
  async function toggleSubscription(member) {
    const nextPlan = member.plan ? null : "monthly"
    try {
      await api(`/api/admin/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ plan: nextPlan, charity: nextPlan ? member.charity || "The Good Grief Trust" : null }) })
      await onRefresh(); setNotice(nextPlan ? `${member.name} is active on the monthly plan.` : `${member.name} is now inactive.`)
    } catch (error) { setNotice(error.message) }
  }
  return <section className="admin-panel members-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> User management</p><h2>Know who is<br /><em>in motion.</em></h2></div><span className="admin-panel-id">CONTROL / 01</span></div><div className="member-list">{members.map((member) => <div className="member-row" key={member.id}><div className="member-avatar">{member.name.slice(0, 1)}</div><div className="member-main"><strong>{member.name}</strong><span>{member.email}</span></div><span className="member-role">{member.role}</span><span className={`state-pill ${member.plan ? "state-active" : "state-expired"}`}>{member.plan ? member.plan : "inactive"}</span><button className="member-action" onClick={() => toggleSubscription(member)} type="button">{member.plan ? "Pause" : "Activate"}</button></div>)}</div></section>
}

function CharityPanel({ charities, onRefresh, setNotice }) {
  const [form, setForm] = useState({ name: "", category: "", note: "" })
  const [charityTotals, setCharityTotals] = useState([])
  useEffect(() => {
    let active = true
    const loadTotals = () => api("/api/admin/overview").then((overview) => { if (active) setCharityTotals(overview.charityTotals || []) }).catch(() => {})
    loadTotals()
    const interval = window.setInterval(loadTotals, 10000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])
  async function addCharity(event) { event.preventDefault(); try { await api("/api/admin/charities", { method: "POST", body: JSON.stringify(form) }); setForm({ name: "", category: "", note: "" }); await onRefresh(); setNotice("Charity added to the live directory.") } catch (error) { setNotice(error.message) } }
  async function archiveCharity(id) { try { await api(`/api/admin/charities/${id}`, { method: "DELETE" }); await onRefresh(); setNotice("Charity archived from new selections.") } catch (error) { setNotice(error.message) } }
  return <section className="admin-panel charity-panel"><div className="admin-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Charity management</p><h2>Keep the<br /><em>causes human.</em></h2></div><span className="admin-panel-id">INTEGRATION / 03</span></div><div className="charity-list">{charities.filter((charity) => charity.active).map((charity) => <div className="charity-row" key={charity.id}><span className="charity-signal" /><div><strong>{charity.name}</strong><small>{charity.category} / {charity.note}</small></div><button className="charity-archive" onClick={() => archiveCharity(charity.id)} type="button">Archive</button></div>)}</div><div className="charity-impact-ledger"><div className="mini-heading"><span>Live contribution trail</span><HeartHandshake size={14} /></div>{charityTotals?.length ? charityTotals.map((item) => <div className="charity-impact-row" key={item.charity}><span>{item.charity}</span><strong>INR {(item.amountMinor / 100).toLocaleString("en-IN")}</strong></div>) : <p className="muted-copy">No active subscription contributions recorded yet.</p>}</div><form className="charity-add-form" onSubmit={addCharity}><div className="mini-heading"><span>Add a directory listing</span><Plus size={15} /></div><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Charity name" /></label><div className="form-split"><label>Category<input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Category" /></label><label>Short note<input required value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Why it matters" /></label></div><button className="button button-primary full-width" type="submit">Add charity <Plus size={15} /></button></form></section>
}

export default function AdminDashboardPage() {
  const [session, setSession] = useState(null)
  const [accessError, setAccessError] = useState("")
  const [overview, setOverview] = useState(null)
  const [members, setMembers] = useState([])
  const [draws, setDraws] = useState([])
  const [winners, setWinners] = useState([])
  const [charities, setCharities] = useState([])
  const [notice, setNotice] = useState("")

  async function refresh() {
    const [nextOverview, nextMembers, nextDraws, nextWinners, nextCharities] = await Promise.all([api("/api/admin/overview"), api("/api/admin/members"), api("/api/admin/draws"), api("/api/admin/winners"), api("/api/admin/charities")])
    setOverview(nextOverview); setMembers(nextMembers.members); setDraws(nextDraws.draws); setWinners(nextWinners.winners); setCharities(nextCharities.charities)
  }

  useEffect(() => { api("/api/auth/session").then((data) => { if (data.member.role !== "admin") throw new Error("Administrator access is required."); setSession(data.member); return refresh() }).catch((error) => setAccessError(error.message)) }, [])
  useEffect(() => {
    if (!session) return undefined
    const interval = window.setInterval(() => refresh().catch(() => {}), 10000)
    return () => window.clearInterval(interval)
  }, [session])
  if (!session) return <AdminLogin onLogin={(member) => { setAccessError(""); setSession(member); refresh().catch((error) => setAccessError(error.message)) }} />

  async function logout() { await api("/api/auth/logout", { method: "POST" }); setSession(null) }
  return <div className="admin-page"><header className="admin-header"><div className="admin-announcement"><span className="live-dot" /> Digital Heroes / operations layer <span className="admin-header-status"><span className="live-dot" /> Systems nominal</span></div><nav className="admin-nav container"><button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><div className="admin-nav-links"><a href="#overview">Overview</a><a href="#members">Users</a><a href="#draw-engine">Draw engine</a><a href="#winners">Winners</a><a href="#charities">Causes</a><button className="nav-cta" onClick={logout} type="button"><LogOut size={14} /> Sign out</button></div></nav></header><main className="admin-main container" id="overview"><div className="admin-hero"><div><p className="eyebrow"><span className="eyebrow-line" /> Administrator dashboard / 004</p><h1>Make the right<br /><em>moment happen.</em></h1><p>One calm control room for the people, the draw, the causes, and the proof behind every reward.</p></div><div className="admin-hero-orbit"><div className="orbit-ring orbit-ring-one" /><div className="orbit-ring orbit-ring-two" /><div className="orbit-core"><ShieldCheck size={26} /><span>ADMIN<br />ONLINE</span></div><span className="orbit-label orbit-label-one">DATA / 01</span><span className="orbit-label orbit-label-two">DRAW / 02</span><span className="orbit-label orbit-label-three">PROOF / 03</span></div></div>{accessError ? <p className="admin-error" role="alert">{accessError}</p> : null}<div className="admin-metric-grid"><Metric detail="registered profiles" icon={Users} label="Total users" value={overview?.totalMembers?.toLocaleString() || "—"} /><Metric detail="active access" icon={ShieldCheck} label="Active subscribers" tone="aqua" value={overview?.activeMembers?.toLocaleString() || "—"} /><Metric detail="awaiting review" icon={Trophy} label="Pending winners" tone="coral" value={overview?.pendingWinners?.toLocaleString() || "—"} /><Metric detail="current configured pool" icon={CircleDollarSign} label="Prize pool" value={`INR ${((overview?.prizePoolMinor || 0) / 100).toLocaleString("en-IN")}`} /></div>{notice ? <div className="admin-notice" role="status"><Check size={15} /> {notice}<button aria-label="Dismiss notice" onClick={() => setNotice("")} type="button"><X size={14} /></button></div> : null}<div id="members"><MembersPanel members={members} onRefresh={refresh} setNotice={setNotice} /></div><div id="draw-engine"><DrawEngine draws={draws} onRefresh={refresh} setNotice={setNotice} /></div><div className="admin-lower-grid"><div id="winners"><WinnersPanel onRefresh={refresh} setNotice={setNotice} winners={winners} /></div><div id="charities"><CharityPanel charities={charities} onRefresh={refresh} setNotice={setNotice} /></div></div></main><footer className="admin-footer container"><button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><span>Control room / draw engine / verification</span><a href="/subscription-scores">Member experience <ArrowUpRight size={14} /></a></footer></div>
}
