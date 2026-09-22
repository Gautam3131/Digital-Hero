import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html, OrbitControls, Sparkles as SparkleField } from "@react-three/drei"
import { ArrowLeft, ArrowUpRight, Bot, ChevronRight, CircleHelp, Headphones, MessageCircle, Search, Send, Sparkles, X } from "lucide-react"
import "./help-center-page.css"
import { apiFetch } from "./apiBase"

async function readJson(path, options = {}) {
  const response = await apiFetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "The Help Center could not complete that request.")
  return data
}

function SupportConstellation({ categories, activeCategory, onCategorySelect }) {
  const group = useRef(null)
  const { pointer } = useThree()
  const nodes = categories.slice(0, 5).map((category, index) => { const angle = (index / Math.max(categories.length, 1)) * Math.PI * 2 - Math.PI / 2; return { category, position: [Math.cos(angle) * 1.75, Math.sin(angle) * 1.18, .2], color: ["#d7fa6b", "#74d5d8", "#ff715b"][index % 3] } })
  useFrame((state, delta) => { if (!group.current) return; group.current.rotation.y += delta * .035; group.current.rotation.x = Math.sin(state.clock.elapsedTime * .18) * .06; group.current.position.x += (pointer.x * .12 - group.current.position.x) * .04; group.current.position.y += (pointer.y * .08 - group.current.position.y) * .04 })
  return <group ref={group}><SparkleField count={70} scale={[8, 6, 4]} size={1.5} speed={.15} color="#d7fa6b" opacity={.32} /><mesh><icosahedronGeometry args={[1.05, 2]} /><meshPhysicalMaterial color="#d7fa6b" emissive="#405a1b" emissiveIntensity={.9} metalness={.28} roughness={.28} transparent opacity={.9} /></mesh><mesh rotation={[Math.PI / 2, .3, 0]} scale={1.55}><torusGeometry args={[1.04, .014, 10, 96]} /><meshBasicMaterial color="#74d5d8" transparent opacity={.4} /></mesh><mesh rotation={[.5, Math.PI / 2.8, 0]} scale={1.75}><torusGeometry args={[1.04, .01, 10, 96]} /><meshBasicMaterial color="#ff715b" transparent opacity={.32} /></mesh>{nodes.map((node) => <group key={node.category} position={node.position}><mesh scale={activeCategory === node.category ? 1.5 : 1} onClick={(event) => { event.stopPropagation(); onCategorySelect(node.category) }} onPointerOver={() => { document.body.style.cursor = "pointer" }} onPointerOut={() => { document.body.style.cursor = "default" }}><sphereGeometry args={[.15, 24, 24]} /><meshBasicMaterial color={node.color} /></mesh><Html distanceFactor={2.5} position={[0, -.32, 0]}><span className="support-node-label">{node.category}</span></Html></group>)}</group>
}

