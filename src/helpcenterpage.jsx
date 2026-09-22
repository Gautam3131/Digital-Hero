import { useEffect, useState } from "react"
import { ArrowUpRight, Bot, ChevronRight, CircleHelp, Headphones, MessageCircle, Search, Send, Sparkles, X } from "lucide-react"
import { apiFetch } from "./apiBase"
import "./help-center-page.css"

async function readJson(path, options = {}) {
  let response
  try {
    response = await apiFetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } })
  } catch (error) {
    if (error instanceof TypeError) throw new Error("Support is temporarily unreachable. Check the connection and try again.")
    throw error
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || "The Help Center could not complete that request.")
  return data
}

function HeroBanner({ geminiOnline, onSearch, onAsk }) {
  return <section className="help-banner" aria-labelledby="help-banner-title"><nav className="help-banner-nav"><button className="wordmark" onClick={() => window.location.assign("/")} type="button"><span className="wordmark-dot" /> digital <strong>heroes</strong></button><div className="help-banner-nav-links"><button onClick={() => window.location.assign("/past-draws")} type="button">Past draws</button><button onClick={() => window.location.assign("/subscription-scores")} type="button">Membership</button><button className="help-banner-nav-cta" onClick={onAsk} type="button"><MessageCircle size={15} /> Ask support</button></div></nav><div className="help-banner-content"><div className="help-banner-copy"><span className="help-banner-badge"><span className="live-dot" /> {geminiOnline ? "Live Gemini support" : "Live knowledge base"}</span><p className="eyebrow"><span className="eyebrow-line" /> The help center / 006</p><h1 id="help-banner-title">Clear answers.<br /><em>Real impact.</em></h1><p className="help-banner-description">Navigate membership, scores, draws, and charity impact with a support signal that keeps the useful part clear.</p><div className="help-banner-actions"><button className="help-banner-button help-banner-button-primary" onClick={onSearch} type="button"><Search size={16} /> Search the center <ArrowUpRight size={15} /></button><button className="help-banner-button" onClick={onAsk} type="button"><Sparkles size={16} /> Ask Gemini</button></div></div><div className="help-banner-orbit" aria-hidden="true"><div className="help-banner-orbit-core"><span>DH</span></div><div className="help-banner-orbit-ring help-banner-orbit-ring-one" /><div className="help-banner-orbit-ring help-banner-orbit-ring-two" /><span className="help-banner-orbit-label help-banner-orbit-label-one">MEMBERSHIP</span><span className="help-banner-orbit-label help-banner-orbit-label-two">IMPACT</span><span className="help-banner-orbit-label help-banner-orbit-label-three">SCORES</span></div></div><div className="help-banner-partners"><span>Trusted paths for every member</span><div><strong>digital heroes</strong><strong>stableford</strong><strong>community fund</strong><strong>open impact</strong></div></div></section>
}

function ArticleCard({ article, selected, onSelect }) {
  return <button aria-pressed={selected} className={`support-article-card ${selected ? "support-article-selected" : ""}`} onClick={() => onSelect(article.slug)} type="button"><span className="support-article-category">{article.category}</span><strong>{article.title}</strong><span>{article.excerpt}</span><span className="support-article-link">Open article <ChevronRight size={15} /></span></button>
}

