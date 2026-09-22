import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Sparkles as SparkleField } from "@react-three/drei"
import RolesObjectivesPage from "./RolesObjectivesPage"
import SubscriptionScoresPage from "./SubscriptionScoresPage"
import AdminDashboardPage from "./AdminDashboardPage"
import PastDrawsPage from "./PastDrawsPage"
import HelpCenterPage from "./HelpCenterPage"
import SubscriberDashboardPage from "./SubscriberDashboardPage"
import WinnerVerificationPage from "./WinnerVerificationPage"
import { apiFetch } from "./apiBase"
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleDollarSign,
  HeartHandshake,
  Menu,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react"

const emptySnapshot = { activeMembers: 0, charityTotal: 0, charityContributionMinor: 0, prizePoolMinor: 0, nextDraw: "—", nextDrawDate: "", featuredCharity: null, charities: [], plans: [] }
const causeColors = ["lime", "coral", "blue"]

const orbitCopy = {
  impact: {
    kicker: "The impact signal",
    title: "Your fee does more than enter a draw.",
    body: "At least 10% of every subscription goes to the cause you choose. Watch the signal move as the community grows.",
  },
  draw: {
    kicker: "The monthly draw",
    title: "A better score can unlock a bigger moment.",
    body: "Enter your latest Stableford score and land in the monthly 3, 4, or 5-number match. The jackpot rolls when nobody claims it.",
  },
  charity: {
    kicker: "The chosen cause",
    title: "You decide where the good lands.",
    body: "Switch your charity any time from your account. No locked-in cause, no hidden financials, just a visible trail of impact.",
  },
}

function SignalOrb({ activeNode, onNodeSelect }) {
  const group = useRef(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * (hovered ? 0.28 : 0.12)
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.28) * 0.08
  })

  const nodes = [
    { key: "impact", position: [0, 1.55, 0.18], color: "#d7fa6b" },
    { key: "draw", position: [1.4, -0.1, 0.32], color: "#ff715b" },
    { key: "charity", position: [-1.35, -0.48, 0.26], color: "#74d5d8" },
  ]

  return (
    <group ref={group}>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation()
          setHovered(true)
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = "default"
        }}
        onClick={(event) => {
          event.stopPropagation()
          onNodeSelect("impact")
        }}
      >
        <icosahedronGeometry args={[1.1, 2]} />
        <meshPhysicalMaterial
          color={hovered ? "#efffb2" : "#d7fa6b"}
          emissive="#516b22"
          emissiveIntensity={hovered ? 1.5 : 0.8}
          metalness={0.25}
          roughness={0.26}
          transparent
          opacity={0.94}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2.2, 0.3, 0]} scale={1.34}>
        <torusGeometry args={[1.05, 0.012, 12, 96]} />
        <meshBasicMaterial color="#efffb2" transparent opacity={0.65} />
      </mesh>
      <mesh rotation={[0.3, Math.PI / 2.8, 0]} scale={1.52}>
        <torusGeometry args={[1.05, 0.008, 10, 96]} />
        <meshBasicMaterial color="#ff715b" transparent opacity={0.38} />
      </mesh>
      {nodes.map((node) => (
        <mesh
          key={node.key}
          position={node.position}
          scale={activeNode === node.key ? 1.3 : 0.88}
          onClick={(event) => {
            event.stopPropagation()
            onNodeSelect(node.key)
          }}
          onPointerOver={() => {
            document.body.style.cursor = "pointer"
          }}
          onPointerOut={() => {
            document.body.style.cursor = "default"
          }}
        >
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshBasicMaterial color={node.color} />
        </mesh>
      ))}
    </group>
  )
}

function ImpactCanvas({ activeNode, onNodeSelect }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 35 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => gl.setClearColor("#000000", 0)}
    >
      <ambientLight intensity={0.72} />
      <pointLight color="#d7fa6b" intensity={12} distance={8} position={[3, 3, 3]} />
      <pointLight color="#ff715b" intensity={7} distance={7} position={[-3, -2, 2]} />
      <SignalOrb activeNode={activeNode} onNodeSelect={onNodeSelect} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        maxPolarAngle={Math.PI * 0.67}
        minPolarAngle={Math.PI * 0.33}
        rotateSpeed={0.6}
      />
    </Canvas>
  )
}

