import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Sparkles as SparkleField } from "@react-three/drei"
import { ArrowUpRight, BookOpen, LogOut, Radio, RefreshCcw, ShieldCheck } from "lucide-react"
import { apiFetch } from "./apiBase"
import "./member-content-page.css"
import AuthPanel from "./AuthPanel"

async function api(path, options = {}) {
  const response = await apiFetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "The member briefing could not be loaded.")
  return data
}

function MemberOrbit({ count }) {
  const group = useRef(null)
  useFrame((state, delta) => { if (!group.current) return; group.current.rotation.y += delta * .12; group.current.rotation.x = Math.sin(state.clock.elapsedTime * .25) * .07 })
  return <group ref={group}><SparkleField count={70} scale={[7, 5, 3]} size={1.5} speed={.18} color="#d7fa6b" opacity={.32} /><mesh><icosahedronGeometry args={[1.12, 2]} /><meshPhysicalMaterial color="#74d5d8" emissive="#173f43" emissiveIntensity={1} metalness={.3} roughness={.3} /></mesh><mesh rotation={[Math.PI / 2, .2, 0]} scale={1.5}><torusGeometry args={[1.04, .014, 10, 96]} /><meshBasicMaterial color="#d7fa6b" transparent opacity={.5} /></mesh><mesh rotation={[.4, Math.PI / 2.8, 0]} scale={1.75}><torusGeometry args={[1.04, .01, 10, 96]} /><meshBasicMaterial color="#ff715b" transparent opacity={.34} /></mesh>{Array.from({ length: Math.max(3, Math.min(count, 8)) }, (_, index) => { const angle = (index / Math.max(count, 1)) * Math.PI * 2; return <mesh key={index} position={[Math.cos(angle) * 1.55, Math.sin(angle) * .9, .25]}><sphereGeometry args={[.12, 20, 20]} /><meshBasicMaterial color={index % 2 ? "#d7fa6b" : "#ff715b"} /></mesh> })}</group>
}

function LoginPanel({ onLogin }) {
  return <AuthPanel backHref="/" description="Sign in to read updates reserved for the people already moving the platform forward." eyebrow="Registered member layer / 008" onSubmit={async ({ email, password }) => { const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); await onLogin(data.member) }} redirectPath="/member-content" submitLabel="Open member briefings" title="The briefings behind the signal" />
}

export default function MemberContentPage() {
  const [session, setSession] = useState(null)
  const [articles, setArticles] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  async function load(member = null) {
    const current = member || (await api("/api/auth/session")).member
    if (!["subscriber", "admin"].includes(current.role)) throw new Error("A registered member account is required.")
    const data = await api("/api/member/content")
    setSession(current); setArticles(data.articles); setSelected((currentArticle) => currentArticle && data.articles.some((article) => article.slug === currentArticle.slug) ? currentArticle : data.articles[0] || null); setLoading(false)
  }

  useEffect(() => { load().catch((loadError) => { setError(loadError.message); setLoading(false) }) }, [])
  useEffect(() => { if (!session) return undefined; const interval = window.setInterval(() => load().catch(() => {}), 20000); return () => window.clearInterval(interval) }, [session?.id])
  async function logout() { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); setSession(null); setArticles([]) }
  if (!session && loading) return <main className="member-content-loading"><Radio size={22} /><span>Reading the member signal...</span></main>
  if (!session) return <LoginPanel onLogin={(member) => load(member).catch((loadError) => { setError(loadError.message); setLoading(false) })} />
  return <div className="member-content-page"><header className="member-content-header"><div className="member-content-announcement"><span className="live-dot" /> Registered member layer / live briefings</div><nav className="member-content-nav container"><button className="wordmark" onClick={() => window.location.assign("/subscriber-dashboard")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><div className="member-content-actions"><span><ShieldCheck size={14} /> {session.email}</span><button className="nav-cta" onClick={logout} type="button"><LogOut size={14} /> Sign out</button></div></nav></header><main className="member-content-main container"><section className="member-content-hero"><div><p className="eyebrow"><span className="eyebrow-line" /> Private member signal / 008</p><h1>Good updates<br /><em>travel further.</em></h1><p>Read the briefings, product notes, and member-only context that sits behind the public knowledge base.</p><div className="member-content-meta"><span><b>{articles.length}</b> live briefings</span><span><b>20s</b> sync cycle</span></div></div><div className="member-content-orbit"><Canvas camera={{ position: [0, 0, 5.8], fov: 36 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}><ambientLight intensity={.8} /><pointLight color="#74d5d8" intensity={10} distance={8} position={[3, 3, 3]} /><pointLight color="#ff715b" intensity={6} distance={8} position={[-3, -2, 2]} /><MemberOrbit count={articles.length} /><OrbitControls enablePan={false} enableZoom={false} /></Canvas><span><Radio size={14} /> member channel / role verified</span></div></section>{error ? <p className="member-content-error" role="alert">{error}</p> : null}<section className="member-content-grid"><div className="member-content-list">{articles.length ? articles.map((article) => <button className={`member-article-card ${selected?.slug === article.slug ? "selected" : ""}`} key={article.slug} onClick={() => setSelected(article)} type="button"><span className="member-article-kicker">{article.category} / members only</span><strong>{article.title}</strong><p>{article.excerpt}</p><span>Read briefing <ArrowUpRight size={14} /></span></button>) : <div className="member-content-empty"><BookOpen size={23} /><strong>No member briefings yet.</strong><span>New updates will appear here as administrators publish them.</span></div>}</div><article className="member-article-detail">{selected ? <><span className="member-article-kicker">{selected.category} / registered members</span><h2>{selected.title}</h2><p>{selected.body}</p><div className="member-article-tags">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></> : <><BookOpen size={23} /><h2>Your private briefing channel.</h2><p>Select an update to read the full member context.</p></>}</article></section><button className="member-content-refresh" onClick={() => load().catch((loadError) => setError(loadError.message))} type="button"><RefreshCcw size={15} /> Refresh the member signal</button></main></div>
}
