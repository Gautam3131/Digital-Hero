import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html, OrbitControls, Sparkles as SparkleField } from "@react-three/drei"
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  HeartHandshake,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react"
import { apiFetch } from "./apiBase"
import "./roles-page.css"

const fallbackSnapshot = {
  activeMembers: 1842,
  charityTotal: 48260,
  nextDraw: "18 days",
  featuredCharity: { name: "The Good Grief Trust", category: "Mental health" },
}

const objectives = [
  { key: "subscription", index: "01", label: "Engine", title: "Subscription", body: "Build a robust plan and payment system that keeps access clear from first click to renewal.", icon: CircleDollarSign, color: "lime" },
  { key: "scores", index: "02", label: "Experience", title: "Score entry", body: "Make the latest Stableford score feel as simple and engaging as sending a signal into the draw.", icon: Trophy, color: "coral" },
  { key: "draw", index: "03", label: "Engine", title: "Custom draw", body: "Run a monthly reward engine with transparent logic, simulations, and a rollover when nobody claims the jackpot.", icon: Sparkles, color: "aqua" },
  { key: "charity", index: "04", label: "Integration", title: "Charity", body: "Make giving part of the core loop, with a minimum 10% contribution and a visible trail of impact.", icon: HeartHandshake, color: "lime" },
  { key: "admin", index: "05", label: "Control", title: "Admin", body: "Give the team a calm control room for users, draws, causes, winners, and reporting.", icon: ShieldCheck, color: "coral" },
  { key: "design", index: "06", label: "Design", title: "Outstanding UI/UX", body: "Create an emotion-led experience that leaves golf clichés behind and puts purpose in front.", icon: Layers3, color: "aqua" },
]

const roles = [
  {
    key: "visitor",
    index: "01",
    label: "Public visitor",
    color: "lime",
    description: "A clear first step into the mission. Explore the model, understand the draw, and choose a cause before committing.",
    routes: [
      { label: "Platform overview", detail: "See the impact loop in one glance." },
      { label: "Explore charities", detail: "Find a cause with a human story." },
      { label: "Draw mechanics", detail: "Understand the 3, 4, and 5-number match." },
      { label: "Start subscription", detail: "Reserve a place in the first draw.", action: "signup" },
    ],
  },
  {
    key: "subscriber",
    index: "02",
    label: "Registered subscriber",
    color: "coral",
    description: "A focused home for members: manage the plan, log the latest five scores, choose a cause, and follow winnings.",
    routes: [
      { label: "Member dashboard", detail: "See status, renewal, and participation." },
      { label: "Score entry", detail: "Keep the latest five Stableford scores current." },
      { label: "My charity", detail: "Change the cause and contribution percentage." },
      { label: "Draws & winnings", detail: "Track entries, prizes, and payment state." },
    ],
  },
  {
    key: "admin",
    index: "03",
    label: "Administrator",
    color: "aqua",
    description: "A transparent operations layer for the people who publish draws, manage causes, verify winners, and read the numbers.",
    routes: [
      { label: "User management", detail: "Review profiles and subscription states." },
      { label: "Draw control room", detail: "Simulate, configure, and publish monthly draws." },
      { label: "Charity management", detail: "Keep listings, content, and media current." },
      { label: "Winner verification", detail: "Review proof and mark payouts complete." },
      { label: "Reports & analytics", detail: "Monitor users, impact, pool, and draw stats." },
    ],
  },
]

function RoleScene({ activeRole, onRoleSelect }) {
  const group = useRef(null)
  const { pointer } = useThree()
  const positions = useMemo(() => [[-1.65, 0.8, 0.1], [0.95, 0.6, 0.4], [0, -1.3, 0.6]], [])

  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 0.055
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.06
    group.current.position.x += (pointer.x * 0.18 - group.current.position.x) * 0.04
    group.current.position.y += (pointer.y * 0.14 - group.current.position.y) * 0.04
  })

  return (
    <group ref={group}>
      <SparkleField count={64} scale={[8, 6, 4]} size={1.7} speed={0.16} color="#d7fa6b" opacity={0.38} />
      <mesh rotation={[0.2, 0.4, 0]}>
        <icosahedronGeometry args={[1.25, 2]} />
        <meshPhysicalMaterial color="#d7fa6b" emissive="#465e1f" emissiveIntensity={0.9} metalness={0.22} roughness={0.3} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[Math.PI / 2.2, 0.2, 0]} scale={1.45}>
        <torusGeometry args={[1.1, 0.014, 10, 96]} />
        <meshBasicMaterial color="#ff715b" transparent opacity={0.42} />
      </mesh>
      <mesh rotation={[0.5, Math.PI / 2.8, 0]} scale={1.7}>
        <torusGeometry args={[1.1, 0.01, 10, 96]} />
        <meshBasicMaterial color="#74d5d8" transparent opacity={0.3} />
      </mesh>
      {roles.map((role, index) => (
        <group key={role.key} position={positions[index]}>
          <mesh
            scale={activeRole === role.key ? 1.42 : 1}
            onClick={(event) => {
              event.stopPropagation()
              onRoleSelect(role.key)
            }}
            onPointerOver={() => { document.body.style.cursor = "pointer" }}
            onPointerOut={() => { document.body.style.cursor = "default" }}
          >
            <sphereGeometry args={[0.16, 24, 24]} />
            <meshBasicMaterial color={role.color === "lime" ? "#d7fa6b" : role.color === "coral" ? "#ff715b" : "#74d5d8"} />
          </mesh>
          <Html distanceFactor={2.5} position={[0, -0.34, 0]}>
            <span className={`role-node-label role-node-${role.color}`}>{role.index} / {role.label}</span>
          </Html>
        </group>
      ))}
    </group>
  )
}