function ChatConsole({ articles, aiStatus, onClose }) {
  const starter = { role: "model", content: "I’m the Digital Heroes support signal. Ask about scores, membership, charity impact, or past draws." }
  const [messages, setMessages] = useState([starter])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState("")
  const geminiOnline = Boolean(aiStatus?.gemini?.configured)
  const suggestions = articles.filter((article) => article.popular).slice(0, 3)

  async function send(message = input) {
    const content = message.trim()
    if (!content || sending) return
    const nextMessages = [...messages, { role: "user", content }]
    setMessages(nextMessages)
    setInput("")
    setSending(true)
    setNotice("")
    try {
      const data = await readJson("/api/help/chat", { method: "POST", body: JSON.stringify({ message: content, history: messages.slice(-8) }) })
      setMessages([...nextMessages, { role: "model", content: data.reply, source: data.source, model: data.model }])
    } catch (error) {
      setNotice(error.message)
    } finally {
      setSending(false)
    }
  }

  return <div className="support-chat-console"><div className="support-chat-heading"><div><span className={`support-live-status ${geminiOnline ? "" : "support-live-fallback"}`}><span className="live-dot" /> {geminiOnline ? `Gemini online / ${aiStatus.gemini.model}` : "Knowledge base fallback"}</span><strong>Ask the signal.</strong></div><button aria-label="Close support chat" className="glass-icon-button" onClick={onClose} type="button"><X size={16} /></button></div><div className="support-chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`support-message support-message-${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "model" ? <Bot size={14} /> : <MessageCircle size={14} />}</span><p>{message.content}</p>{message.source ? <small>{message.source === "gemini" ? `${message.model || aiStatus.gemini.model} / Gemini-powered` : "Help Center knowledge base"}</small> : null}</div>)}{sending ? <div className="support-message support-message-model"><span><Bot size={14} /></span><p className="support-thinking">Thinking<span>.</span><span>.</span><span>.</span></p></div> : null}</div>{suggestions.length ? <div className="support-suggestions">{suggestions.map((article) => <button className="glass-button" disabled={sending} key={article.slug} onClick={() => send(article.title)} type="button">{article.title}</button>)}</div> : null}<form className="support-chat-form" onSubmit={(event) => { event.preventDefault(); send() }}><input aria-label="Ask AI support" onChange={(event) => setInput(event.target.value)} placeholder="Ask about your membership…" value={input} /><button aria-label="Send support question" className="glass-submit-button" disabled={!input.trim() || sending} type="submit"><Send size={17} /></button></form>{notice ? <p className="support-chat-error" role="alert">{notice}</p> : null}</div>
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
  const [aiStatus, setAiStatus] = useState({ gemini: { configured: false, model: "gemini" }, publicArticleCount: 0 })

  async function loadArticles(queryValue = query, categoryValue = activeCategory) {
    setLoading(true)
    try {
      const data = await readJson(`/api/help/articles?query=${encodeURIComponent(queryValue)}&category=${encodeURIComponent(categoryValue)}`)
      setArticles(data.articles)
      setCategories(data.categories)
      setError("")
      setSelectedArticle((current) => current && data.articles.some((article) => article.slug === current.slug) ? current : data.articles[0] || null)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  async function selectArticle(slug) {
    try {
      const data = await readJson(`/api/help/articles/${encodeURIComponent(slug)}`)
      setSelectedArticle(data.article)
      document.getElementById("support-article-detail")?.scrollIntoView({ behavior: "smooth", block: "center" })
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadArticles(), 220)
    return () => window.clearTimeout(timer)
  }, [query, activeCategory])

  useEffect(() => {
    readJson("/api/help/status").then(setAiStatus).catch(() => {})
    const interval = window.setInterval(() => {
      loadArticles(query, activeCategory)
      readJson("/api/help/status").then(setAiStatus).catch(() => {})
    }, 20000)
    return () => window.clearInterval(interval)
  }, [query, activeCategory])

  function focusSearch() {
    document.getElementById("support-search")?.focus()
    document.getElementById("support-search-zone")?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  function openChat() {
    setChatOpen(true)
    window.setTimeout(() => document.getElementById("support-chat")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0)
  }

  const geminiOnline = Boolean(aiStatus.gemini?.configured)
  return <div className="help-page"><HeroBanner geminiOnline={geminiOnline} onAsk={openChat} onSearch={focusSearch} /><main className="help-main container"><section className="help-search-zone" id="support-search-zone"><div className="help-search-intro"><div><p className="eyebrow"><span className="eyebrow-line" /> Search the knowledge base</p><h2>Find the useful<br /><em>next step.</em></h2></div><span>{aiStatus.publicArticleCount || articles.length} live answers</span></div><div className="help-search-bar"><Search size={18} /><input aria-label="Search help center" id="support-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search membership, scores, draws, or impact…" value={query} />{query ? <button aria-label="Clear search" className="glass-icon-button" onClick={() => setQuery("")} type="button"><X size={15} /></button> : null}</div><div className="help-category-row"><button className={`glass-button ${!activeCategory ? "glass-button-active" : ""}`} onClick={() => setActiveCategory("")} type="button">All topics</button>{categories.map((category) => <button className={`glass-button ${activeCategory === category ? "glass-button-active" : ""}`} key={category} onClick={() => setActiveCategory((current) => current === category ? "" : category)} type="button">{category}</button>)}</div></section><section className="help-workspace"><div className="help-articles-column"><div className="help-section-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Support library</p><h2>Built for<br /><em>momentum.</em></h2></div><span>{loading ? "Refreshing" : `${articles.length} results`}</span></div>{error ? <div className="help-error"><CircleHelp size={17} /><span>{error}</span><button className="glass-button" onClick={() => loadArticles()} type="button">Try again</button></div> : null}<div className="help-article-grid">{articles.length ? articles.map((article) => <ArticleCard article={article} key={article.slug} onSelect={selectArticle} selected={selectedArticle?.slug === article.slug} />) : <div className="help-empty"><CircleHelp size={22} /><strong>{loading ? "Loading live articles…" : "No matching articles"}</strong><span>Try another phrase or topic.</span></div>}</div>{selectedArticle ? <article className="help-article-detail" id="support-article-detail"><span className="support-article-category">{selectedArticle.category}</span><h3>{selectedArticle.title}</h3><p>{selectedArticle.body}</p><div className="help-tag-row">{selectedArticle.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div></article> : null}</div><aside className={`help-chat-column ${chatOpen ? "help-chat-column-open" : ""}`} id="support-chat">{chatOpen ? <ChatConsole aiStatus={aiStatus} articles={articles} onClose={() => setChatOpen(false)} /> : <button className="help-chat-trigger" onClick={openChat} type="button"><Sparkles size={17} /> Open Gemini support</button>}</aside></section></main><footer className="help-footer container"><span><Headphones size={14} /> Support signal / available when you need it</span><button className="glass-button" onClick={() => window.location.assign("/")} type="button">Back to Digital Heroes <ArrowUpRight size={14} /></button></footer></div>
}