function AmbientScene() {
  const group = useRef(null)
  const { pointer } = useThree()
  const shards = useMemo(
    () => [
      { position: [-3.9, 1.5, -0.8], color: "#d7fa6b", scale: 0.32 },
      { position: [3.3, 1.8, -1.4], color: "#74d5d8", scale: 0.24 },
      { position: [4.1, -1.7, -0.4], color: "#ff715b", scale: 0.4 },
      { position: [-3.7, -1.9, -1.2], color: "#74d5d8", scale: 0.2 },
    ],
    [],
  )

  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 0.035
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.16) * 0.035
    group.current.position.x += (pointer.x * 0.18 - group.current.position.x) * 0.035
    group.current.position.y += (pointer.y * 0.12 - group.current.position.y) * 0.035
  })

  return (
    <group ref={group}>
      <SparkleField count={52} scale={[12, 7, 4]} size={1.5} speed={0.18} color="#d7fa6b" opacity={0.32} />
      <mesh position={[0, 0.15, -1.25]} rotation={[0.18, 0.35, 0.12]}>
        <icosahedronGeometry args={[1.25, 1]} />
        <meshBasicMaterial color="#d7fa6b" wireframe transparent opacity={0.075} />
      </mesh>
      <mesh position={[0.15, 0.1, -1.4]} rotation={[Math.PI / 2.4, 0.15, 0]}>
        <torusGeometry args={[1.72, 0.012, 8, 96]} />
        <meshBasicMaterial color="#ff715b" transparent opacity={0.2} />
      </mesh>
      {shards.map((shard, index) => (
        <mesh key={index} position={shard.position} scale={shard.scale} rotation={[0.5, index * 0.75, 0.2]}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={shard.color} transparent opacity={0.72} />
        </mesh>
      ))}
    </group>
  )
}

function AmbientCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 7], fov: 36 }} dpr={[1, 1.35]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => gl.setClearColor("#000000", 0)}>
      <ambientLight intensity={0.8} />
      <pointLight color="#d7fa6b" intensity={6} distance={12} position={[3, 2, 3]} />
      <pointLight color="#ff715b" intensity={4} distance={10} position={[-3, -2, 2]} />
      <AmbientScene />
    </Canvas>
  )
}

function Modal({ title, eyebrow, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="modal-card"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Close dialog" className="icon-button modal-close" onClick={onClose} type="button">
          <X size={18} />
        </button>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  )
}

function SignupModal({ plan, planName, charity, onClose }) {
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")

  async function submit(event) {
    event.preventDefault()
    setStatus("loading")
    const form = new FormData(event.currentTarget)
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      plan,
      charity,
    }
    try {
      const response = await apiFetch("/api/subscribe", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new TypeError("Static preview response")
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setMessage(data.message)
      setStatus("success")
    } catch (error) {
      setMessage(error.message || "The signup could not be completed.")
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <Modal eyebrow="Signal received" onClose={onClose} title={message}>
        <p className="modal-copy">We will keep your place warm while the next draw takes shape.</p>
        <div className="success-mark"><Check size={23} /></div>
        <button className="button button-primary full-width" onClick={onClose} type="button">Back to the mission</button>
      </Modal>
    )
  }

  return (
    <Modal eyebrow="Start your impact" onClose={onClose} title="A small commitment. A wider ripple.">
      <p className="modal-copy">Join the early list with the {planName || plan} plan and support {charity}.</p>
      <form className="signup-form" onSubmit={submit}>
        <label>Name<input autoComplete="name" name="name" placeholder="Your name" required /></label>
        <label>Email<input autoComplete="email" name="email" placeholder="you@example.com" required type="email" /></label>
        {status === "error" ? <p className="form-error" role="alert">{message}</p> : null}
        <button className="button button-primary full-width" disabled={status === "loading"} type="submit">
          {status === "loading" ? "Joining..." : "Reserve my place"}<ArrowUpRight size={16} />
        </button>
      </form>
    </Modal>
  )
}

