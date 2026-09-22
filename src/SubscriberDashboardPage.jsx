import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Sparkles as SparkleField } from "@react-three/drei"
import { ArrowUpRight, CalendarClock, Check, ExternalLink, FileCheck2, HeartHandshake, LogOut, RefreshCcw, ShieldCheck, Sparkles, Target, Trophy, WalletCards, X } from "lucide-react"
import "./subscriber-dashboard-page.css"
import { apiFetch } from "./apiBase"
import AuthPanel from "./AuthPanel"

const emptyDashboard = { member: null, subscription: null, plan: null, perks: [], scores: [], drawEntries: [], rewards: [], rewardSummary: { totalMinor: 0, paidMinor: 0, outstandingMinor: 0, count: 0 }, impact: { currentCharity: null, totalMinor: 0, currentCharityMinor: 0, percentage: 10 }, nextDraw: { date: "", label: "—" } }

async function api(path, options = {}) {
  const response = await apiFetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "The member dashboard could not complete that request.")
  return data
}

const money = (minor) => `INR ${Math.round(Number(minor || 0) / 100).toLocaleString("en-IN")}`
const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : "—"

function DashboardScene({ dashboard }) {
  const group = useRef(null)
  const scores = dashboard.scores || []
  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 0.045
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.05
  })
  const nodes = [
    { position: [-1.55, 0.92, 0.2], value: scores.length, color: "#d7fa6b" },
    { position: [1.55, 0.82, 0.25], value: dashboard.drawEntries.length, color: "#ff715b" },
    { position: [0, -1.3, 0.4], value: dashboard.rewardSummary.count, color: "#74d5d8" },
  ]
  return <group ref={group}><SparkleField count={64} scale={[8, 6, 4]} size={1.5} speed={0.16} color="#d7fa6b" opacity={0.34} /><mesh><icosahedronGeometry args={[1.18, 2]} /><meshPhysicalMaterial color="#d7fa6b" emissive="#465e1f" emissiveIntensity={0.88} metalness={0.24} roughness={0.3} transparent opacity={0.91} /></mesh><mesh rotation={[Math.PI / 2.1, 0.25, 0]} scale={1.46}><torusGeometry args={[1.05, 0.014, 10, 96]} /><meshBasicMaterial color="#74d5d8" transparent opacity={0.42} /></mesh><mesh rotation={[0.4, Math.PI / 2.8, 0]} scale={1.72}><torusGeometry args={[1.05, 0.01, 10, 96]} /><meshBasicMaterial color="#ff715b" transparent opacity={0.3} /></mesh>{nodes.map((node, index) => <group key={index} position={node.position}><mesh><sphereGeometry args={[0.16, 24, 24]} /><meshBasicMaterial color={node.color} /></mesh><mesh scale={0.45}><sphereGeometry args={[0.16, 16, 16]} /><meshBasicMaterial color="#efffb2" /></mesh></group>)}</group>
}

function LoginPanel({ onLogin }) {
  return <AuthPanel backHref="/" description="Sign in to see your scores, draw entries, rewards, and the good your membership is already moving." onSubmit={async ({ email, password }) => { const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); await onLogin(data.member) }} redirectPath="/subscriber-dashboard" submitLabel="Open my dashboard" title="Welcome back" />
}

function Metric({ icon: Icon, label, value, detail, tone = "lime" }) {
  return <article className={`dashboard-metric dashboard-metric-${tone}`}><div><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><small>{detail}</small></article>
}

function ScoreRows({ scores }) {
  if (!scores.length) return <div className="dashboard-empty"><Target size={22} /><strong>No scores in play yet.</strong><span>Log a round to create your first draw signal.</span></div>
  return <div className="dashboard-score-list">{scores.map((score, index) => <div className="dashboard-score-row" key={score.id}><span className="dashboard-row-index">0{index + 1}</span><strong>{score.value}</strong><span>{dateLabel(score.date)}</span><span className="score-live">{index === 0 ? "latest" : "in play"}</span></div>)}</div>
}

