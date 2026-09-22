import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html, OrbitControls, Sparkles as SparkleField } from "@react-three/drei"
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, CreditCard, Edit3, HeartHandshake, LockKeyhole, RotateCcw, Sparkles, Trash2, Trophy, X, Zap } from "lucide-react"
import "./subscription-page.css"
import { apiFetch } from "./apiBase"

const emptySnapshot = { activeMembers: 0, charityTotal: 0, nextDraw: "—", nextDrawDate: "", featuredCharity: null, charities: [], plans: [] }
const today = () => new Date().toISOString().slice(0, 10)

async function readJson(path, options = {}) {
  const response = await apiFetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "The membership service could not complete that request.")
  return data
}

function planPrice(plan) {
  return Number(plan?.price || 0).toLocaleString("en-IN")
}

let razorpayScriptPromise
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve()
  if (razorpayScriptPromise) return razorpayScriptPromise
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = resolve
    script.onerror = () => reject(new Error("Secure payment checkout could not be loaded."))
    document.head.appendChild(script)
  })
  return razorpayScriptPromise
}

function EngineScene({ plans, plan, onPlanSelect }) {
  const group = useRef(null)
  const { pointer } = useThree()
  const nodes = plans.map((item, index) => ({ ...item, label: `INR ${planPrice(item)} / ${item.cadence}`, position: index === 0 ? [-1.8, 0.9, 0.2] : [1.65, 0.72, 0.35], color: item.color === "coral" ? "#ff715b" : "#d7fa6b" }))
  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 0.045
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.055
    group.current.position.x += (pointer.x * 0.15 - group.current.position.x) * 0.04
    group.current.position.y += (pointer.y * 0.1 - group.current.position.y) * 0.04
  })
  return <group ref={group}><SparkleField count={60} scale={[8, 6, 4]} size={1.5} speed={0.17} color="#d7fa6b" opacity={0.36} /><mesh><icosahedronGeometry args={[1.2, 2]} /><meshPhysicalMaterial color="#d7fa6b" emissive="#465e1f" emissiveIntensity={0.9} metalness={0.25} roughness={0.3} transparent opacity={0.92} /></mesh><mesh rotation={[Math.PI / 2.1, 0.2, 0]} scale={1.45}><torusGeometry args={[1.05, 0.014, 10, 96]} /><meshBasicMaterial color="#74d5d8" transparent opacity={0.42} /></mesh><mesh rotation={[0.4, Math.PI / 2.8, 0]} scale={1.7}><torusGeometry args={[1.05, 0.01, 10, 96]} /><meshBasicMaterial color="#ff715b" transparent opacity={0.3} /></mesh>{nodes.map((node) => <group key={node.key} position={node.position}><mesh scale={plan === node.key ? 1.5 : 1} onClick={(event) => { event.stopPropagation(); onPlanSelect(node.key) }} onPointerOver={() => { document.body.style.cursor = "pointer" }} onPointerOut={() => { document.body.style.cursor = "default" }}><sphereGeometry args={[0.16, 24, 24]} /><meshBasicMaterial color={node.color} /></mesh><Html distanceFactor={2.5} position={[0, -0.34, 0]}><span className={`engine-node-label engine-node-${node.key}`}>{node.label}</span></Html></group>)}</group>
}

function EngineCanvas({ plans, plan, onPlanSelect }) {
  return <Canvas camera={{ position: [0, 0, 6.4], fov: 35 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => gl.setClearColor("#000000", 0)}><ambientLight intensity={0.75} /><pointLight color="#d7fa6b" intensity={10} distance={9} position={[3, 3, 3]} /><pointLight color="#ff715b" intensity={6} distance={8} position={[-3, -2, 2]} /><EngineScene plans={plans} plan={plan} onPlanSelect={onPlanSelect} /><OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI * 0.68} minPolarAngle={Math.PI * 0.32} rotateSpeed={0.65} /></Canvas>
}

