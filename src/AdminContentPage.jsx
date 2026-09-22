import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Sparkles as SparkleField } from "@react-three/drei"
import { ArrowLeft, ArrowUpRight, Check, FileText, LogOut, Plus, Radio, Save, Send, ShieldCheck } from "lucide-react"
import { apiFetch } from "./apiBase"
import "./admin-content-page.css"

const emptyForm = { slug: "", category: "Membership", title: "", excerpt: "", body: "", tags: "" }

async function api(path, options = {}) {
  const response = await apiFetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "The content studio could not complete that action.")
  return data
}

function ContentOrbit({ articles }) {
  const group = useRef(null)
  const published = articles.filter((article) => article.active).length
  const draft = articles.length - published
  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 0.12
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.32) * 0.08
  })
  const nodes = [
    { position: [-1.45, 0.8, 0.2], color: "#d7fa6b", value: published },
    { position: [1.4, 0.4, 0.25], color: "#ff715b", value: draft },
    { position: [0, -1.25, 0.35], color: "#74d5d8", value: articles.length },
  ]
  return <group ref={group}><SparkleField count={80} scale={[7, 5, 3]} size={1.4} speed={0.2} color="#d7fa6b" opacity={0.35} /><mesh><icosahedronGeometry args={[1.08, 2]} /><meshPhysicalMaterial color="#d7fa6b" emissive="#40591e" emissiveIntensity={0.8} metalness={0.25} roughness={0.3} /></mesh><mesh rotation={[Math.PI / 2.1, .2, 0]} scale={1.42}><torusGeometry args={[1.05, .014, 10, 96]} /><meshBasicMaterial color="#74d5d8" transparent opacity={.5} /></mesh><mesh rotation={[.4, Math.PI / 2.8, 0]} scale={1.68}><torusGeometry args={[1.05, .01, 10, 96]} /><meshBasicMaterial color="#ff715b" transparent opacity={.35} /></mesh>{nodes.map((node, index) => <mesh key={index} position={node.position}><sphereGeometry args={[.15, 24, 24]} /><meshBasicMaterial color={node.color} /></mesh>)}</group>
}

function AdminLogin({ onLogin }) {
  const [message, setMessage] = useState("")
  async function submit(event) {
    event.preventDefault(); setMessage("")
    const form = new FormData(event.currentTarget)
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) })
      if (data.member.role !== "admin") throw new Error("Administrator access is required for the content studio.")
      onLogin(data.member)
    } catch (error) { setMessage(error.message) }
  }
  return <main className="content-login"><div className="content-login-card"><div className="content-brand"><span /> digital <strong>heroes</strong></div><p className="eyebrow"><span className="eyebrow-line" /> Content studio / 007</p><h1>Publish the<br /><em>next signal.</em></h1><p>Administrator access is required to edit the live knowledge base and publish updates.</p><form onSubmit={submit}><label>Email<input name="email" required type="email" placeholder="admin@example.com" /></label><label>Password<input name="password" required type="password" placeholder="Your password" /></label>{message ? <p className="content-error" role="alert">{message}</p> : null}<button className="button button-primary full-width" type="submit">Open content studio <ArrowUpRight size={16} /></button></form><button className="text-button" onClick={() => window.location.assign("/admin-dashboard")} type="button"><ArrowLeft size={15} /> Back to control room</button></div></main>
}