function RoleCanvas({ activeRole, onRoleSelect }) {
  return (
    <Canvas camera={{ position: [0, 0, 6.4], fov: 35 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => gl.setClearColor("#000000", 0)}>
      <ambientLight intensity={0.75} />
      <pointLight color="#d7fa6b" intensity={10} distance={9} position={[3, 3, 3]} />
      <pointLight color="#ff715b" intensity={6} distance={8} position={[-3, -2, 2]} />
      <RoleScene activeRole={activeRole} onRoleSelect={onRoleSelect} />
      <OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI * 0.68} minPolarAngle={Math.PI * 0.32} rotateSpeed={0.65} />
    </Canvas>
  )
}

function SignupPanel({ snapshot }) {
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")

  async function submit(event) {
    event.preventDefault()
    setStatus("loading")
    const form = new FormData(event.currentTarget)
    const payload = { name: form.get("name"), email: form.get("email"), plan: "monthly", charity: snapshot.featuredCharity.name }
    try {
      const response = await apiFetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
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
    return <div className="access-success"><span className="success-mark"><Check size={22} /></span><p className="eyebrow"><span className="eyebrow-line" /> Signal received</p><h3>{message}</h3><p>We will keep your place warm while the first draw takes shape.</p></div>
  }

  return (
    <form className="roles-signup-form" onSubmit={submit}>
      <label>Name<input autoComplete="name" name="name" placeholder="Your name" required /></label>
      <label>Email<input autoComplete="email" name="email" placeholder="you@example.com" required type="email" /></label>
      {status === "error" ? <p className="form-error" role="alert">{message}</p> : null}
      <button className="button button-primary full-width" disabled={status === "loading"} type="submit">{status === "loading" ? "Joining..." : "Reserve my place"}<ArrowUpRight size={16} /></button>
    </form>
  )
}

export default function RolesObjectivesPage() {
  const [snapshot, setSnapshot] = useState(fallbackSnapshot)
  const [activeObjective, setActiveObjective] = useState("subscription")
  const [activeRole, setActiveRole] = useState("visitor")
  const [activeSurface, setActiveSurface] = useState(roles[0].routes[0].label)
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    apiFetch("/api/impact").then((response) => response.json()).then(setSnapshot).catch(() => setSnapshot(fallbackSnapshot))
  }, [])

  const role = roles.find((item) => item.key === activeRole) || roles[0]
  const objective = objectives.find((item) => item.key === activeObjective) || objectives[0]
  const ObjectiveIcon = objective.icon

  function selectRole(key) {
    const next = roles.find((item) => item.key === key) || roles[0]
    setActiveRole(next.key)
    setActiveSurface(next.routes[0].label)
  }

  function scrollTo(id) {
    setMobileMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="roles-page">
      <header className="roles-header">
        <div className="announcement"><span className="live-dot" /> Digital Heroes / system map <ArrowUpRight size={13} /></div>
        <nav className="roles-nav container" aria-label="Page navigation">
          <button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button>
          <div className={`roles-nav-links ${mobileMenu ? "roles-nav-links-open" : ""}`}>
            <button onClick={() => scrollTo("objectives")} type="button">Core objectives</button>
            <button onClick={() => scrollTo("roles")} type="button">User roles</button>
            <button onClick={() => scrollTo("access")} type="button">Access the mission</button>
            <button onClick={() => window.location.assign("/subscription-scores")} type="button">Plans & scores</button>
            <button className="nav-cta" onClick={() => window.location.assign("/")} type="button"><ArrowLeft size={15} /> Main signal</button>
          </div>
          <button aria-label={mobileMenu ? "Close menu" : "Open menu"} className="icon-button roles-menu-button" onClick={() => setMobileMenu(!mobileMenu)} type="button">{mobileMenu ? "×" : "☰"}</button>
        </nav>
      </header>

      <main>
        <section className="roles-hero container">
          <div className="roles-hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> The operating brief / 002</p>
            <h1>One mission.<br /><em>Three ways in.</em></h1>
            <p className="roles-hero-lede">Digital Heroes is designed as one connected system: a simple public entry point, a focused member loop, and a transparent control layer behind it.</p>
            <div className="roles-hero-actions"><button className="button button-primary" onClick={() => scrollTo("roles")} type="button">Explore the roles <ChevronRight size={16} /></button><button className="text-button" onClick={() => scrollTo("objectives")} type="button">See the six objectives <ArrowUpRight size={15} /></button></div>
            <div className="roles-proof"><span><Users size={15} /> {snapshot.activeMembers.toLocaleString()} people in motion</span><i /><span><BarChart3 size={15} /> {snapshot.charityTotal.toLocaleString()} impact points</span></div>
          </div>
          <div className="roles-orbit-card" aria-label="Interactive user role map">
            <div className="roles-orbit-topline"><span>ROLE CONSTELLATION / 002</span><span className="signal-status"><span className="live-dot" /> Live map</span></div>
            <div className="roles-orbit-canvas"><RoleCanvas activeRole={activeRole} onRoleSelect={selectRole} /><span className="canvas-hint">drag to orbit / click a role</span></div>
            <div className="roles-orbit-caption"><div><p className="eyebrow">{role.index} / {role.label}</p><h2>{role.description}</h2></div><Sparkles className="signal-spark" size={21} /></div>
          </div>
        </section>

        <section className="roles-ticker" aria-label="Live system status"><div className="container roles-ticker-inner"><span>public by default</span><i /><strong>10% minimum to a chosen cause</strong><i /><span>next draw in {snapshot.nextDraw}</span><i /><span>transparent by design</span></div></section>

        <section className="roles-section container" id="objectives">
          <div className="roles-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Core objectives</p><h2>Six signals.<br /><em>One owned platform.</em></h2></div><p>Every surface earns its place by serving the same brief: make participation feel rewarding, giving feel visible, and operations feel calm.</p></div>
          <div className="objective-layout">
            <div className="objective-grid">{objectives.map((item) => { const Icon = item.icon; return <button aria-pressed={activeObjective === item.key} className={`objective-card objective-${item.color} ${activeObjective === item.key ? "objective-selected" : ""}`} key={item.key} onClick={() => setActiveObjective(item.key)} type="button"><span className="objective-index">{item.index}</span><Icon size={22} /><span className="objective-label">{item.label}</span><strong>{item.title}</strong><span>{item.body}</span><ChevronRight className="objective-arrow" size={17} /></button> })}</div>
            <aside className="objective-detail"><p className="eyebrow"><span className="eyebrow-line" /> Active objective</p><div className={`objective-detail-icon objective-${objective.color}`}><ObjectiveIcon size={24} /></div><span className="objective-detail-label">{objective.index} / {objective.label}</span><h3>{objective.title}</h3><p>{objective.body}</p><div className="objective-detail-line"><span /> intent locked</div></aside>
          </div>
        </section>

        <section className="role-section container" id="roles">
          <div className="roles-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> User roles</p><h2>Different access.<br /><em>Shared purpose.</em></h2></div><p>Role boundaries are clear by design. The navigation below is a clickable preview of the surfaces each person owns.</p></div>
          <div className="role-switcher" role="tablist" aria-label="Choose a user role">{roles.map((item) => <button aria-selected={activeRole === item.key} className={`role-tab role-tab-${item.color} ${activeRole === item.key ? "role-tab-active" : ""}`} key={item.key} onClick={() => selectRole(item.key)} role="tab" type="button"><span>{item.index}</span>{item.label}<ArrowUpRight size={15} /></button>)}</div>
          <div className="role-surface"><div className="role-surface-meta"><p className="eyebrow"><span className="eyebrow-line" /> {role.label} surface map</p><h3>{role.description}</h3><div className="surface-status"><span className={`surface-dot surface-dot-${role.color}`} /> Preview mode / {activeSurface}</div></div><div className="role-route-list">{role.routes.map((route, index) => <button aria-current={activeSurface === route.label ? "page" : undefined} className={`role-route ${activeSurface === route.label ? "role-route-active" : ""}`} key={route.label} onClick={() => { setActiveSurface(route.label); if (route.action === "signup") scrollTo("access") }} type="button"><span className="route-index">0{index + 1}</span><span><strong>{route.label}</strong><small>{route.detail}</small></span><ChevronRight size={17} /></button>)}</div></div>
        </section>

        <section className="access-section container" id="access"><div className="access-copy"><p className="eyebrow"><span className="eyebrow-line" /> Keep the signal moving</p><h2>Start with a place<br /><em>in the system.</em></h2><p>Join the early list and we will keep you close to the first draw. Your place starts with the featured cause: <strong>{snapshot.featuredCharity.name}</strong>.</p><button className="text-button" onClick={() => window.location.assign("/")} type="button">Back to the main signal <ArrowLeft size={15} /></button></div><div className="access-panel"><div className="access-panel-top"><span>EARLY ACCESS / 002</span><span><LockKeyhole size={14} /> No payment today</span></div><SignupPanel snapshot={snapshot} /></div></section>
      </main>

      <footer className="roles-footer container"><button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><span>Core objectives / user roles / page 02</span><a href="mailto:hello@digitalheroes.co.in">hello@digitalheroes.co.in <ArrowUpRight size={14} /></a></footer>
    </div>
  )
}