function ScoreScene({ scores, selectedId, onScoreSelect }) {
  const group = useRef(null)
  const nodes = scores.map((score, index) => { const angle = (index / Math.max(scores.length, 1)) * Math.PI * 2 - Math.PI / 2; return { ...score, position: [Math.cos(angle) * 1.55, Math.sin(angle) * 1.15, 0.4] } })
  useFrame((_, delta) => { if (group.current) group.current.rotation.y -= delta * 0.035 })
  return <group ref={group}><mesh rotation={[0.3, 0.4, 0]}><torusKnotGeometry args={[0.78, 0.16, 96, 16]} /><meshPhysicalMaterial color="#d7fa6b" emissive="#344516" emissiveIntensity={0.8} metalness={0.28} roughness={0.28} /></mesh><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.72, 0.012, 8, 96]} /><meshBasicMaterial color="#ff715b" transparent opacity={0.35} /></mesh>{nodes.map((score) => <group key={score.id} position={score.position}><mesh scale={selectedId === score.id ? 1.45 : 1} onClick={(event) => { event.stopPropagation(); onScoreSelect(score.id) }} onPointerOver={() => { document.body.style.cursor = "pointer" }} onPointerOut={() => { document.body.style.cursor = "default" }}><sphereGeometry args={[0.14, 20, 20]} /><meshBasicMaterial color={selectedId === score.id ? "#efffb2" : "#74d5d8"} /></mesh><Html distanceFactor={2.5} position={[0, -0.3, 0]}><span className="score-node-label">{score.value}</span></Html></group>)}</group>
}

function ScoreCanvas({ scores, selectedId, onScoreSelect }) {
  return <Canvas camera={{ position: [0, 0, 5.7], fov: 34 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => gl.setClearColor("#000000", 0)}><ambientLight intensity={0.78} /><pointLight color="#d7fa6b" intensity={9} distance={8} position={[2, 3, 3]} /><pointLight color="#74d5d8" intensity={5} distance={7} position={[-2, -2, 2]} /><ScoreScene scores={scores} selectedId={selectedId} onScoreSelect={onScoreSelect} /><OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI * 0.68} minPolarAngle={Math.PI * 0.32} rotateSpeed={0.6} /></Canvas>
}