function LandingPage() {
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const [snapshotStatus, setSnapshotStatus] = useState("loading")
  const [activeNode, setActiveNode] = useState("impact")
  const [dialog, setDialog] = useState(null)
  const [plan, setPlan] = useState("")
  const [selectedCharity, setSelectedCharity] = useState("")
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    let active = true
    const loadSnapshot = () => apiFetch("/api/impact").then((response) => {
      if (!response.ok) throw new Error("The live impact signal is unavailable.")
      return response.json()
    }).then((data) => {
      if (!active) return
      setSnapshot(data)
      setSnapshotStatus("ready")
      setPlan((current) => data.plans?.some((item) => item.key === current) ? current : data.plans?.[0]?.key || "")
      setSelectedCharity((current) => data.charities?.some((item) => item.name === current) ? current : data.featuredCharity?.name || data.charities?.[0]?.name || "")
    }).catch(() => { if (active) setSnapshotStatus("error") })
    loadSnapshot()
    const interval = window.setInterval(loadSnapshot, 10000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])

  const activeCopy = orbitCopy[activeNode]
  const liveCharities = snapshot.charities.map((cause, index) => ({ ...cause, color: causeColors[index % causeColors.length] }))
  const selectedPlan = snapshot.plans.find((item) => item.key === plan)
  const price = selectedPlan ? Number(selectedPlan.price).toLocaleString("en-IN") : "—"

  function scrollTo(id) {
    setMobileMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="announcement"><span className="live-dot" /> Now building a fairer kind of sport <ArrowUpRight size={13} /></div>
        <nav className="nav container" aria-label="Primary navigation">
          <button className="wordmark" onClick={() => scrollTo("top")} type="button">
            <span className="wordmark-dot" /> digital <strong>heroes</strong>
          </button>
          <div className={`nav-links ${mobileMenu ? "nav-links-open" : ""}`}>
            <button onClick={() => scrollTo("signal")} type="button">The signal</button>
            <button onClick={() => scrollTo("draw")} type="button">How it moves</button>
            <button onClick={() => scrollTo("causes")} type="button">Causes</button>
            <button onClick={() => window.location.assign("/past-draws")} type="button">Past draws</button>
            <button onClick={() => window.location.assign("/help-center")} type="button">Help center</button>
             <button onClick={() => window.location.assign("/objectives-roles")} type="button">Objectives</button>
             <button onClick={() => window.location.assign("/subscription-scores")} type="button">Plans & scores</button>
             <button onClick={() => window.location.assign("/subscriber-dashboard")} type="button">Member dashboard</button>
             <button className="nav-cta" onClick={() => setDialog("signup")} type="button">Join the early list <ArrowUpRight size={15} /></button>
          </div>
          <button aria-label={mobileMenu ? "Close menu" : "Open menu"} className="icon-button menu-button" onClick={() => setMobileMenu(!mobileMenu)} type="button">
            {mobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
      </header>

      <main id="main-content">
        <section className="hero container" id="top">
          <div aria-hidden="true" className="hero-ambient">
            <AmbientCanvas />
          </div>
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> A platform for people who play with purpose</p>
            <h1>Every score can <em>move</em> the world.</h1>
            <p className="hero-lede">Digital Heroes turns your latest round into a chance to win, give back, and see exactly where the good lands.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => setDialog("signup")} type="button">Build my impact <ArrowUpRight size={17} /></button>
              <button className="text-button" onClick={() => setDialog("draw")} type="button">See how the draw works <ArrowDownRight size={16} /></button>
            </div>
            <div className="hero-proof"><ShieldCheck size={17} /><span>Transparent by design</span><span className="proof-separator" /><span>10% minimum to charity</span></div>
          </div>

          <div className="signal-card" id="signal">
            <div className="signal-topline"><span>Impact signal / 001</span><span className="signal-status"><span className="live-dot" /> Live model</span></div>
            <div className="canvas-wrap"><ImpactCanvas activeNode={activeNode} onNodeSelect={setActiveNode} /><div className="canvas-crosshair crosshair-one" /><div className="canvas-crosshair crosshair-two" /><span className="canvas-hint"><MousePointer2 size={13} /> drag to orbit / click a node</span></div>
            <div className="signal-caption"><div><p className="eyebrow">{activeCopy.kicker}</p><h2>{activeCopy.title}</h2></div><Sparkles className="signal-spark" size={21} /></div>
            <p className="signal-body">{activeCopy.body}</p>
            <div className="node-switcher" role="group" aria-label="Explore the impact signal">
              {Object.keys(orbitCopy).map((key) => <button aria-pressed={activeNode === key} className={activeNode === key ? "node-button active" : "node-button"} key={key} onClick={() => setActiveNode(key)} type="button"><span />{key}</button>)}
            </div>
          </div>
        </section>

        <section className="ticker-band" aria-label="Live impact summary">
          <div className="ticker-inner container"><span>{snapshotStatus === "error" ? "Live impact data unavailable" : `${snapshot.activeMembers.toLocaleString()} people are already in motion`}</span><i /> <strong>at least 10% of every plan goes to a cause</strong><i /> <span>next draw in {snapshot.nextDraw}</span><i /> <span>{snapshotStatus === "ready" ? "live model" : "connecting"}</span></div>
        </section>

        <section className="section container" id="draw">
          <div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> The simple part</p><h2>Three moves.<br /><em>One wider ripple.</em></h2></div><p className="section-intro">No clubhouse jargon. No smoke and mirrors. Just a clear line from your score to a monthly moment and a cause you can see.</p></div>
          <div className="step-grid">
            <article className="step-card"><div className="step-index">01</div><CircleDollarSign size={23} /><h3>Choose your cause</h3><p>Pick the charity that matters to you. You can switch it as your story changes.</p><button className="card-link" onClick={() => scrollTo("causes")} type="button">Explore causes <ArrowUpRight size={15} /></button></article>
            <article className="step-card step-card-highlight"><div className="step-index">02</div><Trophy size={23} /><h3>Log your latest score</h3><p>Enter your last five Stableford scores. Your newest score replaces the oldest.</p><button className="card-link" onClick={() => setDialog("draw")} type="button">Understand the draw <ArrowUpRight size={15} /></button></article>
            <article className="step-card"><div className="step-index">03</div><HeartHandshake size={23} /><h3>Watch good grow</h3><p>At least 10% goes to your cause. The rest helps the prize pool keep moving.</p><button className="card-link" onClick={() => setDialog("signup")} type="button">Reserve a place <ArrowUpRight size={15} /></button></article>
          </div>
        </section>

        <section className="dark-break container">
          <div className="pool-copy"><p className="eyebrow eyebrow-light"><span className="eyebrow-line" /> The reward engine</p><h2>The best part is not the jackpot.</h2><p>It is knowing the full pool, the split, and the rollover before you play. Your chance is visible. So is your impact.</p><button className="button button-light" onClick={() => setDialog("draw")} type="button">See the pool logic <ArrowUpRight size={16} /></button></div>
          <div className="pool-visual"><div className="pool-total"><span>Next pool / forecast</span><strong>INR {(Number(snapshot.prizePoolMinor || 0) / 100).toLocaleString("en-IN")}</strong><small>from a live community of {snapshot.activeMembers.toLocaleString()}</small></div><div className="pool-bars"><div className="pool-row"><span>5-number match <b>jackpot</b></span><i><i style={{ width: "40%" }} /></i><strong>40%</strong></div><div className="pool-row"><span>4-number match</span><i><i style={{ width: "35%" }} /></i><strong>35%</strong></div><div className="pool-row"><span>3-number match</span><i><i style={{ width: "25%" }} /></i><strong>25%</strong></div></div></div>
        </section>

        <section className="section container" id="causes">
          <div className="section-heading cause-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Your cause, your call</p><h2>Good looks<br /><em>different to everyone.</em></h2></div><p className="section-intro">Meet a few of the causes in the first wave. Every profile is a promise to keep the numbers human and the stories visible.</p></div>
          <div className="cause-grid">{liveCharities.length ? liveCharities.map((cause) => <button aria-pressed={selectedCharity === cause.name} className={`cause-card cause-${cause.color} ${selectedCharity === cause.name ? "selected" : ""}`} key={cause.id} onClick={() => setSelectedCharity(cause.name)} type="button"><span className="cause-topline"><span>{cause.category}</span><ArrowUpRight size={17} /></span><span className="cause-mark" /><strong>{cause.name}</strong><span>{cause.note}</span>{selectedCharity === cause.name ? <span className="selected-note"><Check size={13} /> Your current selection</span> : null}</button>) : <p className="section-intro">No active causes are available yet.</p>}</div>
          <div className="cause-foot"><span>Featured signal</span><strong>{snapshot.featuredCharity?.name || "No active cause"}</strong><span>{snapshot.charityTotal.toLocaleString()} impact points in motion</span><button className="text-button" disabled={!selectedCharity} onClick={() => setDialog("signup")} type="button">Make it yours <ArrowUpRight size={15} /></button></div>
        </section>

        <section className="subscribe-section container" id="join">
          <div><p className="eyebrow eyebrow-light"><span className="eyebrow-line" /> Make the first move</p><h2>Choose a plan.<br /><em>Leave a mark.</em></h2><p>Start monthly, or commit for a year and keep more energy in the pool.</p></div>
          <div className="plan-panel"><div className="plan-toggle" role="group" aria-label="Choose a plan">{snapshot.plans.map((item) => <button aria-pressed={plan === item.key} key={item.key} onClick={() => setPlan(item.key)} type="button">{item.name}{item.key === "yearly" ? <span>{item.note}</span> : null}</button>)}</div><div className="plan-price"><span>INR</span><strong>{price}</strong><small>/{selectedPlan?.cadence || "—"}</small></div><div className="plan-detail"><span><Check size={14} /> {selectedPlan?.features?.[0] || "Flexible membership"}</span><span><Check size={14} /> Minimum 10% to {selectedCharity || "a chosen cause"}</span></div><button className="button button-primary full-width" disabled={!selectedPlan || !selectedCharity} onClick={() => setDialog("signup")} type="button">Join with {selectedCharity || "your chosen cause"} <ArrowUpRight size={16} /></button><p className="plan-note">No payment today. Early access opens soon.</p></div>
        </section>
      </main>

      <footer className="site-footer container"><button className="wordmark" onClick={() => scrollTo("top")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><span className="site-signature"><span>Built for the next good round.</span><strong>Gautam</strong></span><a href="mailto:hello@digitalheroes.co.in">hello@digitalheroes.co.in <ArrowUpRight size={14} /></a></footer>

      {dialog === "signup" ? <SignupModal charity={selectedCharity} onClose={() => setDialog(null)} plan={plan} planName={selectedPlan?.name} /> : null}
      {dialog === "draw" ? <Modal eyebrow="The monthly draw" onClose={() => setDialog(null)} title="A prize pool with a pulse."><div className="draw-modal-list"><p><span>01</span><strong>Every active plan adds to the pool.</strong></p><p><span>02</span><strong>Scores stay in a five-number rolling window.</strong></p><p><span>03</span><strong>Winners verify, payouts move, and jackpots roll.</strong></p></div><button className="button button-primary full-width" onClick={() => setDialog("signup")} type="button">Join the first draw <ArrowUpRight size={16} /></button></Modal> : null}
    </div>
  )
}

function App() {
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/$/, ""))

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname.replace(/\/$/, ""))
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  if (path === "/objectives-roles") return <RolesObjectivesPage />
  if (path === "/subscription-scores") return <SubscriptionScoresPage />
  if (path === "/past-draws") return <PastDrawsPage />
  if (path === "/help-center") return <HelpCenterPage />
  if (path === "/subscriber-dashboard") return <SubscriberDashboardPage />
  if (path === "/winner-verification") return <WinnerVerificationPage />
  if (path === "/admin-dashboard") return <AdminDashboardPage />
  return <LandingPage />
}

export default App
