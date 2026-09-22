import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Sparkles } from "@react-three/drei"
import { ArrowRight, ChevronRight, CircleDollarSign, Globe2, Menu, Pause, Play, ShieldCheck, Sparkles as SparkleIcon, X } from "lucide-react"
import { apiFetch } from "./apiBase"
import "./orbit-delivery-page.css"

const emptySnapshot = { activeMembers: 0, charityTotal: 0, prizePoolMinor: 0, nextDraw: "—", featuredCharity: null, charities: [], plans: [] }

function WalkingCourier({ paused }) {
  const courier = useRef(null)
  const leftArm = useRef(null)
  const rightArm = useRef(null)
  const leftLeg = useRef(null)
  const rightLeg = useRef(null)

  useFrame((state) => {
    if (paused) return
    const walk = state.clock.elapsedTime * 7
    const stride = Math.sin(walk)
    const bob = Math.abs(Math.cos(walk))
    if (courier.current) {
      courier.current.position.y = .43 + bob * .025
      courier.current.rotation.z = stride * .035
    }
    if (leftArm.current) leftArm.current.rotation.z = -.28 + stride * .48
    if (rightArm.current) rightArm.current.rotation.z = .28 - stride * .48
    if (leftLeg.current) leftLeg.current.rotation.z = stride * .55
    if (rightLeg.current) rightLeg.current.rotation.z = -stride * .55
  })

  return <group ref={courier} position={[1.43, .43, .08]} rotation={[0, -.45, .08]}>
    <mesh position={[0, -.12, 0]}><capsuleGeometry args={[.17, .38, 8, 16]} /><meshStandardMaterial color="#f36d4e" roughness={.52} /></mesh>
    <mesh position={[0, .27, 0]}><sphereGeometry args={[.16, 20, 20]} /><meshStandardMaterial color="#ffc9a6" roughness={.72} /></mesh>
    <mesh position={[0, .4, 0]} rotation={[0, 0, -.12]}><boxGeometry args={[.26, .07, .22]} /><meshStandardMaterial color="#385bd1" roughness={.45} /></mesh>
    <mesh position={[.12, -.22, -.16]} rotation={[0, 0, -.25]}><boxGeometry args={[.25, .18, .28]} /><meshStandardMaterial color="#f9a340" roughness={.7} /></mesh>
    <group ref={leftArm} position={[-.18, .02, .02]} rotation={[0, 0, -.28]}><mesh position={[0, -.13, 0]}><capsuleGeometry args={[.045, .22, 6, 10]} /><meshStandardMaterial color="#f36d4e" /></mesh><mesh position={[0, -.27, 0]}><sphereGeometry args={[.055, 12, 12]} /><meshStandardMaterial color="#ffc9a6" /></mesh></group>
    <group ref={rightArm} position={[.18, .02, .02]} rotation={[0, 0, .28]}><mesh position={[0, -.13, 0]}><capsuleGeometry args={[.045, .22, 6, 10]} /><meshStandardMaterial color="#f36d4e" /></mesh><mesh position={[0, -.27, 0]}><sphereGeometry args={[.055, 12, 12]} /><meshStandardMaterial color="#ffc9a6" /></mesh></group>
    <group ref={leftLeg} position={[-.08, -.32, 0]}><mesh position={[0, -.13, 0]}><capsuleGeometry args={[.05, .23, 6, 10]} /><meshStandardMaterial color="#173d86" /></mesh><mesh position={[0, -.28, .04]} rotation={[0, 0, .12]}><boxGeometry args={[.11, .07, .2]} /><meshStandardMaterial color="#f7a64a" /></mesh></group>
    <group ref={rightLeg} position={[.08, -.32, 0]}><mesh position={[0, -.13, 0]}><capsuleGeometry args={[.05, .23, 6, 10]} /><meshStandardMaterial color="#173d86" /></mesh><mesh position={[0, -.28, .04]} rotation={[0, 0, -.12]}><boxGeometry args={[.11, .07, .2]} /><meshStandardMaterial color="#f7a64a" /></mesh></group>
  </group>
}