function EntryRows({ entries }) {
  if (!entries.length) return <div className="dashboard-empty"><CalendarClock size={22} /><strong>No published entries yet.</strong><span>Your next published draw entry will appear here.</span></div>
  return <div className="dashboard-entry-list">{entries.map((entry) => <article className="dashboard-entry-row" key={entry.drawId}><div><span className="dashboard-kicker">{entry.month} / {entry.status}</span><strong>{entry.numbers.join(" · ") || "Waiting for scores"}</strong></div><span className="entry-arrow"><ArrowUpRight size={16} /></span><small>{entry.winningNumbers.length ? `Winning numbers ${entry.winningNumbers.join(" · ")}` : "Entry recorded"}</small></article>)}</div>
}

function RewardRows({ rewards, onProof, proofState }) {
  if (!rewards.length) return <div className="dashboard-empty"><Trophy size={22} /><strong>No rewards to verify yet.</strong><span>When a draw matches your numbers, your review state will land here.</span></div>
  return <div className="dashboard-reward-list">{rewards.map((reward) => <article className="dashboard-reward-row" key={reward.id}><div className="reward-top"><div><span className="dashboard-kicker">{reward.month} / {reward.matchType}</span><strong>{money(reward.prizeMinor)}</strong></div><span className={`state-pill state-${reward.status}`}>{reward.status}</span></div><p>{reward.matchedCount} matching numbers / {reward.status === "paid" ? "payout complete" : reward.status === "verified" ? "verified for payout" : "proof review required"}</p>{reward.proofUrl ? <a className="proof-link" href={reward.proofUrl} rel="noreferrer" target="_blank">View submitted proof <ExternalLink size={13} /></a> : reward.status === "pending" ? <form className="proof-form" onSubmit={(event) => onProof(event, reward.id)}><input aria-label={`Proof URL for ${reward.month}`} name="proofUrl" placeholder="https://... score proof" required type="url" /><button className="text-button" disabled={proofState?.id === reward.id} type="submit">{proofState?.id === reward.id ? "Sending..." : "Submit proof"}<ArrowUpRight size={14} /></button></form> : null}</article>)}</div>
}