export default function AdminContentPage() {
  const [session, setSession] = useState(null)
  const [articles, setArticles] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    const data = await api("/api/admin/content")
    setArticles(data.articles)
    if (selectedId) {
      const selected = data.articles.find((article) => article.id === selectedId)
      if (selected) setForm({ ...selected, tags: selected.tags.join(", ") })
    }
  }

  useEffect(() => { api("/api/auth/session").then((data) => { if (data.member.role !== "admin") throw new Error("Administrator access is required."); setSession(data.member); return load() }).catch((loadError) => setError(loadError.message)) }, [])

  const counts = useMemo(() => ({ published: articles.filter((article) => article.active).length, drafts: articles.filter((article) => !article.active).length }), [articles])
  function choose(article) { setSelectedId(article.id); setForm({ ...article, tags: article.tags.join(", ") }); setNotice(""); setError("") }
  function newArticle() { setSelectedId(null); setForm(emptyForm); setNotice(""); setError("") }
  function setField(field, value) { setForm((current) => ({ ...current, [field]: value })) }
  async function save(event) {
    event.preventDefault(); setSaving(true); setNotice(""); setError("")
    try {
      const payload = { ...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), active: selectedId ? articles.find((article) => article.id === selectedId)?.active : true }
      const data = await api(selectedId ? `/api/admin/content/${selectedId}` : "/api/admin/content", { method: selectedId ? "PATCH" : "POST", body: JSON.stringify(payload) })
      setSelectedId(data.article.id); setNotice("Content saved to the live ledger."); await load()
    } catch (saveError) { setError(saveError.message) } finally { setSaving(false) }
  }
  async function publish() {
    if (!selectedId) return
    setSaving(true); setNotice(""); setError("")
    try { await api(`/api/admin/content/${selectedId}/${articles.find((article) => article.id === selectedId)?.active ? "unpublish" : "publish"}`, { method: "POST" }); setNotice("Publication state updated."); await load() } catch (publishError) { setError(publishError.message) } finally { setSaving(false) }
  }
  async function logout() { await api("/api/auth/logout", { method: "POST" }); setSession(null) }
  if (!session) return <AdminLogin onLogin={(member) => { setError(""); setSession(member); load().catch((loadError) => setError(loadError.message)) }} />
  const selected = selectedId ? articles.find((article) => article.id === selectedId) : null
  return <div className="content-studio"><header className="content-header"><div className="content-announcement"><span className="live-dot" /> Editorial control / {session.email}</div><nav className="content-nav container"><button className="wordmark" onClick={() => window.location.assign("/admin-dashboard")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><div className="content-nav-actions"><span><ShieldCheck size={14} /> admin role verified</span><button className="nav-cta" onClick={logout} type="button"><LogOut size={14} /> Sign out</button></div></nav></header><main className="content-main container"><section className="content-hero"><div><p className="eyebrow"><span className="eyebrow-line" /> Dynamic publishing layer / 007</p><h1>Keep the signal<br /><em>alive.</em></h1><p>Shape the public knowledge base, publish clean updates, and keep every answer connected to the moving platform.</p><div className="content-stats"><span><b>{counts.published}</b> live updates</span><span><b>{counts.drafts}</b> drafts in orbit</span></div></div><div className="content-orbit"><Canvas camera={{ position: [0, 0, 5.8], fov: 36 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}><ambientLight intensity={.8} /><pointLight color="#d7fa6b" intensity={10} distance={8} position={[3, 3, 3]} /><pointLight color="#ff715b" intensity={6} distance={8} position={[-3, -2, 2]} /><ContentOrbit articles={articles} /><OrbitControls enablePan={false} enableZoom={false} /></Canvas><div className="content-orbit-label"><Radio size={14} /> live editorial state</div></div></section>{notice ? <div className="content-notice"><Check size={16} /> {notice}</div> : null}{error ? <p className="content-error" role="alert">{error}</p> : null}<section className="content-workspace"><aside className="content-library"><div className="content-library-head"><div><p className="eyebrow"><span className="eyebrow-line" /> Knowledge base</p><h2>Content<br /><em>ledger.</em></h2></div><button aria-label="Create new content" className="icon-button" onClick={newArticle} type="button"><Plus size={18} /></button></div><div className="content-list">{articles.map((article) => <button className={`content-list-item ${selectedId === article.id ? "selected" : ""}`} key={article.id} onClick={() => choose(article)} type="button"><span className={`content-state ${article.active ? "live" : "draft"}`} /><span><strong>{article.title}</strong><small>{article.category} / {article.active ? "published" : "draft"}</small></span><ArrowUpRight size={14} /></button>)}</div></aside><form className="content-editor" onSubmit={save}><div className="content-editor-head"><div><span className="content-kicker">{selected ? `Editing / ${selected.slug}` : "New update / draft"}</span><h2>{selected ? "Refine the story." : "Write the next update."}</h2></div>{selected ? <button className="content-publish" disabled={saving} onClick={(event) => { event.preventDefault(); publish() }} type="button">{selected.active ? "Unpublish" : "Publish"} <Send size={14} /></button> : null}</div><div className="content-fields"><label>Slug<input required value={form.slug} onChange={(event) => setField("slug", event.target.value)} placeholder="new-update" /></label><label>Category<input required value={form.category} onChange={(event) => setField("category", event.target.value)} placeholder="Membership" /></label><label className="wide">Title<input required value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="A clear headline" /></label><label className="wide">Excerpt<textarea required rows="2" value={form.excerpt} onChange={(event) => setField("excerpt", event.target.value)} placeholder="A short public summary" /></label><label className="wide">Body<textarea required rows="9" value={form.body} onChange={(event) => setField("body", event.target.value)} placeholder="Write the published answer or update..." /></label><label className="wide">Tags<input value={form.tags} onChange={(event) => setField("tags", event.target.value)} placeholder="scores, membership, impact" /></label></div><button className="button button-primary content-save" disabled={saving} type="submit">{saving ? "Writing ledger..." : "Save content"} <Save size={15} /></button></form></section></main></div>
}