function DeliveryPlanet({ paused }) {
  const planet = useRef(null)
  useFrame((state, delta) => {
    if (!planet.current || paused) return
    planet.current.rotation.y += delta * .16
  })
  const land = [[-.7, .55, 1.26, .5, .25, .12], [.55, .7, 1.25, .42, .22, .12], [-.75, -.45, 1.24, .35, .2, .16], [.5, -.48, 1.2, .48, .18, .14], [.05, .05, 1.4, .23, .1, .1]]
  const routeLights = [[-.96, .2, 1.12], [-.35, .98, 1.08], [.7, .38, 1.22], [.2, -.96, 1.12]]
  return <group ref={planet}>
    <mesh><sphereGeometry args={[1.48, 64, 64]} /><meshPhysicalMaterial color="#8db9ee" emissive="#173d86" emissiveIntensity={.18} metalness={.05} roughness={.7} /></mesh>
    <mesh scale={1.035}><sphereGeometry args={[1.48, 32, 32]} /><meshBasicMaterial color="#d8eaff" transparent opacity={.16} wireframe /></mesh>
    <mesh scale={1.075}><sphereGeometry args={[1.48, 32, 32]} /><meshBasicMaterial color="#a8c8ff" transparent opacity={.09} wireframe /></mesh>
    {land.map((shape, index) => <mesh key={index} position={shape.slice(0, 3)} scale={shape.slice(3)}><sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color={index % 2 ? "#7a9cf0" : "#5b7fde"} roughness={.8} /></mesh>)}
    {routeLights.map((position, index) => <mesh key={index} position={position}><sphereGeometry args={[.035, 12, 12]} /><meshBasicMaterial color={index === 2 ? "#f7a64a" : "#d7f99a"} /></mesh>)}
    <mesh rotation={[Math.PI / 2.1, .2, .2]} scale={1.3}><torusGeometry args={[1.3, .012, 8, 128]} /><meshBasicMaterial color="#5178ed" transparent opacity={.55} /></mesh>
    <mesh rotation={[.8, Math.PI / 2.7, 0]} scale={1.48}><torusGeometry args={[1.3, .009, 8, 128]} /><meshBasicMaterial color="#a8c8ff" transparent opacity={.55} /></mesh>
    <WalkingCourier paused={paused} />
  </group>
}