export default function SubscriberDashboardPage() {
  const [session, setSession] = useState(null)
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [actionState, setActionState] = useState("idle")
  const [proofState, setProofState] = useState(null)

  async function loadDashboard(member = null) {
    const current = member || (await api("/api/auth/session")).member
    setSession(current)
    const data = await api("/api/member/dashboard")
    setDashboard(data)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    api("/api/auth/session").then((data) => active && loadDashboard(data.member)).catch(() => { if (active) { setSession(null); setLoading(false) } })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!session) return undefined
    const interval = window.setInterval(() => loadDashboard().catch(() => {}), 10000)
    return () => window.clearInterval(interval)
  }, [session?.id])

  async function refresh() { setActionState("loading"); try { await loadDashboard(); setMessage("Dashboard refreshed from the live member record.") } catch (error) { setMessage(error.message) } finally { setActionState("idle") } }
  async function logout() { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); setSession(null); setDashboard(emptyDashboard) }
  async function cancelMembership() {
    if (!window.confirm("Cancel your active membership? Your existing account history will remain available.")) return
    setActionState("loading"); setMessage("")
    try { const data = await api("/api/member/subscription/cancel", { method: "POST" }); setDashboard((current) => ({ ...current, member: data.member, subscription: data.subscription, plan: null, perks: [] })); setSession((current) => ({ ...current, plan: data.member.plan, charity: data.member.charity })); setMessage(data.message || "Membership status updated.") } catch (error) { setMessage(error.message) } finally { setActionState("idle") }
  }
  async function submitProof(event, rewardId) {
    event.preventDefault(); setProofState({ id: rewardId }); setMessage("")
    const proofUrl = new FormData(event.currentTarget).get("proofUrl")
    try { await api(`/api/winners/${rewardId}/proof`, { method: "POST", body: JSON.stringify({ proofUrl }) }); await loadDashboard(); setMessage("Proof submitted. The operations team can review it now.") } catch (error) { setMessage(error.message) } finally { setProofState(null) }
  }

  if (!session && loading) return <main className="dashboard-loading"><Sparkles size={24} /><span>Reading your member signal...</span></main>
  if (!session) return <LoginPanel onLogin={(member) => loadDashboard(member).catch((error) => { setMessage(error.message); setLoading(false) })} />
  const active = dashboard.subscription?.status === "active"
  return <div className="dashboard-page"><header className="dashboard-header"><div className="announcement"><span className="live-dot" /> Digital Heroes / member signal <ArrowUpRight size={13} /></div><nav className="dashboard-nav container"><button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><div className="dashboard-nav-links"><button onClick={() => window.location.assign("/subscription-scores#score-entry")} type="button">Manage scores</button><button onClick={() => window.location.assign("/past-draws")} type="button">Past draws</button><button onClick={() => window.location.assign("/help-center")} type="button">Help center</button><button className="nav-cta" onClick={logout} type="button"><LogOut size={14} /> Sign out</button></div></nav></header><main className="dashboard-main container"><section className="dashboard-hero"><div className="dashboard-hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> Registered subscriber / 005</p><h1>Your signal is<br /><em>already moving.</em></h1><p className="dashboard-lede">A live view of your scores, draw entries, rewards, and the cause your membership is backing.</p><div className="dashboard-hero-actions"><button className="button button-primary" onClick={() => window.location.assign("/subscription-scores#score-entry")} type="button">Add a score <ArrowUpRight size={16} /></button><button className="text-button" onClick={() => window.location.assign("/past-draws")} type="button">Explore past draws <ArrowUpRight size={15} /></button></div><div className="dashboard-identity"><ShieldCheck size={16} /><span>{session.email}</span><i /><span className={active ? "identity-active" : "identity-inactive"}>{active ? "membership active" : "membership inactive"}</span></div></div><div className="dashboard-orbit-card"><div className="dashboard-orbit-topline"><span>Personal signal / {session.id}</span><span><span className="live-dot" /> live account</span></div><div className="dashboard-orbit-canvas"><Canvas camera={{ position: [0, 0, 6.2], fov: 35 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => gl.setClearColor("#000000", 0)}><ambientLight intensity={0.8} /><pointLight color="#d7fa6b" intensity={10} distance={9} position={[3, 3, 3]} /><pointLight color="#ff715b" intensity={6} distance={8} position={[-3, -2, 2]} /><DashboardScene dashboard={dashboard} /><OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI * 0.68} minPolarAngle={Math.PI * 0.32} rotateSpeed={0.65} /></Canvas></div><div className="dashboard-orbit-legend"><span><b>{dashboard.scores.length}</b> scores</span><span><b>{dashboard.drawEntries.length}</b> entries</span><span><b>{dashboard.rewardSummary.count}</b> rewards</span></div></div></section><section className="dashboard-account-bar"><div><span className="dashboard-kicker">Account / {session.name}</span><strong>{dashboard.impact.currentCharity ? `Supporting ${dashboard.impact.currentCharity}` : "Choose a cause to restart your signal"}</strong></div><div className="dashboard-account-actions"><button className="text-button" disabled={actionState === "loading"} onClick={refresh} type="button"><RefreshCcw size={14} /> {actionState === "loading" ? "Refreshing..." : "Refresh"}</button><button className="text-button" onClick={logout} type="button">Sign out <LogOut size={14} /></button></div></section>{message ? <p className="dashboard-notice" role="status">{message}</p> : null}<section className="dashboard-metric-grid"><Metric detail={`${dashboard.scores.length === 5 ? "rolling window full" : `${5 - dashboard.scores.length} more can be added`}`} icon={Target} label="Scores in play" value={`${dashboard.scores.length}/5`} /><Metric detail={dashboard.nextDraw.date ? `next draw ${dateLabel(dashboard.nextDraw.date)}` : "draw calendar pending"} icon={CalendarClock} label="Draw entries" tone="coral" value={dashboard.drawEntries.length.toString()} /><Metric detail={`${dashboard.rewardSummary.count} reward record${dashboard.rewardSummary.count === 1 ? "" : "s"}`} icon={WalletCards} label="Rewards paid" tone="aqua" value={money(dashboard.rewardSummary.paidMinor)} /><Metric detail={`${dashboard.impact.percentage}% minimum contribution`} icon={HeartHandshake} label="Your impact" value={money(dashboard.impact.totalMinor)} /></section><section className="dashboard-section-grid"><article className="dashboard-panel scores-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Score window</p><h2>Keep your<br /><em>signal sharp.</em></h2></div><span className="dashboard-panel-id">SCORES / 01</span></div><p className="dashboard-panel-copy">Your newest five Stableford rounds are the numbers that move through the draw engine.</p><ScoreRows scores={dashboard.scores} /><button className="button button-primary" onClick={() => window.location.assign("/subscription-scores#score-entry")} type="button">Manage score window <ArrowUpRight size={15} /></button></article><article className="dashboard-panel membership-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Subscription perks</p><h2>Good is a<br /><em>membership habit.</em></h2></div><span className="dashboard-panel-id">PLAN / 02</span></div>{dashboard.plan ? <><div className="member-plan-line"><div><span className="dashboard-kicker">{dashboard.plan.name} membership</span><strong>{money(dashboard.plan.amount * 100)} <small>/{dashboard.plan.cadence}</small></strong></div><span className="state-pill state-active">{dashboard.subscription?.status}</span></div><div className="perk-list">{dashboard.perks.map((perk) => <span key={perk}><Check size={14} /> {perk}</span>)}</div><div className="membership-charity"><HeartHandshake size={18} /><span><small>Your chosen cause</small><strong>{dashboard.impact.currentCharity}</strong></span></div><button className="text-button dashboard-cancel" disabled={actionState === "loading"} onClick={cancelMembership} type="button">Cancel membership <X size={14} /></button></> : <div className="dashboard-empty"><WalletCards size={22} /><strong>No active plan.</strong><span>Choose a plan to put your next score in motion.</span><button className="text-button" onClick={() => window.location.assign("/subscription-scores#plans")} type="button">View plans <ArrowUpRight size={14} /></button></div>}</article></section><section className="dashboard-section-grid dashboard-section-grid-lower"><article className="dashboard-panel entries-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Monthly draw</p><h2>Every entry<br /><em>leaves a trace.</em></h2></div><span className="dashboard-panel-id">DRAW / 03</span></div><p className="dashboard-panel-copy">See the score numbers recorded for each published draw, then compare them with the public result.</p><EntryRows entries={dashboard.drawEntries} /><button className="text-button" onClick={() => window.location.assign("/past-draws")} type="button">Open public archive <ArrowUpRight size={15} /></button></article><article className="dashboard-panel rewards-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Reward tracking</p><h2>Proof before<br /><em>payout.</em></h2></div><span className="dashboard-panel-id">REWARDS / 04</span></div><div className="reward-summary"><span><small>Total won</small><strong>{money(dashboard.rewardSummary.totalMinor)}</strong></span><span><small>Outstanding</small><strong>{money(dashboard.rewardSummary.outstandingMinor)}</strong></span></div><RewardRows onProof={submitProof} proofState={proofState} rewards={dashboard.rewards} /></article></section></main><footer className="dashboard-footer container"><button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><span>Private member signal / live database</span><a href="mailto:hello@digitalheroes.co.in">Need a human? <ArrowUpRight size={14} /></a></footer></div>
}