function CheckoutPanel({ plan, charity, onCharityChange, snapshot, session, subscription, onRefreshAccount }) {
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")
  const selectedPlan = snapshot.plans.find((item) => item.key === plan)
  const charities = snapshot.charities
  async function submit(event) {
    event.preventDefault(); setStatus("loading"); setMessage("")
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") || "").trim()
    const email = String(form.get("email") || "").trim()
    if (name.length < 2) { setMessage("Enter your name."); setStatus("error"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMessage("Enter a valid email address."); setStatus("error"); return }
    if (!selectedPlan || !charity) { setMessage("Choose an available plan and charity."); setStatus("error"); return }
    try {
      const data = await readJson("/api/checkout/session", { method: "POST", body: JSON.stringify({ name, email, plan, charity, currency: "INR" }) })
      if (data.provider === "razorpay") {
        await loadRazorpay()
        const checkout = new window.Razorpay({
          ...data.checkoutOptions,
          handler: async (payment) => {
            try {
              await readJson("/api/checkout/razorpay/verify", { method: "POST", body: JSON.stringify(payment) })
              setMessage("Payment confirmed. Your membership is now active.")
              setStatus("success")
              await onRefreshAccount?.()
            } catch (error) {
              setMessage(error.message || "Payment verification could not be completed.")
              setStatus("error")
            }
          },
          modal: { ondismiss: () => setStatus("idle") },
        })
        checkout.on("payment.failed", (response) => {
          setMessage(response.error?.description || "Payment was not completed.")
          setStatus("error")
        })
        checkout.open()
        return
      }
      if (data.checkoutUrl) { window.location.assign(data.checkoutUrl); return }
      setMessage(`Checkout session ${data.id} created.`); setStatus("success"); await onRefreshAccount?.()
    } catch (error) { setMessage(error.message || "Checkout could not be started."); setStatus("error") }
  }
  if (status === "success") return <div className="checkout-success"><span className="success-mark"><Check size={22} /></span><p className="eyebrow"><span className="eyebrow-line" /> Payment confirmed</p><h3>{message}</h3><p>Your payment provider has confirmed the checkout. The backend will keep your membership status in sync.</p><button className="text-button" onClick={() => setStatus("idle")} type="button">Start another checkout <RotateCcw size={15} /></button></div>
  return <form className="checkout-form" onSubmit={submit} noValidate><div className="checkout-step"><span>02</span><div><strong>Secure payment checkout</strong><small>After payment, your active membership is read back from the database.</small></div><LockKeyhole size={16} /></div>{session ? <p className="score-status score-status-success">Signed in as {session.email}. Current status: {subscription?.status || (session.plan ? "active" : "inactive")}.</p> : null}<label>Name<input autoComplete="name" name="name" placeholder="Your name" required /></label><label>Email<input autoComplete="email" name="email" placeholder="you@example.com" required type="email" /></label><label>Charity<select value={charity} onChange={(event) => onCharityChange(event.target.value)} required>{charities.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><div className="checkout-total"><span>{selectedPlan?.name || "Plan"}</span><strong>INR {planPrice(selectedPlan)}</strong><small>/{selectedPlan?.cadence || "—"}</small></div>{status === "error" ? <p className="form-error" role="alert">{message}</p> : null}<button className="button button-primary full-width" disabled={status === "loading" || !selectedPlan || !charity} type="submit">{status === "loading" ? "Opening secure checkout..." : "Continue to checkout"}<ArrowUpRight size={16} /></button><p className="checkout-note"><CreditCard size={14} /> Secure payment handoff / INR billing</p><p className="checkout-impact"><HeartHandshake size={14} /> At least 10% of INR {planPrice(selectedPlan)} supports {charity || "your chosen cause"}.</p></form>
}

function LoginPanel({ onAuthenticated }) {
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")
  async function submit(event) {
    event.preventDefault(); setStatus("loading"); setMessage("")
    const form = new FormData(event.currentTarget)
    try { const data = await readJson("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) }); onAuthenticated(data.member) } catch (error) { setMessage(error.message || "Sign in could not be completed."); setStatus("error") }
  }
  return <form className="score-form" onSubmit={submit}><div className="checkout-step"><span>01</span><div><strong>Sign in to manage scores</strong><small>Members can add, edit, and remove their own Stableford scores.</small></div><LockKeyhole size={16} /></div><label>Email<input autoComplete="email" name="email" placeholder="member@example.com" required type="email" /></label><label>Password<input autoComplete="current-password" name="password" placeholder="Your password" required type="password" /></label>{status === "error" ? <p className="score-status score-status-error" role="alert">{message}</p> : null}<button className="button button-primary full-width" disabled={status === "loading"} type="submit">{status === "loading" ? "Signing in..." : "Sign in to scores"}<ArrowUpRight size={16} /></button></form>
}

function SubscriptionStatus({ session, subscription, onRefresh, onLogout }) {
  const [status, setStatus] = useState("idle")
  if (!session) return null
  async function cancel() {
    setStatus("loading")
    try { await readJson("/api/member/subscription/cancel", { method: "POST" }); await onRefresh(); setStatus("success") } catch (error) { setStatus(error.message || "Subscription could not be cancelled.") }
  }
  const active = subscription?.status === "active" || Boolean(session.plan)
  return <div className="subscription-account"><div><span className="account-kicker">Account / {session.email}</span><strong>{active ? `${subscription?.plan || session.plan} membership active` : "No active membership"}</strong><small>{active ? `Supporting ${subscription?.charity || session.charity || "your chosen cause"}` : "Start a checkout above to activate membership."}</small></div>{active ? <button className="text-button" disabled={status === "loading"} onClick={cancel} type="button">{status === "loading" ? "Cancelling..." : "Cancel membership"} <X size={14} /></button> : null}<button className="text-button" onClick={onLogout} type="button">Sign out</button>{status === "success" ? <span className="score-status score-status-success">Membership status updated.</span> : typeof status === "string" && status !== "idle" ? <span className="score-status score-status-error">{status}</span> : null}</div>
}

function scoreValidation(date, value, editingId, scores) {
  if (!date) return "Choose the round date."
  if (date > today()) return "Round date cannot be in the future."
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1 || number > 45) return "Use a whole Stableford score from 1 to 45."
  if (scores.some((score) => score.date === date && score.id !== editingId)) return "A score already exists for that date. Edit the existing round instead."
  return ""
}

function ScorePanel({ session, scores, selectedScore, editingId, scoreDate, scoreValue, scoreStatus, validation, onSelect, onSave, onDelete, onEdit, onCancel, onAuthenticated, onLogout }) {
  return <div className="score-entry-panel" id="score-entry">{session ? <><div className="score-entry-top"><span>ENTRY / {editingId ? "EDIT" : "NEW"}</span><span><span><LockKeyhole size={14} /> {session.role}</span><button className="text-button" onClick={onLogout} type="button">Sign out</button></span></div><form className="score-form" onSubmit={onSave} noValidate><label>Stableford score<input aria-invalid={Boolean(validation)} max="45" min="1" onChange={(event) => onSelect({ scoreValue: event.target.value })} required step="1" type="number" value={scoreValue} /></label><label>Round date<input aria-invalid={Boolean(validation)} max={today()} onChange={(event) => onSelect({ scoreDate: event.target.value })} required type="date" value={scoreDate} /></label>{validation ? <p className="score-status score-status-error" role="alert">{validation}</p> : null}{scoreStatus.type !== "idle" ? <p className={`score-status score-status-${scoreStatus.type}`} role={scoreStatus.type === "error" ? "alert" : "status"}>{scoreStatus.message}</p> : null}<p className="score-limit-note">{scores.length}/5 rounds stored. {scores.length === 5 && !editingId ? "Adding a round rolls the oldest one off automatically." : "Your latest five rounds stay in play."}</p><div className="score-form-actions"><button className="button button-primary" disabled={scoreStatus.type === "loading" || Boolean(validation)} type="submit">{editingId ? "Update score" : "Add score"}<ArrowUpRight size={16} /></button>{editingId ? <button className="text-button" onClick={onCancel} type="button">Cancel</button> : null}</div></form><div className="score-list">{scores.map((score, index) => <div className={`score-row ${selectedScore === score.id ? "score-row-active" : ""}`} key={score.id} onClick={() => onSelect({ selectedScore: score.id })}><span className="score-rank">0{index + 1}</span><strong>{score.value}</strong><span>{score.date}</span><span className="score-row-actions"><button aria-label={`Edit score ${score.value}`} onClick={(event) => { event.stopPropagation(); onEdit(score) }} type="button"><Edit3 size={14} /></button><button aria-label={`Delete score ${score.value}`} onClick={(event) => { event.stopPropagation(); onDelete(score.id) }} type="button"><Trash2 size={14} /></button></span></div>)}</div></> : <LoginPanel onAuthenticated={onAuthenticated} />}</div>
}

export default function SubscriptionScoresPage() {
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const [plan, setPlan] = useState("")
  const [charity, setCharity] = useState("")
  const [scores, setScores] = useState([])
  const [selectedScore, setSelectedScore] = useState(null)
  const [session, setSession] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [checkoutNotice, setCheckoutNotice] = useState("")
  const [scoreDate, setScoreDate] = useState(today)
  const [scoreValue, setScoreValue] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [scoreStatus, setScoreStatus] = useState({ type: "idle", message: "" })

  async function loadPublic() {
    const data = await readJson("/api/impact")
    setSnapshot(data)
    setPlan((current) => current || data.plans?.[0]?.key || "")
    setCharity((current) => current || data.featuredCharity?.name || data.charities?.[0]?.name || "")
  }

  async function loadAccount(member = null) {
    const current = member || (await readJson("/api/auth/session")).member
    setSession(current)
    const [scoreData, subscriptionData] = await Promise.all([readJson("/api/scores"), readJson("/api/member/subscription")])
    setScores(scoreData.scores || []); setSelectedScore(scoreData.scores?.[0]?.id || null); setSubscription(subscriptionData.subscription || null)
  }

  useEffect(() => {
    let active = true
    loadPublic().catch(() => {})
    readJson("/api/auth/session").then((data) => loadAccount(data.member)).catch(() => { if (active) { setSession(null); setScores([]); setSubscription(null) } })
    const publicInterval = window.setInterval(() => loadPublic().catch(() => {}), 10000)
    const params = new URLSearchParams(window.location.search)
    if (params.get("checkout") === "cancelled") setCheckoutNotice("Checkout was cancelled. Your membership has not changed.")
    if (params.get("checkout") === "success" && params.get("session_id")) setCheckoutNotice("Payment received. Checking the active subscription status…")
    return () => { active = false; window.clearInterval(publicInterval) }
  }, [])

  useEffect(() => {
    if (!session) return undefined
    const interval = window.setInterval(() => loadAccount().catch(() => {}), 5000)
    return () => window.clearInterval(interval)
  }, [session?.id])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get("session_id")
    if (params.get("checkout") !== "success" || !sessionId) return undefined
    let active = true
    let timer
    const check = async () => {
      try {
        const data = await readJson(`/api/checkout/session/status?session_id=${encodeURIComponent(sessionId)}`)
        if (!active) return
        if (data.status === "active") { setCheckoutNotice("Payment received. Your membership is active in the database."); if (session) await loadAccount() }
        else if (data.status === "expired" || data.status === "cancelled") setCheckoutNotice("The checkout expired. Your membership has not changed.")
        else { setCheckoutNotice("Payment received. Stripe is confirming your membership now."); timer = window.setTimeout(check, 2000) }
      } catch { if (active) setCheckoutNotice("Payment received. Stripe is confirming your membership now.") }
    }
    check()
    return () => { active = false; window.clearTimeout(timer) }
  }, [session?.id])

  async function saveScore(event) {
    event.preventDefault()
    const validation = scoreValidation(scoreDate, scoreValue, editingId, scores)
    if (validation) { setScoreStatus({ type: "error", message: validation }); return }
    setScoreStatus({ type: "loading", message: "" })
    const method = editingId ? "PUT" : "POST"; const url = editingId ? `/api/scores/${editingId}` : "/api/scores"
    try { const data = await readJson(url, { method, body: JSON.stringify({ date: scoreDate, value: Number(scoreValue) }) }); setScores(data.scores); setSelectedScore(data.scores[0]?.id || null); setEditingId(null); setScoreValue(""); setScoreDate(today()); setScoreStatus({ type: "success", message: editingId ? "Score updated in your rolling window." : "Score added. Your latest five stay in play." }); await loadAccount() } catch (error) { setScoreStatus({ type: "error", message: error.message || "Score could not be saved." }) }
  }

  async function deleteScore(id) {
    setScoreStatus({ type: "loading", message: "" })
    try { const data = await readJson(`/api/scores/${id}`, { method: "DELETE" }); setScores(data.scores); setSelectedScore(data.scores[0]?.id || null); setScoreStatus({ type: "success", message: "Score removed from the rolling window." }); await loadAccount() } catch (error) { setScoreStatus({ type: "error", message: error.message || "Score could not be removed." }) }
  }

  function editScore(score) { setEditingId(score.id); setScoreDate(score.date); setScoreValue(score.value); setScoreStatus({ type: "idle", message: "" }); document.getElementById("score-entry")?.scrollIntoView({ behavior: "auto", block: "center" }) }
  function selectScore(change) { if (change.scoreValue !== undefined) setScoreValue(change.scoreValue); if (change.scoreDate !== undefined) setScoreDate(change.scoreDate); if (change.selectedScore !== undefined) setSelectedScore(change.selectedScore) }
  function cancelEdit() { setEditingId(null); setScoreValue(""); setScoreDate(today()); setScoreStatus({ type: "idle", message: "" }) }
  function logout() { readJson("/api/auth/logout", { method: "POST" }).finally(() => { setSession(null); setSubscription(null); setScores([]); setSelectedScore(null); cancelEdit() }) }

  const selectedPlan = snapshot.plans.find((item) => item.key === plan)
  const selectedScoreData = scores.find((score) => score.id === selectedScore) || scores[0]
  const validation = session ? scoreValidation(scoreDate, scoreValue, editingId, scores) : ""
  return <div className="subscription-page"><header className="subscription-header"><div className="announcement"><span className="live-dot" /> Digital Heroes / membership engine <ArrowUpRight size={13} /></div><nav className="subscription-nav container" aria-label="Page navigation"><button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><div className="subscription-nav-links"><button onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })} type="button">Plans</button><button onClick={() => document.getElementById("scores")?.scrollIntoView({ behavior: "smooth" })} type="button">Scores</button><button className="nav-cta" onClick={() => window.location.assign("/objectives-roles")} type="button"><ArrowLeft size={15} /> Objectives</button></div></nav></header><main>{checkoutNotice ? <div className="checkout-return-notice container" role="status">{checkoutNotice}</div> : null}<section className="subscription-hero container"><div className="subscription-hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> The membership engine / 003</p><h1>Make the plan.<br /><em>Keep the score.</em></h1><p className="subscription-hero-lede">Choose a live plan, keep your latest five Stableford scores ready, and see every membership change reflected from the active database.</p><div className="subscription-hero-actions"><button className="button button-primary" onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })} type="button">Choose a plan <ChevronRight size={16} /></button><button className="text-button" onClick={() => document.getElementById("scores")?.scrollIntoView({ behavior: "smooth" })} type="button">Manage scores <ArrowUpRight size={15} /></button></div><div className="subscription-proof"><span><Zap size={15} /> {snapshot.activeMembers.toLocaleString()} active members</span><i /><span><Trophy size={15} /> next draw in {snapshot.nextDraw}</span></div></div><div className="engine-card"><div className="engine-card-topline"><span>Membership signal / live</span><span>{snapshot.nextDrawDate || "—"}</span></div><div className="engine-canvas"><EngineCanvas plans={snapshot.plans} plan={plan} onPlanSelect={setPlan} /><span className="canvas-hint">drag to orbit / click a plan</span></div><div className="engine-caption"><div><p className="eyebrow"><span className="eyebrow-line" /> Active plan</p><h2>{selectedPlan ? `${selectedPlan.name} / INR ${planPrice(selectedPlan)}` : "Loading plans…"}</h2></div><Sparkles color="#d7fa6b" size={22} /></div></div></section><div className="subscription-ticker"><div className="subscription-ticker-inner container"><span>{snapshot.activeMembers.toLocaleString()} active members</span><i /><strong>10% minimum to a chosen cause</strong><i /><span>next draw in {snapshot.nextDraw}</span><i /><span>database-backed status</span></div></div><section className="plans-section container" id="plans"><div className="subscription-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Choose your membership</p><h2>Good intent needs<br /><em>a little structure.</em></h2></div><p>Every plan is read from the backend catalog. Choose a cause, complete checkout, and return to a status sourced from the membership database.</p></div><div className="plans-layout"><div className="plan-cards">{snapshot.plans.map((item) => <button className={`subscription-plan subscription-plan-${item.color} ${plan === item.key ? "subscription-plan-active" : ""}`} key={item.key} onClick={() => setPlan(item.key)} type="button"><span className="subscription-plan-top"><span>{item.name}</span><span>{item.note}</span></span><span className="subscription-price"><strong>{planPrice(item)}</strong><small>INR / {item.cadence}</small></span><span className="subscription-feature-list">{item.features.map((feature) => <span key={feature}><Check size={14} /> {feature}</span>)}</span><span className="plan-select-line">{plan === item.key ? "Selected" : "Select plan"}<ChevronRight size={15} /></span></button>)}</div><div className="checkout-panel"><div className="checkout-panel-top"><span>CHECKOUT / 01</span><span><LockKeyhole size={14} /> database linked</span></div><div className="checkout-plan-summary"><span className="checkout-plan-orb" /><div><strong>{selectedPlan?.name || "Plans loading"}</strong><small>{selectedPlan ? `INR ${planPrice(selectedPlan)} / ${selectedPlan.cadence}` : "Choose a live plan"}</small></div><CreditCard size={17} /></div><CheckoutPanel charity={charity} onCharityChange={setCharity} onRefreshAccount={() => session ? loadAccount() : Promise.resolve()} plan={plan} session={session} snapshot={snapshot} subscription={subscription} /></div></div><SubscriptionStatus onLogout={logout} onRefresh={() => loadAccount()} session={session} subscription={subscription} /></section><section className="scores-section" id="scores"><div className="container"><div className="subscription-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> The rolling window</p><h2>Five rounds.<br /><em>One live signal.</em></h2></div><p>Your score record is stored per member in the active database. Add a sixth round and the oldest stored score is removed automatically.</p></div><div className="scores-layout"><div className="score-orbit-card"><div className="score-orbit-topline"><span>Score constellation / live</span><span>{scores.length} / 5 stored</span></div><div className="score-canvas"><ScoreCanvas scores={scores} selectedId={selectedScore} onScoreSelect={setSelectedScore} /><span className="canvas-hint">drag to orbit / click a score</span></div><div className="score-focus"><div><span>Selected round</span><strong>{selectedScoreData ? selectedScoreData.value : "—"}</strong></div><span>{selectedScoreData?.date || "No round selected"}</span><small>Stableford</small></div></div><ScorePanel editingId={editingId} onAuthenticated={(member) => loadAccount(member).catch((error) => setScoreStatus({ type: "error", message: error.message }))} onCancel={cancelEdit} onDelete={deleteScore} onEdit={editScore} onLogout={logout} onSave={saveScore} onSelect={selectScore} scoreDate={scoreDate} scoreStatus={scoreStatus} scoreValue={scoreValue} scores={scores} selectedScore={selectedScore} session={session} validation={validation} /></div></div></section></main><footer className="subscription-footer container"><span>digital heroes / live membership system</span><a href="/">Return to the main signal <ArrowUpRight size={14} /></a></footer></div>
}