function OrbitStage({ paused, onToggle }) {
  return <div className="orbit-stage"><Canvas camera={{ position: [0, .1, 5.2], fov: 34 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}><ambientLight intensity={1.5} /><directionalLight color="#ffffff" intensity={4} position={[3, 4, 5]} /><pointLight color="#6285ff" intensity={7} distance={8} position={[-3, -2, 3]} /><Sparkles count={130} scale={[7, 5, 3]} size={1.4} speed={.18} color="#86aaff" opacity={.35} /><DeliveryPlanet paused={paused} /><OrbitControls enablePan={false} enableZoom={false} enableDamping dampingFactor={.08} rotateSpeed={.7} /></Canvas><div className="orbit-stage-grid" /><div className="orbit-stage-topline"><span><span className="orbit-live-dot" /> Live delivery map</span><span>02 / 04</span></div><button className="orbit-pause" onClick={onToggle} type="button">{paused ? <Play size={14} /> : <Pause size={14} />} {paused ? "Resume orbit" : "Pause to wave"}</button><span className="orbit-stage-label">drag in any direction<br />to rotate the world</span></div>
}

function money(minor) {
  return `INR ${Math.round(Number(minor || 0) / 100).toLocaleString("en-IN")}`
}

export default function OrbitDeliveryLandingPage() {
  const [snapshot, setSnapshot] = useState(emptySnapshot)
  const [status, setStatus] = useState("loading")
  const [paused, setPaused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    const load = () => apiFetch("/api/impact").then((response) => { if (!response.ok) throw new Error("Live data unavailable") ; return response.json() }).then((data) => { if (!active) return; setSnapshot(data); setStatus("ready") }).catch(() => { if (active) setStatus("error") })
    load()
    const interval = window.setInterval(load, 10000)
    return () => { active = false; window.clearInterval(interval) }
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.code === "Space") { event.preventDefault(); setPaused((value) => !value) }
      if (event.key.toLowerCase() === "m") setMenuOpen((value) => !value)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const poolMinor = snapshot.pool?.amountMinor ?? snapshot.prizePoolMinor
  const featured = snapshot.featuredCharity?.name || snapshot.charities[0]?.name || "your chosen cause"
  const poolLabel = status === "ready" ? money(poolMinor) : "INR —"
  const navigate = (path) => window.location.assign(path)

  return <div className="orbit-page"><header className="orbit-header"><button className="orbit-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button"><span className="orbit-brand-mark"><i /><i /><i /></span><span>digital <b>heroes</b></span></button><nav className={`orbit-nav ${menuOpen ? "is-open" : ""}`}><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#impact" onClick={() => setMenuOpen(false)}>Live impact</a><a href="/help-center">Help center</a><button className="orbit-nav-link" onClick={() => navigate("/subscriber-dashboard")} type="button">Sign in</button><button className="orbit-pill" onClick={() => navigate("/subscription-scores")} type="button">Start your journey <ArrowRight size={15} /></button></nav><button aria-label={menuOpen ? "Close menu" : "Open menu"} className="orbit-menu" onClick={() => setMenuOpen((value) => !value)} type="button">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button></header><main><section className="orbit-hero"><div className="orbit-hero-copy"><p className="orbit-kicker"><span /> Good things, on their way</p><h1>Good scores.<br />Delivered<br /><em>with care.</em></h1><p className="orbit-lede">Turn your next round into a chance to win, give back, and see exactly where the good lands.</p><div className="orbit-actions"><button className="orbit-pill orbit-pill-large" onClick={() => navigate("/subscription-scores")} type="button">Meet your courier <ArrowRight size={17} /></button><button className="orbit-text-button" onClick={() => setPaused((value) => !value)} type="button">{paused ? <Play size={15} /> : <Pause size={15} />} {paused ? "Resume the orbit" : "Pause to wave"}</button></div><div className="orbit-trust"><ShieldCheck size={16} /><span>Transparent by design</span><span className="orbit-trust-dot" /><span>10% minimum to charity</span></div></div><OrbitStage onToggle={() => setPaused((value) => !value)} paused={paused} /></section><section className="orbit-delivery-bar"><div className="orbit-container orbit-delivery-inner"><div><span className="orbit-bar-label">Your delivery status</span><strong><span className="orbit-live-dot" /> {status === "ready" ? "Moving through the live model" : "Connecting to the live model"}</strong></div><div><span className="orbit-bar-label">Next drop</span><strong>{snapshot.nextDraw}</strong></div><div><span className="orbit-bar-label">World in motion</span><strong>{snapshot.activeMembers.toLocaleString()} members</strong></div><div><span className="orbit-bar-label">Impact delivered</span><strong>{snapshot.charityTotal.toLocaleString()} points</strong></div></div></section><section className="orbit-section orbit-container" id="how-it-works"><div className="orbit-section-heading"><div><p className="orbit-kicker"><span /> Simple by design</p><h2>Good things.<br /><em>Delivered in three steps.</em></h2></div><p>From your score to a monthly moment and a cause you can see. No jargon, no smoke and mirrors.</p></div><div className="orbit-step-grid"><article><span>01</span><Globe2 size={25} /><h3>Choose a destination</h3><p>Pick the cause that matters to you. Change it as your story changes.</p><a href="#impact">Explore causes <ChevronRight size={15} /></a></article><article><span>02</span><CircleDollarSign size={25} /><h3>Send your score</h3><p>Keep your latest five Stableford scores live and enter the monthly draw.</p><button onClick={() => navigate("/subscription-scores")} type="button">Manage scores <ChevronRight size={15} /></button></article><article><span>03</span><SparkleIcon size={25} /><h3>Watch the good land</h3><p>See the pool, the split, and the impact update in real time.</p><a href="#impact">Track the delivery <ChevronRight size={15} /></a></article></div></section><section className="orbit-impact orbit-container" id="impact"><div className="orbit-impact-copy"><p className="orbit-kicker orbit-kicker-light"><span /> Live delivery ledger</p><h2>The full journey,<br /><em>in plain sight.</em></h2><p>The live pool updates as the community moves. At least 10% of every active plan goes to the cause its member chose.</p><button className="orbit-light-button" onClick={() => navigate("/past-draws")} type="button">Open the public ledger <ArrowRight size={16} /></button></div><div className="orbit-impact-card"><div className="orbit-impact-card-top"><span>Current pool / INR</span><span>{status === "ready" ? "live" : "syncing"}</span></div><strong>{poolLabel}</strong><div className="orbit-pool-meter"><span style={{ width: "40%" }} /><span style={{ width: "35%" }} /><span style={{ width: "25%" }} /></div><div className="orbit-pool-legend"><span><i /> 5-number jackpot <b>40%</b></span><span><i /> 4-number tier <b>35%</b></span><span><i /> 3-number tier <b>25%</b></span></div><div className="orbit-impact-foot"><span>Featured cause</span><b>{featured}</b><span>{snapshot.pool?.updatedAt ? `Updated ${new Date(snapshot.pool.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Awaiting first sync"}</span></div></div></section><section className="orbit-section orbit-causes orbit-container"><div className="orbit-section-heading"><div><p className="orbit-kicker"><span /> Choose your cause</p><h2>Good looks<br /><em>different to everyone.</em></h2></div><p>Pick the cause that feels like yours. The live delivery route follows it.</p></div><div className="orbit-cause-grid">{snapshot.charities.slice(0, 3).map((charity, index) => <article key={charity.id}><span>0{index + 1} / {charity.category}</span><h3>{charity.name}</h3><p>{charity.note}</p><button onClick={() => navigate("/subscription-scores")} type="button">Deliver here <ArrowRight size={15} /></button></article>)}</div></section></main><footer className="orbit-footer orbit-container"><button className="orbit-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button"><span className="orbit-brand-mark"><i /><i /><i /></span><span>digital <b>heroes</b></span></button><span>Built for the next good round.</span><a href="/admin-dashboard">Operations <ArrowRight size={14} /></a></footer></div>
}