function SupportCanvas({ categories, activeCategory, onCategorySelect }) {
  return <Canvas camera={{ position: [0, 0, 6], fov: 34 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} onCreated={({ gl }) => gl.setClearColor("#000000", 0)}><ambientLight intensity={.75} /><pointLight color="#d7fa6b" intensity={10} distance={9} position={[3, 3, 3]} /><pointLight color="#74d5d8" intensity={6} distance={8} position={[-3, -2, 2]} /><SupportConstellation activeCategory={activeCategory} categories={categories} onCategorySelect={onCategorySelect} /><OrbitControls enablePan={false} enableZoom={false} maxPolarAngle={Math.PI * .68} minPolarAngle={Math.PI * .32} rotateSpeed={.65} /></Canvas>
}

function ArticleCard({ article, selected, onSelect }) {
  return <button aria-pressed={selected} className={`support-article-card glass-button ${selected ? "support-article-selected" : ""}`} onClick={() => onSelect(article.slug)} type="button"><span className="support-article-category">{article.category}</span><strong>{article.title}</strong><span>{article.excerpt}</span><span className="support-article-link">Open article <ChevronRight size={15} /></span></button>
}

function ChatConsole({ articles }) {
  const starter = { role: "model", content: "I’m the Digital Heroes support signal. Ask about scores, membership, charity impact, or past draws." }
  const [messages, setMessages] = useState([starter])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState("")
  const suggestions = articles.filter((article) => article.popular).slice(0, 3)
  async function send(message = input) {
    const content = message.trim()
    if (!content || sending) return
    const nextMessages = [...messages, { role: "user", content }]
    setMessages(nextMessages); setInput(""); setSending(true); setNotice("")
    try { const data = await readJson("/api/help/chat", { method: "POST", body: JSON.stringify({ message: content, history: messages.slice(-8) }) }); setMessages([...nextMessages, { role: "model", content: data.reply, source: data.source }]) } catch (error) { setNotice(error.message) } finally { setSending(false) }
  }
  return <div className="support-chat-console"><div className="support-chat-heading"><div><span className="support-live-status"><span className="live-dot" /> AI support</span><strong>Ask the signal.</strong></div><button aria-label="Clear chat" className="glass-icon-button" disabled={sending || messages.length === 1} onClick={() => { setMessages([starter]); setNotice("") }} type="button"><Sparkles size={16} /></button></div><div className="support-chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`support-message support-message-${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "model" ? <Bot size={14} /> : <MessageCircle size={14} />}</span><p>{message.content}</p>{message.source ? <small>{message.source === "gemini" ? "Gemini-powered" : "Help Center knowledge base"}</small> : null}</div>)}{sending ? <div className="support-message support-message-model"><span><Bot size={14} /></span><p className="support-thinking">Thinking<span>.</span><span>.</span><span>.</span></p></div> : null}</div>{suggestions.length ? <div className="support-suggestions">{suggestions.map((article) => <button className="glass-button" disabled={sending} key={article.slug} onClick={() => send(article.title)} type="button">{article.title}</button>)}</div> : null}<form className="support-chat-form" onSubmit={(event) => { event.preventDefault(); send() }}><input aria-label="Ask AI support" onChange={(event) => setInput(event.target.value)} placeholder="Ask about your membership…" value={input} /><button aria-label="Send support question" className="glass-submit-button" disabled={!input.trim() || sending} type="submit"><Send size={17} /></button></form>{notice ? <p className="support-chat-error" role="alert">{notice}</p> : null}</div>
}

export default function HelpCenterPage() {
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("")
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [chatOpen, setChatOpen] = useState(true)
  async function loadArticles(queryValue = query, categoryValue = activeCategory) {
    setLoading(true)
    try { const data = await readJson(`/api/help/articles?query=${encodeURIComponent(queryValue)}&category=${encodeURIComponent(categoryValue)}`); setArticles(data.articles); setCategories(data.categories); setError(""); if (!selectedArticle && data.articles[0]) setSelectedArticle(data.articles[0]) } catch (loadError) { setError(loadError.message) } finally { setLoading(false) }
  }
  async function selectArticle(slug) {
    try { const data = await readJson(`/api/help/articles/${encodeURIComponent(slug)}`); setSelectedArticle(data.article); document.getElementById("support-article-detail")?.scrollIntoView({ behavior: "smooth", block: "center" }) } catch (loadError) { setError(loadError.message) }
  }
  useEffect(() => { const timer = window.setTimeout(() => loadArticles(), 220); return () => window.clearTimeout(timer) }, [query, activeCategory])
  useEffect(() => { const interval = window.setInterval(() => loadArticles(query, activeCategory), 20000); return () => window.clearInterval(interval) }, [query, activeCategory])
  function chooseCategory(category) { setActiveCategory((current) => current === category ? "" : category) }
  return <div className="help-page"><header className="help-header"><div className="help-announcement"><span className="live-dot" /> Support signal / live knowledge base <span><Headphones size={13} /> Gemini-ready</span></div><nav className="help-nav container"><button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><div className="help-nav-links"><button onClick={() => window.location.assign("/past-draws")} type="button">Past draws</button><button onClick={() => window.location.assign("/subscription-scores")} type="button">Plans & scores</button><button className="nav-cta glass-button" onClick={() => { setChatOpen(true); document.getElementById("support-chat")?.scrollIntoView({ behavior: "smooth" }) }} type="button"><MessageCircle size={15} /> Ask support</button></div></nav></header><main className="help-main container"><section className="help-hero"><div className="help-hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> The help center / 006</p><h1>Answers with<br /><em>a little lift.</em></h1><p>Find a clear path through membership, scores, draws, and impact. Search the live knowledge base or ask the AI support signal when you want a faster answer.</p><div className="help-hero-actions"><button className="glass-button glass-button-primary" onClick={() => document.getElementById("support-search")?.focus()} type="button"><Search size={16} /> Search the center</button><button className="glass-button" onClick={() => { setChatOpen(true); document.getElementById("support-chat")?.scrollIntoView({ behavior: "smooth" }) }} type="button"><Sparkles size={16} /> Ask Gemini support</button></div></div><div className="help-hero-world"><SupportCanvas activeCategory={activeCategory} categories={categories} onCategorySelect={chooseCategory} /><span className="help-canvas-hint">drag to orbit / click a category</span></div></section><section className="help-search-zone" id="support-search-zone"><div className="help-search-bar"><Search size={18} /><input id="support-search" aria-label="Search the Help Center" onChange={(event) => setQuery(event.target.value)} placeholder="Search scores, membership, impact…" value={query} />{query ? <button aria-label="Clear search" className="glass-icon-button" onClick={() => setQuery("")} type="button"><X size={16} /></button> : null}</div><div className="help-category-row"><button className={`glass-button ${!activeCategory ? "glass-button-active" : ""}`} onClick={() => setActiveCategory("")} type="button">All topics</button>{categories.map((category) => <button className={`glass-button ${activeCategory === category ? "glass-button-active" : ""}`} key={category} onClick={() => chooseCategory(category)} type="button">{category}</button>)}</div></section><section className="help-workspace"><div className="help-articles-column"><div className="help-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Live articles</p><h2>Find your<br /><em>next move.</em></h2></div><span>{loading ? "Updating…" : `${articles.length} article${articles.length === 1 ? "" : "s"}`}</span></div>{error ? <div className="help-error" role="alert">{error}<button className="glass-button" onClick={() => loadArticles()} type="button">Retry</button></div> : null}<div className="help-article-grid">{articles.length ? articles.map((article) => <ArticleCard article={article} key={article.slug} onSelect={selectArticle} selected={selectedArticle?.slug === article.slug} />) : <div className="help-empty"><CircleHelp size={23} /><strong>{loading ? "Reading the knowledge base…" : "No articles match that search."}</strong><span>Try another phrase or choose a topic.</span></div>}</div>{selectedArticle ? <article className="help-article-detail" id="support-article-detail"><span className="support-article-category">{selectedArticle.category}</span><h3>{selectedArticle.title}</h3><p>{selectedArticle.body}</p><div className="help-tag-row">{selectedArticle.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></article> : null}</div><aside className={`help-chat-column ${chatOpen ? "help-chat-open" : ""}`} id="support-chat">{chatOpen ? <><button aria-label="Close support console" className="help-chat-close glass-icon-button" onClick={() => setChatOpen(false)} type="button"><X size={16} /></button><ChatConsole articles={articles} /></> : <button className="help-chat-trigger glass-button glass-button-primary" onClick={() => setChatOpen(true)} type="button"><MessageCircle size={18} /> Open AI support</button>}</aside></section></main><footer className="help-footer container"><span>digital heroes / help center</span><button className="glass-button" onClick={() => window.location.assign("/")} type="button"><ArrowLeft size={14} /> Return to the signal</button><span>Support articles refresh from the database.</span></footer></div>
}
