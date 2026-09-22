import express from "express"
import Razorpay from "razorpay"
import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"
import { mirrorWinnerWorkflow, mongoWinnerStorage } from "./mongo-winner-storage.mjs"

const root = fileURLToPath(new URL(".", import.meta.url))
const dist = join(root, "dist")
const dataDir = join(root, "data")
const databasePath = process.env.DH_DB_PATH || join(dataDir, "digital-heroes.sqlite")
mkdirSync(join(databasePath, ".."), { recursive: true })

const app = express()
const port = process.env.PORT || "8787"
const isProduction = process.env.NODE_ENV === "production"
const sessionTtlSeconds = 60 * 60 * 24 * 30
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || ""
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""
const mockStripeMode = process.env.STRIPE_MOCK_MODE === "true" && !isProduction
const webhookSigningSecret = stripeWebhookSecret || (mockStripeMode ? "mock-webhook-secret" : "")
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || ""
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || ""
const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "")
const frontendOrigin = (process.env.FRONTEND_ORIGIN || "").replace(/\/$/, "")
const geminiApiKey = process.env.GEMINI_API_KEY || ""
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash"

const plans = new Map([
  ["monthly", { amount: 1200, interval: "month", label: "Digital Heroes Monthly", note: "Stay flexible", features: ["Cancel any time", "Monthly draw entry", "10% minimum to charity"], color: "lime" }],
  ["yearly", { amount: 12000, interval: "year", label: "Digital Heroes Yearly", note: "Two months on us", features: ["Best value plan", "12 monthly entries", "10% minimum to charity"], color: "coral" }],
])
const db = new DatabaseSync(databasePath)

db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('subscriber', 'admin')),
    plan TEXT,
    charity TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id),
    plan TEXT NOT NULL,
    charity TEXT NOT NULL,
    currency TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    status TEXT NOT NULL,
    stripe_session_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id),
    date TEXT NOT NULL,
    value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 45),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (member_id, date)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES members(id),
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS charities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    note TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS draws (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('random', 'algorithmic')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'simulated', 'published', 'completed')),
    pool_minor INTEGER NOT NULL,
    jackpot_rollover_minor INTEGER NOT NULL DEFAULT 0,
    winning_numbers_json TEXT,
    frequency_json TEXT,
    result_json TEXT,
    seed TEXT NOT NULL,
    created_at TEXT NOT NULL,
    simulated_at TEXT,
    published_at TEXT
  );
  CREATE TABLE IF NOT EXISTS draw_entries (
    draw_id TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id),
    numbers_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (draw_id, member_id)
  );
  CREATE TABLE IF NOT EXISTS winners (
    id TEXT PRIMARY KEY,
    draw_id TEXT NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL REFERENCES members(id),
    match_type TEXT NOT NULL CHECK (match_type IN ('5-number', '4-number', '3-number')),
    matched_count INTEGER NOT NULL,
    prize_minor INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected', 'paid')),
    proof_url TEXT,
    admin_note TEXT,
    verified_at TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    winner_id TEXT NOT NULL UNIQUE REFERENCES winners(id) ON DELETE CASCADE,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    provider TEXT NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('completed')),
    processed_by TEXT NOT NULL REFERENCES members(id),
    processed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS winner_workflow_events (
    id TEXT PRIMARY KEY,
    winner_id TEXT NOT NULL REFERENCES winners(id) ON DELETE CASCADE,
    actor_member_id TEXT REFERENCES members(id),
    action TEXT NOT NULL,
    note TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS help_articles (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    body TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    popular INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS draws_month_idx ON draws(month DESC);
  CREATE INDEX IF NOT EXISTS winners_status_idx ON winners(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS winner_events_winner_idx ON winner_workflow_events(winner_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS scores_member_date_idx ON scores(member_id, date DESC);
`)

const now = () => new Date().toISOString()
const id = (prefix) => `${prefix}_${randomBytes(12).toString("hex")}`
const hashToken = (token) => createHash("sha256").update(token).digest("hex")

function safeTextEqual(left, right) {
  const a = Buffer.from(String(left || ""))
  const b = Buffer.from(String(right || ""))
  return a.length === b.length && timingSafeEqual(a, b)
}

function seedDatabase() {
  const insertMember = db.prepare(`INSERT OR IGNORE INTO members (id, email, name, role, plan, charity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertCharity = db.prepare(`INSERT OR IGNORE INTO charities (id, name, category, note, description, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
  const insertSubscription = db.prepare(`INSERT OR IGNORE INTO subscriptions (id, member_id, plan, charity, currency, amount_minor, status, stripe_session_id, stripe_payment_intent_id, stripe_subscription_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insertHelpArticle = db.prepare(`INSERT OR IGNORE INTO help_articles (id, slug, category, title, excerpt, body, tags_json, popular, active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
  const timestamp = now()
  insertMember.run("demo", "member@digitalheroes.local", "Demo Member", "subscriber", "monthly", "The Good Grief Trust", timestamp, timestamp)
  insertMember.run("admin", "admin@digitalheroes.local", "Demo Admin", "admin", null, null, timestamp, timestamp)
  insertCharity.run("charity_good_grief", "The Good Grief Trust", "Mental health", "A quiet safety net for families rebuilding after loss.", "Support for people navigating grief and bereavement.", timestamp, timestamp)
  insertCharity.run("charity_clean_air", "Clean Air Fund", "Planet", "Backing cleaner air for children growing up in cities.", "Funding clean-air solutions where children need them most.", timestamp, timestamp)
  insertCharity.run("charity_street_child", "Street Child United", "Opportunity", "Putting sport, safety, and school within every child's reach.", "Using sport to create safe, ambitious pathways for vulnerable children.", timestamp, timestamp)
  insertSubscription.run("sub_demo", "demo", "monthly", "The Good Grief Trust", "INR", 120000, "active", null, null, null, timestamp, timestamp)
  for (const article of [
    { id: "help_getting_started", slug: "getting-started", category: "Getting started", title: "How Digital Heroes works", excerpt: "Choose a cause, keep five Stableford scores live, and enter the monthly draw.", body: "Digital Heroes connects a membership, your latest five Stableford scores, and a transparent monthly draw. Choose a monthly or yearly plan, select a cause, then sign in to add or update scores. Published draws show the winning numbers and prize tiers in the public archive.", tags: ["basics", "membership", "draw"], popular: 1, sortOrder: 1 },
    { id: "help_scores", slug: "manage-scores", category: "Scores & draws", title: "Managing your five scores", excerpt: "Add, edit, or remove scores while the newest five stay in play.", body: "Scores must be whole Stableford values from 1 to 45 and use a real round date that is not in the future. One score is allowed per date. When you add a sixth round, the oldest stored score rolls off automatically so the database always keeps five.", tags: ["scores", "stableford", "rolling window"], popular: 1, sortOrder: 2 },
    { id: "help_membership", slug: "membership-and-checkout", category: "Membership", title: "Plans, checkout, and status", excerpt: "Understand monthly and yearly plans and what happens after Stripe checkout.", body: "Choose the plan that fits your rhythm: monthly membership is flexible, while yearly membership covers twelve monthly entries. Checkout is handled by Stripe. Your membership becomes active only after the signed checkout webhook updates the database, and the account page polls that status for confirmation.", tags: ["stripe", "plans", "billing"], popular: 1, sortOrder: 3 },
    { id: "help_charity", slug: "charity-impact", category: "Charity impact", title: "Where the charity contribution goes", excerpt: "Follow the contribution trail from membership to the cause you selected.", body: "At least 10% of membership value is attributed to the selected active charity. The public Past Draws & Charity Impact archive groups recorded contributions by cause and shows the total ledger without requiring an account.", tags: ["charity", "impact", "contributions"], popular: 1, sortOrder: 4 },
    { id: "help_draws", slug: "past-draws", category: "Scores & draws", title: "Reading a published draw", excerpt: "Search the public archive for winning numbers, prize tiers, and pool history.", body: "Open Past Draws & Charity Impact from the main navigation. Search by month or winning number, select a published draw, and inspect its five winning numbers, pool, entry count, winners, and prize tiers. Draft and simulated draws remain private to administrators.", tags: ["archive", "winning numbers", "prizes"], popular: 0, sortOrder: 5 },
    { id: "help_account", slug: "account-and-security", category: "Account & security", title: "Keeping your account secure", excerpt: "Use your signed session to manage scores and membership state safely.", body: "Your session cookie is HttpOnly and scoped to the Digital Heroes app. Score and subscription management endpoints require an authenticated member or administrator role. Never share your password, Stripe details, or one-time verification codes.", tags: ["security", "account", "privacy"], popular: 0, sortOrder: 6 },
  ]) insertHelpArticle.run(article.id, article.slug, article.category, article.title, article.excerpt, article.body, JSON.stringify(article.tags), article.popular, article.sortOrder, timestamp, timestamp)

  const scoreCount = db.prepare("SELECT COUNT(*) AS count FROM scores WHERE member_id = ?").get("demo").count
  if (scoreCount === 0) {
    const insertScore = db.prepare("INSERT INTO scores (id, member_id, date, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    for (const score of [
      { id: "score_demo_1", date: "2026-03-14", value: 38 },
      { id: "score_demo_2", date: "2026-03-07", value: 34 },
      { id: "score_demo_3", date: "2026-02-28", value: 41 },
    ]) insertScore.run(score.id, "demo", score.date, score.value, timestamp, timestamp)
  }
}

seedDatabase()

function setSessionCookie(res, token) {
  const secure = isProduction ? "; Secure" : ""
  const sameSite = isProduction && frontendOrigin ? "None" : "Lax"
  res.set("Set-Cookie", `dh_session=${token}; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=${sessionTtlSeconds}${secure}`)
}

function clearSessionCookie(res) {
  const secure = isProduction ? "; Secure" : ""
  const sameSite = isProduction && frontendOrigin ? "None" : "Lax"
  res.set("Set-Cookie", `dh_session=; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=0${secure}`)
}

function requestCookies(req) {
  return Object.fromEntries((req.get("cookie") || "").split(";").filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split("=")
    return [key, decodeURIComponent(value.join("="))]
  }))
}

function memberFromRequest(req) {
  const bearer = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
  const token = bearer || requestCookies(req).dh_session
  if (!token) return null
  const session = db.prepare(`SELECT members.*, sessions.expires_at FROM sessions JOIN members ON members.id = sessions.member_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(hashToken(token), Date.now())
  return session || null
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const member = memberFromRequest(req)
    if (!member) return res.status(401).json({ message: "Sign in is required." })
    if (!allowedRoles.includes(member.role)) return res.status(403).json({ message: "Your role cannot access this resource." })
    req.member = member
    next()
  }
}

function getTargetMember(req) {
  if (req.member.role === "admin" && typeof req.query.member === "string" && req.query.member.trim()) return req.query.member.trim()
  return req.member.id
}

function scoreInput(body) {
  const value = Number(body.value)
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return "Enter a valid round date."
  const parsedDate = new Date(`${body.date}T00:00:00.000Z`)
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== body.date) return "Enter a valid round date."
  if (body.date > now().slice(0, 10)) return "Round date cannot be in the future."
  if (!Number.isInteger(value) || value < 1 || value > 45) return "Stableford scores must be whole numbers from 1 to 45."
  return null
}

function sortedScores(memberId) {
  return db.prepare("SELECT id, date, value FROM scores WHERE member_id = ? ORDER BY date DESC LIMIT 5").all(memberId)
}

function pruneScores(memberId) {
  db.prepare("DELETE FROM scores WHERE member_id = ? AND id NOT IN (SELECT id FROM scores WHERE member_id = ? ORDER BY date DESC LIMIT 5)").run(memberId, memberId)
}

function memberExists(memberId) {
  return Boolean(db.prepare("SELECT id FROM members WHERE id = ?").get(memberId))
}

function charityExists(name) {
  return Boolean(db.prepare("SELECT id FROM charities WHERE name = ? AND active = 1").get(name))
}

function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

function validDrawMonth(month) {
  return typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

function seededRandom(seed) {
  const digest = createHash("sha256").update(String(seed)).digest()
  let state = digest.readUInt32BE(0) || 1
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function activeDrawEntries() {
  const members = db.prepare("SELECT id, name FROM members WHERE role = 'subscriber' AND plan IS NOT NULL ORDER BY id").all()
  return members.map((member) => {
    const scoreValues = sortedScores(member.id).map((score) => score.value)
    return { memberId: member.id, name: member.name, scoreValues, numbers: [...new Set(scoreValues)] }
  })
}

function scoreFrequency(entries) {
  const frequency = Object.fromEntries(Array.from({ length: 45 }, (_, index) => [String(index + 1), 0]))
  for (const entry of entries) for (const number of entry.scoreValues) frequency[String(number)] += 1
  return frequency
}

function pickDrawNumbers(mode, frequency, random) {
  const available = Array.from({ length: 45 }, (_, index) => index + 1)
  const selected = []
  while (selected.length < 5 && available.length) {
    const weighted = available.map((number) => ({ number, weight: mode === "algorithmic" ? frequency[String(number)] + 1 : 1 }))
    const total = weighted.reduce((sum, item) => sum + item.weight, 0)
    let cursor = random() * total
    const picked = weighted.find((item) => { cursor -= item.weight; return cursor < 0 }) || weighted[weighted.length - 1]
    selected.push(picked.number)
    available.splice(available.indexOf(picked.number), 1)
  }
  return selected.sort((a, b) => a - b)
}

function previousJackpotMinor() {
  return db.prepare("SELECT jackpot_rollover_minor AS amount FROM draws WHERE status IN ('published', 'completed') ORDER BY published_at DESC LIMIT 1").get()?.amount || 0
}

function buildDrawResult(draw) {
  const entries = activeDrawEntries()
  const frequency = scoreFrequency(entries)
  const random = seededRandom(draw.seed)
  const winningNumbers = pickDrawNumbers(draw.mode, frequency, random)
  const winningSet = new Set(winningNumbers)
  const effectivePoolMinor = draw.pool_minor + previousJackpotMinor()
  const shares = { "5-number": 0.4, "4-number": 0.35, "3-number": 0.25 }
  const winners = []
  const tiers = {}

  for (const [matchType, share] of Object.entries(shares)) {
    const matchedCount = Number(matchType[0])
    const matches = entries.filter((entry) => entry.numbers.filter((number) => winningSet.has(number)).length === matchedCount)
    const tierPoolMinor = Math.floor(effectivePoolMinor * share)
    const prizeMinor = matches.length ? Math.floor(tierPoolMinor / matches.length) : 0
    tiers[matchType] = { poolMinor: tierPoolMinor, winnerCount: matches.length, prizeMinor, rolloverMinor: matchType === "5-number" && !matches.length ? tierPoolMinor : 0 }
    for (const entry of matches) winners.push({ memberId: entry.memberId, name: entry.name, matchType, matchedCount, prizeMinor, numbers: entry.numbers })
  }

  return { winningNumbers, frequency, entriesCount: entries.length, effectivePoolMinor, previousJackpotMinor: effectivePoolMinor - draw.pool_minor, tiers, winners }
}

function drawResponse(draw) {
  if (!draw) return null
  return { id: draw.id, month: draw.month, mode: draw.mode, status: draw.status, poolMinor: draw.pool_minor, jackpotRolloverMinor: draw.jackpot_rollover_minor, seed: draw.seed, winningNumbers: parseJson(draw.winning_numbers_json, []), frequency: parseJson(draw.frequency_json, {}), result: parseJson(draw.result_json, null), createdAt: draw.created_at, simulatedAt: draw.simulated_at, publishedAt: draw.published_at }
}

const winnerRecordQuery = `SELECT winners.id, winners.draw_id AS drawId, winners.member_id AS memberId, members.name, members.email, draws.month, draws.status AS drawStatus, winners.match_type AS matchType, winners.matched_count AS matchedCount, winners.prize_minor AS prizeMinor, winners.status, winners.proof_url AS proofUrl, winners.admin_note AS adminNote, winners.verified_at AS verifiedAt, winners.paid_at AS paidAt, payouts.id AS payoutId, payouts.provider AS payoutProvider, payouts.reference AS payoutReference, payouts.status AS payoutStatus, payouts.amount_minor AS payoutAmountMinor, payouts.processed_by AS payoutProcessedBy, payouts.processed_at AS payoutProcessedAt FROM winners JOIN members ON members.id = winners.member_id JOIN draws ON draws.id = winners.draw_id LEFT JOIN payouts ON payouts.winner_id = winners.id`

function winnerRecord(winnerId) {
  return db.prepare(`${winnerRecordQuery} WHERE winners.id = ?`).get(winnerId) || null
}

function winnerResponse(winner) {
  if (!winner) return null
  return {
    id: winner.id,
    drawId: winner.drawId,
    memberId: winner.memberId,
    name: winner.name,
    email: winner.email,
    month: winner.month,
    drawStatus: winner.drawStatus,
    matchType: winner.matchType,
    matchedCount: Number(winner.matchedCount),
    prizeMinor: Number(winner.prizeMinor),
    status: winner.status,
    proofUrl: winner.proofUrl,
    adminNote: winner.adminNote,
    verifiedAt: winner.verifiedAt,
    paidAt: winner.paidAt,
    payout: winner.payoutId ? { id: winner.payoutId, provider: winner.payoutProvider, reference: winner.payoutReference, status: winner.payoutStatus, amountMinor: Number(winner.payoutAmountMinor), processedBy: winner.payoutProcessedBy, processedAt: winner.payoutProcessedAt } : null,
  }
}

function recordWinnerEvent(winnerId, actorMemberId, action, note = "", metadata = {}) {
  const event = { id: id("winner_event"), winnerId, actorMemberId, action, note, metadata, createdAt: now() }
  db.prepare("INSERT INTO winner_workflow_events (id, winner_id, actor_member_id, action, note, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(event.id, event.winnerId, event.actorMemberId, event.action, event.note, JSON.stringify(event.metadata), event.createdAt)
  const winner = winnerRecord(winnerId)
  if (winner) void mirrorWinnerWorkflow({ winner, event, payout: winner.payoutId ? { id: winner.payoutId, provider: winner.payoutProvider, reference: winner.payoutReference, status: winner.payoutStatus, amountMinor: Number(winner.payoutAmountMinor), processedAt: winner.payoutProcessedAt } : null })
  return event
}

function winnerWorkflowResponse(queryParams = {}) {
  const status = ["pending", "verified", "rejected", "paid"].includes(queryParams.status) ? queryParams.status : ""
  const query = typeof queryParams.query === "string" ? queryParams.query.trim().slice(0, 80) : ""
  const clauses = []
  const params = []
  if (status) { clauses.push("winners.status = ?"); params.push(status) }
  if (query) { clauses.push("(members.name LIKE ? OR members.email LIKE ? OR draws.month LIKE ? OR winners.match_type LIKE ?)"); params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`) }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""
  const requestedLimit = Number(queryParams.limit)
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50
  const winners = db.prepare(`${winnerRecordQuery}${where} ORDER BY CASE winners.status WHEN 'pending' THEN 0 WHEN 'verified' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, winners.updated_at DESC LIMIT ?`).all(...params, limit).map(winnerResponse)
  const metrics = db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) AS verified, SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid, COALESCE(SUM(CASE WHEN status = 'pending' THEN prize_minor ELSE 0 END), 0) AS pendingValueMinor, COALESCE(SUM(CASE WHEN status = 'verified' THEN prize_minor ELSE 0 END), 0) AS verifiedValueMinor, COALESCE(SUM(CASE WHEN status = 'paid' THEN prize_minor ELSE 0 END), 0) AS paidValueMinor FROM winners`).get()
  const events = db.prepare("SELECT events.id, events.winner_id AS winnerId, events.action, events.note, events.metadata_json AS metadataJson, events.created_at AS createdAt, members.name AS actorName, members.email AS actorEmail FROM winner_workflow_events events LEFT JOIN members ON members.id = events.actor_member_id ORDER BY events.created_at DESC LIMIT 20").all().map((event) => ({ id: event.id, winnerId: event.winnerId, action: event.action, note: event.note, metadata: parseJson(event.metadataJson, {}), createdAt: event.createdAt, actor: event.actorName ? { name: event.actorName, email: event.actorEmail } : null }))
  return { filters: { status, query, limit }, metrics: { total: Number(metrics.total), pending: Number(metrics.pending || 0), verified: Number(metrics.verified || 0), rejected: Number(metrics.rejected || 0), paid: Number(metrics.paid || 0), pendingValueMinor: Number(metrics.pendingValueMinor), verifiedValueMinor: Number(metrics.verifiedValueMinor), paidValueMinor: Number(metrics.paidValueMinor) }, winners, events, storage: mongoWinnerStorage }
}

function getDraw(drawId) {
  return db.prepare("SELECT * FROM draws WHERE id = ?").get(drawId)
}

function saveSimulation(draw) {
  const result = buildDrawResult(draw)
  const timestamp = now()
  db.prepare("DELETE FROM draw_entries WHERE draw_id = ?").run(draw.id)
  const insertEntry = db.prepare("INSERT INTO draw_entries (draw_id, member_id, numbers_json, created_at) VALUES (?, ?, ?, ?)")
  for (const entry of activeDrawEntries()) insertEntry.run(draw.id, entry.memberId, JSON.stringify(entry.scoreValues), timestamp)
  db.prepare("UPDATE draws SET status = 'simulated', winning_numbers_json = ?, frequency_json = ?, result_json = ?, simulated_at = ? WHERE id = ?").run(JSON.stringify(result.winningNumbers), JSON.stringify(result.frequency), JSON.stringify(result), timestamp, draw.id)
  return { ...drawResponse(getDraw(draw.id)), result }
}

function publishDraw(draw) {
  const saved = getDraw(draw.id)
  const result = parseJson(saved.result_json, null)
  if (!result || saved.status !== "simulated") throw Object.assign(new Error("Run a simulation before publishing the draw."), { statusCode: 409 })
  const timestamp = now()
  db.exec("BEGIN")
  try {
    const insertWinner = db.prepare("INSERT INTO winners (id, draw_id, member_id, match_type, matched_count, prize_minor, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)")
    for (const winner of result.winners) insertWinner.run(id("winner"), saved.id, winner.memberId, winner.matchType, winner.matchedCount, winner.prizeMinor, timestamp, timestamp)
    db.prepare("UPDATE draws SET status = 'published', jackpot_rollover_minor = ?, published_at = ? WHERE id = ?").run(result.tiers["5-number"].rolloverMinor, timestamp, saved.id)
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
  return drawResponse(getDraw(saved.id))
}

function parseStripeSignature(header) {
  const values = Object.fromEntries(header.split(",").map((part) => part.split("=")))
  return { timestamp: values.t, signature: values.v1 }
}

function verifyStripeSignature(payload, header) {
  if (!webhookSigningSecret || !header) return false
  const { timestamp, signature } = parseStripeSignature(header)
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
  const expected = createHmac("sha256", webhookSigningSecret).update(`${timestamp}.${payload}`).digest("hex")
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

async function stripeRequest(path, params, method = "POST") {
  if (!stripeSecretKey) throw Object.assign(new Error("Stripe is not configured on the server."), { statusCode: 503 })
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" || !params ? undefined : new URLSearchParams(params),
  })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.error?.message || "Stripe request failed."), { statusCode: response.status })
  return data
}

function checkoutBaseUrl(req) {
  if (publicBaseUrl) return publicBaseUrl
  if (isProduction) return null
  return `${req.protocol}://${req.get("host")}`
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character])
}

async function createStripeCheckout(req, { name, email, plan, charity, memberId }) {
  const selectedPlan = plans.get(plan)
  const baseUrl = checkoutBaseUrl(req)
  if (!baseUrl) throw Object.assign(new Error("PUBLIC_BASE_URL must be configured for live checkout."), { statusCode: 503 })
  if (mockStripeMode) {
    const sessionId = id("cs_mock")
    return { id: sessionId, url: `${baseUrl}/mock-stripe/checkout/${sessionId}`, status: "open", mock: true, customer_email: email, metadata: { member_id: memberId, plan, charity } }
  }
  const params = {
    mode: "subscription",
    customer_email: email,
    "line_items[0][price_data][currency]": "inr",
    "line_items[0][price_data][unit_amount]": selectedPlan.amount * 100,
    "line_items[0][price_data][product_data][name]": selectedPlan.label,
    "line_items[0][price_data][product_data][description]": `Membership supporting ${charity}`,
    "line_items[0][price_data][recurring][interval]": selectedPlan.interval,
    "line_items[0][quantity]": 1,
    "metadata[member_id]": memberId,
    "metadata[plan]": plan,
    "metadata[charity]": charity,
    "subscription_data[metadata][member_id]": memberId,
    "subscription_data[metadata][plan]": plan,
    "subscription_data[metadata][charity]": charity,
    success_url: `${baseUrl}/subscription-scores?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/subscription-scores?checkout=cancelled`,
    billing_address_collection: "auto",
    allow_promotion_codes: "true",
  }
  return stripeRequest("checkout/sessions", params)
}

function upsertMember(name, email, role = "subscriber") {
  const existing = db.prepare("SELECT * FROM members WHERE email = ?").get(email.toLowerCase())
  const timestamp = now()
  if (existing) {
    db.prepare("UPDATE members SET name = ?, updated_at = ? WHERE id = ?").run(name.trim(), timestamp, existing.id)
    return existing.id
  }
  const memberId = id("member")
  db.prepare("INSERT INTO members (id, email, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(memberId, email.toLowerCase(), name.trim(), role, timestamp, timestamp)
  return memberId
}

function syncMemberStatus(memberId) {
  const active = db.prepare("SELECT s.plan, s.charity, m.stripe_customer_id AS stripeCustomerId, s.stripe_subscription_id AS stripeSubscriptionId FROM subscriptions s JOIN members m ON m.id = s.member_id WHERE s.member_id = ? AND s.status = 'active' ORDER BY s.updated_at DESC LIMIT 1").get(memberId)
  const timestamp = now()
  if (active) {
    db.prepare("UPDATE members SET plan = ?, charity = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = ?, updated_at = ? WHERE id = ?").run(active.plan, active.charity, active.stripeCustomerId, active.stripeSubscriptionId, timestamp, memberId)
  } else {
    db.prepare("UPDATE members SET plan = NULL, charity = NULL, stripe_subscription_id = NULL, updated_at = ? WHERE id = ?").run(timestamp, memberId)
  }
}

function subscriptionResponse(memberId) {
  const member = db.prepare("SELECT id, email, name, role, plan, charity FROM members WHERE id = ?").get(memberId)
  const subscription = db.prepare("SELECT s.id, s.plan, s.charity, s.currency, s.amount_minor AS amountMinor, s.status, s.stripe_session_id AS stripeSessionId, s.stripe_subscription_id AS stripeSubscriptionId, s.created_at AS createdAt, s.updated_at AS updatedAt FROM subscriptions s WHERE s.member_id = ? ORDER BY CASE s.status WHEN 'active' THEN 0 WHEN 'checkout_created' THEN 1 ELSE 2 END, s.updated_at DESC LIMIT 1").get(memberId) || null
  return { member, subscription }
}

function memberDashboardResponse(memberId) {
  const account = subscriptionResponse(memberId)
  const scores = sortedScores(memberId)
  const drawEntries = db.prepare(`SELECT e.draw_id AS drawId, d.month, d.status, d.mode, d.pool_minor AS poolMinor, d.jackpot_rollover_minor AS jackpotRolloverMinor, d.winning_numbers_json AS winningNumbersJson, e.numbers_json AS numbersJson, e.created_at AS createdAt
    FROM draw_entries e JOIN draws d ON d.id = e.draw_id
    WHERE e.member_id = ? AND d.status IN ('published', 'completed')
    ORDER BY d.month DESC, d.published_at DESC, e.created_at DESC`).all(memberId).map((entry) => ({
    drawId: entry.drawId,
    month: entry.month,
    status: entry.status,
    mode: entry.mode,
    poolMinor: Number(entry.poolMinor),
    jackpotRolloverMinor: Number(entry.jackpotRolloverMinor),
    numbers: parseJson(entry.numbersJson, []),
    winningNumbers: parseJson(entry.winningNumbersJson, []),
    createdAt: entry.createdAt,
  }))
  const rewards = db.prepare(`SELECT w.id, w.draw_id AS drawId, d.month, w.match_type AS matchType, w.matched_count AS matchedCount, w.prize_minor AS prizeMinor, w.status, w.proof_url AS proofUrl, w.admin_note AS adminNote, w.verified_at AS verifiedAt, w.paid_at AS paidAt, e.numbers_json AS numbersJson
    FROM winners w JOIN draws d ON d.id = w.draw_id LEFT JOIN draw_entries e ON e.draw_id = w.draw_id AND e.member_id = w.member_id
    WHERE w.member_id = ? ORDER BY w.created_at DESC`).all(memberId).map((reward) => ({
    id: reward.id,
    drawId: reward.drawId,
    month: reward.month,
    matchType: reward.matchType,
    matchedCount: Number(reward.matchedCount),
    prizeMinor: Number(reward.prizeMinor),
    status: reward.status,
    proofUrl: reward.proofUrl,
    adminNote: reward.adminNote,
    verifiedAt: reward.verifiedAt,
    paidAt: reward.paidAt,
    numbers: parseJson(reward.numbersJson, []),
  }))
  const rewardTotals = rewards.reduce((totals, reward) => {
    totals.totalMinor += reward.prizeMinor
    if (reward.status === "paid") totals.paidMinor += reward.prizeMinor
    if (reward.status === "pending" || reward.status === "verified") totals.outstandingMinor += reward.prizeMinor
    return totals
  }, { totalMinor: 0, paidMinor: 0, outstandingMinor: 0 })
  const contribution = db.prepare("SELECT COALESCE(SUM(amount_minor * 10 / 100), 0) AS totalMinor, COALESCE(SUM(CASE WHEN charity = ? THEN amount_minor * 10 / 100 ELSE 0 END), 0) AS currentCharityMinor FROM subscriptions WHERE member_id = ? AND status IN ('active', 'cancelled')").get(account.member?.charity || "", memberId)
  const plan = account.subscription?.status === "active" ? plans.get(account.subscription.plan) : null
  const nextDraw = publicSnapshot()
  return {
    member: account.member,
    subscription: account.subscription,
    plan: plan ? { key: account.subscription.plan, name: account.subscription.plan === "monthly" ? "Monthly" : "Yearly", amount: plan.amount, cadence: plan.interval, features: plan.features, note: plan.note } : null,
    perks: plan?.features || [],
    scores,
    drawEntries,
    rewards,
    rewardSummary: { ...rewardTotals, count: rewards.length },
    impact: { currentCharity: account.member?.charity || null, totalMinor: Number(contribution.totalMinor), currentCharityMinor: Number(contribution.currentCharityMinor), percentage: 10 },
    nextDraw: { date: nextDraw.nextDrawDate, label: nextDraw.nextDraw },
  }
}

function publicSnapshot() {
  const counts = db.prepare(`SELECT
    (SELECT COUNT(*) FROM members WHERE role = 'subscriber' AND plan IS NOT NULL) AS activeMembers,
    (SELECT COALESCE(SUM(amount_minor), 0) FROM subscriptions WHERE status = 'active') AS prizePoolMinor,
    (SELECT COALESCE(SUM(amount_minor * 10 / 100), 0) FROM subscriptions WHERE status = 'active') AS charityContributionMinor`).get()
  const featuredCharity = db.prepare("SELECT name, category, note FROM charities WHERE active = 1 ORDER BY rowid ASC LIMIT 1").get() || { name: "No active cause", category: "Directory empty", note: "An administrator can add the first active cause." }
  const nextDate = new Date()
  nextDate.setUTCMonth(nextDate.getUTCMonth() + 1, 1)
  nextDate.setUTCHours(0, 0, 0, 0)
  const daysUntilDraw = Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / 86400000))
  return {
    activeMembers: Number(counts.activeMembers),
    prizePoolMinor: Number(counts.prizePoolMinor),
    charityTotal: Math.floor(Number(counts.charityContributionMinor) / 100),
    charityContributionMinor: Number(counts.charityContributionMinor),
    nextDraw: `${daysUntilDraw} day${daysUntilDraw === 1 ? "" : "s"}`,
    nextDrawDate: nextDate.toISOString().slice(0, 10),
    featuredCharity,
    charities: db.prepare("SELECT id, name, category, note, description FROM charities WHERE active = 1 ORDER BY name").all(),
    plans: [...plans.entries()].map(([key, plan]) => ({ key, name: key === "monthly" ? "Monthly" : "Yearly", price: plan.amount, cadence: plan.interval, note: plan.note, features: plan.features, color: plan.color })),
  }
}

function charityImpactSummary() {
  const total = db.prepare("SELECT COALESCE(SUM(amount_minor * 10 / 100), 0) AS amountMinor FROM subscriptions WHERE status IN ('active', 'cancelled')").get()
  const charities = db.prepare("SELECT charity, COALESCE(SUM(amount_minor * 10 / 100), 0) AS amountMinor, COUNT(*) AS contributionCount FROM subscriptions WHERE status IN ('active', 'cancelled') GROUP BY charity ORDER BY amountMinor DESC, charity ASC").all()
  return { totalMinor: Number(total.amountMinor), charities: charities.map((item) => ({ charity: item.charity, amountMinor: Number(item.amountMinor), contributionCount: Number(item.contributionCount) })) }
}

function publicDrawResponse(draw) {
  const response = drawResponse(draw)
  const totals = db.prepare("SELECT COUNT(*) AS winnerCount, COALESCE(SUM(prize_minor), 0) AS prizeMinor FROM winners WHERE draw_id = ?").get(draw.id)
  const result = response.result || {}
  return {
    id: response.id,
    month: response.month,
    mode: response.mode,
    status: response.status,
    poolMinor: response.poolMinor,
    jackpotRolloverMinor: response.jackpotRolloverMinor,
    winningNumbers: response.winningNumbers,
    entriesCount: Number(result.entriesCount || 0),
    winnerCount: Number(totals.winnerCount),
    prizeMinor: Number(totals.prizeMinor),
    tiers: result.tiers || {},
    createdAt: response.createdAt,
    simulatedAt: response.simulatedAt,
    publishedAt: response.publishedAt,
  }
}

function helpArticleResponse(article) {
  return { id: article.id, slug: article.slug, category: article.category, title: article.title, excerpt: article.excerpt, body: article.body, tags: parseJson(article.tags_json, []), popular: Boolean(article.popular) }
}

function findHelpArticles(query = "", category = "") {
  const clauses = ["active = 1"]
  const params = []
  if (category) { clauses.push("category = ?"); params.push(category) }
  if (query) { clauses.push("(title LIKE ? OR excerpt LIKE ? OR body LIKE ? OR tags_json LIKE ?)"); const term = `%${query}%`; params.push(term, term, term, term) }
  return db.prepare(`SELECT id, slug, category, title, excerpt, body, tags_json, popular FROM help_articles WHERE ${clauses.join(" AND ")} ORDER BY popular DESC, sort_order ASC, title ASC`).all(...params).map(helpArticleResponse)
}

function fallbackSupportReply(message, articles) {
  const words = String(message).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2)
  const ranked = articles.map((article) => ({ article, score: words.reduce((score, word) => score + (article.title + " " + article.body + " " + article.tags.join(" ")).toLowerCase().includes(word) ? 1 : 0, 0) })).sort((left, right) => right.score - left.score)
  const best = ranked[0]?.article
  if (!best || ranked[0].score === 0) return "I could not find a precise answer in the Digital Heroes help center. Try asking about scores, membership checkout, charity impact, or past draws, or contact support for a human answer."
  return `${best.title}\n\n${best.body}\n\nYou can open the related article in the help center for the full walkthrough.`
}

async function geminiSupportReply(message, history, articles) {
  const fallback = () => ({ reply: fallbackSupportReply(message, articles), source: "knowledge-base" })
  if (!geminiApiKey) return fallback()
  const context = articles.slice(0, 8).map((article) => `TITLE: ${article.title}\nCATEGORY: ${article.category}\nCONTENT: ${article.body}`).join("\n\n")
  const contents = [...history.slice(-8).map((item) => ({ role: item.role === "model" ? "model" : "user", parts: [{ text: String(item.content).slice(0, 1200) }] })), { role: "user", parts: [{ text: String(message).slice(0, 1200) }] }]
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(12000), body: JSON.stringify({ system_instruction: { parts: [{ text: `You are the Digital Heroes Help Center assistant. Answer only from the support context below. Be concise, kind, and practical. Never invent billing status, winning numbers, refunds, or account actions. If the context does not answer the question, say so and suggest human support.\n\nSUPPORT CONTEXT:\n${context}` }] }, contents, generationConfig: { temperature: 0.2, maxOutputTokens: 500 } }) })
    const data = await response.json()
    const reply = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim()
    if (!response.ok || !reply) throw new Error("Gemini did not return a support answer.")
    return { reply, source: "gemini", model: geminiModel }
  } catch {
    return { ...fallback(), degraded: true }
  }
}

function signMockWebhook(payload) {
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac("sha256", webhookSigningSecret).update(`${timestamp}.${payload}`).digest("hex")
  return `t=${timestamp},v1=${signature}`
}

async function deliverMockWebhook(event) {
  const payload = JSON.stringify(event)
  const signature = signMockWebhook(payload)
  if (!verifyStripeSignature(payload, signature)) throw new Error("Mock webhook signature verification failed.")
  await handleStripeEvent(event)
}

async function handleStripeEvent(event) {
  const object = event.data?.object
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const subscription = db.prepare("SELECT * FROM subscriptions WHERE stripe_session_id = ?").get(object.id)
    if (!subscription) return
    const timestamp = now()
    db.prepare("UPDATE subscriptions SET status = ?, stripe_payment_intent_id = ?, stripe_subscription_id = ?, updated_at = ? WHERE id = ?").run("active", object.payment_intent || null, object.subscription || null, timestamp, subscription.id)
    db.prepare("UPDATE members SET plan = ?, charity = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = ? WHERE id = ?").run(subscription.plan, subscription.charity, object.customer || null, object.subscription || null, timestamp, subscription.member_id)
  }
  if (event.type === "checkout.session.expired") {
    db.prepare("UPDATE subscriptions SET status = ?, updated_at = ? WHERE stripe_session_id = ?").run("expired", now(), object.id)
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const status = event.type === "customer.subscription.deleted" ? "cancelled" : object.status
    const subscription = db.prepare("SELECT member_id AS memberId FROM subscriptions WHERE stripe_subscription_id = ?").get(object.id)
    db.prepare("UPDATE subscriptions SET status = ?, updated_at = ? WHERE stripe_subscription_id = ?").run(status, now(), object.id)
    if (subscription) syncMemberStatus(subscription.memberId)
  }
}

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const payload = req.body.toString("utf8")
  if (!verifyStripeSignature(payload, req.get("stripe-signature"))) return res.status(400).json({ message: "Invalid Stripe webhook signature." })
  try {
    await handleStripeEvent(JSON.parse(payload))
    return res.json({ received: true })
  } catch (error) {
    return res.status(500).json({ message: error.message || "Webhook processing failed." })
  }
})

app.use(express.json())
app.use((req, res, next) => {
  const requestOrigin = req.get("origin") || ""
  const allowedOrigin = frontendOrigin ? (requestOrigin === frontendOrigin ? frontendOrigin : "null") : "*"
  res.set("Access-Control-Allow-Origin", allowedOrigin)
  if (allowedOrigin !== "*") res.set("Vary", "Origin")
  if (frontendOrigin) res.set("Access-Control-Allow-Credentials", "true")
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
  if (req.method === "OPTIONS") return res.sendStatus(204)
  next()
})

app.get("/health", (_req, res) => res.json({ ok: true, service: "digital-heroes-api", version: process.env.GITHUB_SHA || "local" }))

app.get("/api/impact", (_req, res) => res.set("Cache-Control", "no-store").json(publicSnapshot()))

app.get("/api/charity-impact", (_req, res) => res.set("Cache-Control", "no-store").json(charityImpactSummary()))

app.get("/api/past-draws", (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim().slice(0, 40) : ""
  const month = typeof req.query.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month) ? req.query.month : ""
  const requestedLimit = Number(req.query.limit)
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 24) : 8
  const requestedOffset = Number(req.query.offset)
  const offset = Number.isInteger(requestedOffset) ? Math.max(requestedOffset, 0) : 0
  const clauses = ["status IN ('published', 'completed')"]
  const params = []
  if (month) { clauses.push("month = ?"); params.push(month) }
  if (query) { clauses.push("(month LIKE ? OR winning_numbers_json LIKE ?)"); params.push(`%${query}%`, `%${query}%`) }
  const where = clauses.join(" AND ")
  const total = db.prepare(`SELECT COUNT(*) AS count FROM draws WHERE ${where}`).get(...params).count
  const draws = db.prepare(`SELECT * FROM draws WHERE ${where} ORDER BY month DESC, published_at DESC, created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset).map(publicDrawResponse)
  const months = db.prepare("SELECT DISTINCT month FROM draws WHERE status IN ('published', 'completed') ORDER BY month DESC").all().map((item) => item.month)
  return res.set("Cache-Control", "no-store").json({ draws, total: Number(total), limit, offset, hasMore: offset + draws.length < Number(total), months, charityImpact: charityImpactSummary() })
})

app.get("/api/past-draws/:id", (req, res) => {
  const draw = db.prepare("SELECT * FROM draws WHERE id = ? AND status IN ('published', 'completed')").get(req.params.id)
  if (!draw) return res.status(404).json({ message: "That published draw could not be found." })
  const tiers = db.prepare("SELECT match_type AS matchType, COUNT(*) AS winnerCount, COALESCE(SUM(prize_minor), 0) AS prizeMinor FROM winners WHERE draw_id = ? GROUP BY match_type ORDER BY match_type DESC").all(draw.id).map((item) => ({ matchType: item.matchType, winnerCount: Number(item.winnerCount), prizeMinor: Number(item.prizeMinor) }))
  return res.set("Cache-Control", "no-store").json({ draw: { ...publicDrawResponse(draw), tiers } })
})

app.get("/api/help/articles", (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim().slice(0, 100) : ""
  const category = typeof req.query.category === "string" ? req.query.category.trim().slice(0, 80) : ""
  const articles = findHelpArticles(query, category)
  const categories = db.prepare("SELECT DISTINCT category FROM help_articles WHERE active = 1 ORDER BY sort_order ASC, category ASC").all().map((item) => item.category)
  return res.set("Cache-Control", "no-store").json({ articles, categories, query, category })
})

app.get("/api/help/articles/:slug", (req, res) => {
  const article = db.prepare("SELECT id, slug, category, title, excerpt, body, tags_json, popular FROM help_articles WHERE slug = ? AND active = 1").get(req.params.slug)
  if (!article) return res.status(404).json({ message: "That help article could not be found." })
  return res.set("Cache-Control", "no-store").json({ article: helpArticleResponse(article) })
})

app.post("/api/help/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : ""
  if (!message || message.length > 1200) return res.status(422).json({ message: "Ask a question between 1 and 1,200 characters." })
  const history = Array.isArray(req.body?.history) ? req.body.history.filter((item) => item && ["user", "model"].includes(item.role) && typeof item.content === "string").slice(-8) : []
  const articles = findHelpArticles()
  const answer = await geminiSupportReply(message, history, articles)
  return res.json(answer)
})

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {}
  const accounts = [
    { email: process.env.DEMO_SUBSCRIBER_EMAIL || (!isProduction ? "member@digitalheroes.local" : ""), password: process.env.DEMO_SUBSCRIBER_PASSWORD || (!isProduction ? "demo-subscriber" : ""), memberId: "demo" },
    { email: process.env.DEMO_ADMIN_EMAIL || (!isProduction ? "admin@digitalheroes.local" : ""), password: process.env.DEMO_ADMIN_PASSWORD || (!isProduction ? "demo-admin" : ""), memberId: "admin" },
  ]
  const account = accounts.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase())
  if (!account || !safeTextEqual(account.password, password)) return res.status(401).json({ message: "Email or password is incorrect." })
  const token = randomBytes(32).toString("base64url")
  db.prepare("INSERT INTO sessions (token_hash, member_id, expires_at) VALUES (?, ?, ?)").run(hashToken(token), account.memberId, Date.now() + sessionTtlSeconds * 1000)
  setSessionCookie(res, token)
  const member = db.prepare("SELECT id, email, name, role, plan, charity FROM members WHERE id = ?").get(account.memberId)
  return res.json({ member })
})

app.get("/api/auth/session", (req, res) => {
  const member = memberFromRequest(req)
  if (!member) return res.status(401).json({ message: "Sign in is required." })
  return res.json({ member: { id: member.id, email: member.email, name: member.name, role: member.role, plan: member.plan, charity: member.charity } })
})

app.post("/api/auth/logout", (req, res) => {
  const token = requestCookies(req).dh_session
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token))
  clearSessionCookie(res)
  return res.json({ ok: true })
})

app.get("/api/member/subscription", requireRole("subscriber", "admin"), (req, res) => {
  return res.set("Cache-Control", "no-store").json(subscriptionResponse(req.member.id))
})

app.get("/api/member/dashboard", requireRole("subscriber", "admin"), (req, res) => {
  return res.set("Cache-Control", "no-store").json(memberDashboardResponse(req.member.id))
})

app.post("/api/member/subscription/cancel", requireRole("subscriber", "admin"), async (req, res) => {
  const subscription = db.prepare("SELECT * FROM subscriptions WHERE member_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1").get(req.member.id)
  if (!subscription) return res.status(404).json({ message: "There is no active subscription to cancel." })
  try {
    if (subscription.stripe_subscription_id && stripeSecretKey) await stripeRequest(`subscriptions/${encodeURIComponent(subscription.stripe_subscription_id)}`, null, "DELETE")
    db.prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now(), subscription.id)
    syncMemberStatus(req.member.id)
    return res.json({ ...subscriptionResponse(req.member.id), message: "Your subscription has been cancelled." })
  } catch (error) {
    return res.status(error.statusCode || 502).json({ message: error.message || "The subscription could not be cancelled." })
  }
})

app.post("/api/subscribe", (req, res) => {
  const { name, email, plan, charity, currency = "INR" } = req.body || {}
  if (!String(name || "").trim() || !validEmail(email) || !plans.has(plan) || !charityExists(charity) || currency !== "INR") return res.status(422).json({ message: "Enter a valid name, email, plan, charity, and INR currency." })
  const memberId = upsertMember(String(name), String(email))
  return res.status(201).json({ id: memberId, message: `You are on the list, ${String(name).trim().split(" ")[0]}.`, plan, charity, currency })
})

app.post("/api/checkout/session", async (req, res) => {
  const { name, email, plan, charity, currency } = req.body || {}
  if (!String(name || "").trim() || !validEmail(email) || !plans.has(plan) || !charityExists(charity) || currency !== "INR") return res.status(422).json({ message: "Enter a valid name, email, plan, charity, and INR currency." })
  try {
    const memberId = upsertMember(String(name), String(email))
    const stripeSession = await createStripeCheckout(req, { name: String(name), email: String(email), plan, charity, memberId })
    const selectedPlan = plans.get(plan)
    const timestamp = now()
    const subscriptionId = id("sub")
    db.prepare(`INSERT INTO subscriptions (id, member_id, plan, charity, currency, amount_minor, status, stripe_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(subscriptionId, memberId, plan, charity, "INR", selectedPlan.amount * 100, "checkout_created", stripeSession.id, timestamp, timestamp)
    return res.status(201).json({ id: stripeSession.id, checkoutUrl: stripeSession.url, status: stripeSession.status, plan, charity, currency: "INR", amount: selectedPlan.amount, amountMinor: selectedPlan.amount * 100 })
  } catch (error) {
    return res.status(error.statusCode || 502).json({ message: error.message || "Checkout could not be started." })
  }
})

app.get("/api/checkout/session/status", async (req, res) => {
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : ""
  if (!sessionId) return res.status(422).json({ message: "A checkout session id is required." })
  const saved = db.prepare("SELECT id, plan, charity, currency, amount_minor AS amountMinor, status FROM subscriptions WHERE stripe_session_id = ?").get(sessionId)
  if (!saved) return res.status(404).json({ message: "That checkout session could not be found." })
  if (stripeSecretKey && saved.status === "checkout_created") {
    try {
      const stripeSession = await stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}`, null, "GET")
      if (stripeSession.payment_status === "paid" || stripeSession.status === "complete") await handleStripeEvent({ type: "checkout.session.completed", data: { object: stripeSession } })
    } catch {
      // Webhook delivery remains the source of truth if retrieval is unavailable.
    }
  }
  return res.json(db.prepare("SELECT id, plan, charity, currency, amount_minor AS amountMinor, status FROM subscriptions WHERE stripe_session_id = ?").get(sessionId))
})

app.get("/mock-stripe/checkout/:sessionId", (req, res) => {
  if (!mockStripeMode) return res.status(404).send("Mock Stripe is disabled.")
  const session = db.prepare("SELECT stripe_session_id AS id, plan, charity, currency, amount_minor AS amountMinor, status FROM subscriptions WHERE stripe_session_id = ?").get(req.params.sessionId)
  if (!session) return res.status(404).send("Mock checkout session not found.")
  const amount = (session.amountMinor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sessionId = encodeURIComponent(session.id)
  return res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mock Stripe Checkout</title><style>body{margin:0;background:#f6f7f4;color:#12262b;font:16px system-ui,sans-serif}.shell{max-width:620px;margin:8vh auto;padding:24px}.brand{font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#617b25}.card{margin-top:18px;padding:30px;border:1px solid #d6ddd5;border-radius:12px;background:#fff;box-shadow:0 18px 50px #12262b14}.eyebrow{color:#66757a;font-size:12px;letter-spacing:.1em;text-transform:uppercase}.amount{font-size:42px;font-weight:700}.meta{color:#66757a}.actions{display:grid;gap:12px;margin-top:28px}button{min-height:48px;padding:0 18px;border:0;border-radius:6px;background:#d7fa6b;color:#12262b;font-weight:700;cursor:pointer}button.secondary{background:#eef1ed}.notice{padding:12px;border-radius:6px;background:#fff7d6;color:#765b13;font-size:13px}</style></head><body><main class="shell"><div class="brand">Digital Heroes / Mock Stripe</div><section class="card"><p class="eyebrow">Test checkout session</p><h1>${escapeHtml(session.plan)} membership</h1><p class="amount">INR ${amount}</p><p class="meta">Supporting ${escapeHtml(session.charity)}<br>Session ${escapeHtml(session.id)}</p><p class="notice">Mock mode is enabled. No card, money, or live Stripe account is used.</p>${session.status === "active" ? "<p>Payment already completed.</p>" : `<div class="actions"><form method="post" action="/mock-stripe/checkout/${sessionId}/complete"><button type="submit">Complete mock payment</button></form><form method="post" action="/mock-stripe/checkout/${sessionId}/cancel"><button class="secondary" type="submit">Cancel checkout</button></form></div>`}</section></main></body></html>`)
})

app.post("/mock-stripe/checkout/:sessionId/complete", async (req, res) => {
  if (!mockStripeMode) return res.status(404).send("Mock Stripe is disabled.")
  const session = db.prepare("SELECT stripe_session_id AS id FROM subscriptions WHERE stripe_session_id = ?").get(req.params.sessionId)
  if (!session) return res.status(404).send("Mock checkout session not found.")
  await deliverMockWebhook({ type: "checkout.session.completed", data: { object: { id: session.id, payment_intent: id("pi_mock"), subscription: id("sub_mock"), customer: id("cus_mock") } } })
  return res.redirect(303, `/subscription-scores?checkout=success&session_id=${encodeURIComponent(session.id)}`)
})

app.post("/mock-stripe/checkout/:sessionId/cancel", async (req, res) => {
  if (!mockStripeMode) return res.status(404).send("Mock Stripe is disabled.")
  const session = db.prepare("SELECT stripe_session_id AS id FROM subscriptions WHERE stripe_session_id = ?").get(req.params.sessionId)
  if (!session) return res.status(404).send("Mock checkout session not found.")
  await deliverMockWebhook({ type: "checkout.session.expired", data: { object: { id: session.id } } })
  return res.redirect(303, "/subscription-scores?checkout=cancelled")
})

app.get("/api/scores", requireRole("subscriber", "admin"), (req, res) => {
  const memberId = getTargetMember(req)
  if (!memberExists(memberId)) return res.status(404).json({ message: "That member could not be found." })
  return res.json({ member: memberId, scores: sortedScores(memberId) })
})

app.post("/api/scores", requireRole("subscriber", "admin"), (req, res) => {
  const memberId = getTargetMember(req)
  const error = scoreInput(req.body || {})
  if (error) return res.status(422).json({ message: error })
  if (!memberExists(memberId)) return res.status(404).json({ message: "That member could not be found." })
  const timestamp = now()
  try {
    db.prepare("INSERT INTO scores (id, member_id, date, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(id("score"), memberId, req.body.date, Number(req.body.value), timestamp, timestamp)
    pruneScores(memberId)
  } catch (insertError) {
    if (String(insertError.message).includes("UNIQUE")) return res.status(409).json({ message: "One score per date only. Edit the existing round instead." })
    throw insertError
  }
  return res.status(201).json({ member: memberId, scores: sortedScores(memberId) })
})

app.put("/api/scores/:id", requireRole("subscriber", "admin"), (req, res) => {
  const memberId = getTargetMember(req)
  const error = scoreInput(req.body || {})
  if (error) return res.status(422).json({ message: error })
  const score = db.prepare("SELECT id FROM scores WHERE id = ? AND member_id = ?").get(req.params.id, memberId)
  if (!score) return res.status(404).json({ message: "That score could not be found." })
  try {
    db.prepare("UPDATE scores SET date = ?, value = ?, updated_at = ? WHERE id = ? AND member_id = ?").run(req.body.date, Number(req.body.value), now(), req.params.id, memberId)
    pruneScores(memberId)
  } catch (updateError) {
    if (String(updateError.message).includes("UNIQUE")) return res.status(409).json({ message: "One score per date only. Choose a different round date." })
    throw updateError
  }
  return res.json({ member: memberId, scores: sortedScores(memberId) })
})

app.delete("/api/scores/:id", requireRole("subscriber", "admin"), (req, res) => {
  const memberId = getTargetMember(req)
  const result = db.prepare("DELETE FROM scores WHERE id = ? AND member_id = ?").run(req.params.id, memberId)
  if (!result.changes) return res.status(404).json({ message: "That score could not be found." })
  return res.json({ member: memberId, scores: sortedScores(memberId) })
})

app.get("/api/admin/members", requireRole("admin"), (_req, res) => {
  return res.json({ members: db.prepare("SELECT id, email, name, role, plan, charity, created_at AS createdAt FROM members ORDER BY created_at DESC").all() })
})

app.patch("/api/admin/members/:id", requireRole("admin"), (req, res) => {
  const member = db.prepare("SELECT id FROM members WHERE id = ?").get(req.params.id)
  if (!member) return res.status(404).json({ message: "That member could not be found." })
  const plan = req.body?.plan === null ? null : req.body?.plan
  if (plan !== null && !plans.has(plan)) return res.status(422).json({ message: "Plan must be monthly, yearly, or null." })
  const charity = plan === null ? null : req.body?.charity
  if (plan !== null && !charityExists(charity)) return res.status(422).json({ message: "Choose an active charity for an active subscription." })
  if (plan === null) {
    db.prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE member_id = ? AND status = 'active'").run(now(), req.params.id)
  } else {
    const selectedPlan = plans.get(plan)
    const active = db.prepare("SELECT id FROM subscriptions WHERE member_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1").get(req.params.id)
    if (active) db.prepare("UPDATE subscriptions SET plan = ?, charity = ?, amount_minor = ?, updated_at = ? WHERE id = ?").run(plan, charity, selectedPlan.amount * 100, now(), active.id)
    else db.prepare("INSERT INTO subscriptions (id, member_id, plan, charity, currency, amount_minor, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'INR', ?, 'active', ?, ?)").run(id("sub_admin"), req.params.id, plan, charity, selectedPlan.amount * 100, now(), now())
  }
  syncMemberStatus(req.params.id)
  return res.json({ member: db.prepare("SELECT id, email, name, role, plan, charity, created_at AS createdAt FROM members WHERE id = ?").get(req.params.id) })
})

app.get("/api/admin/subscriptions", requireRole("admin"), (_req, res) => {
  return res.json({ subscriptions: db.prepare("SELECT id, member_id AS memberId, plan, charity, currency, amount_minor AS amountMinor, status, stripe_session_id AS stripeSessionId, created_at AS createdAt, updated_at AS updatedAt FROM subscriptions ORDER BY created_at DESC").all() })
})

app.get("/api/charities", (_req, res) => {
  return res.json({ charities: db.prepare("SELECT id, name, category, note, description FROM charities WHERE active = 1 ORDER BY name").all() })
})

app.get("/api/admin/overview", requireRole("admin"), (_req, res) => {
  const counts = db.prepare(`SELECT
    (SELECT COUNT(*) FROM members) AS totalMembers,
    (SELECT COUNT(*) FROM members WHERE role = 'subscriber' AND plan IS NOT NULL) AS activeMembers,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') AS activeSubscriptions,
    (SELECT COUNT(*) FROM draws WHERE status = 'published') AS publishedDraws,
    (SELECT COUNT(*) FROM winners WHERE status = 'pending') AS pendingWinners,
    (SELECT COALESCE(MAX(pool_minor + jackpot_rollover_minor), 0) FROM draws WHERE status IN ('simulated', 'published', 'completed')) AS prizePoolMinor,
    (SELECT COALESCE(SUM(amount_minor * 10 / 100), 0) FROM subscriptions WHERE status = 'active') AS charityContributionMinor`).get()
  const charityTotals = db.prepare("SELECT charity, COALESCE(SUM(amount_minor * 10 / 100), 0) AS amountMinor FROM subscriptions WHERE status = 'active' GROUP BY charity ORDER BY amountMinor DESC").all()
  const latestDraw = db.prepare("SELECT * FROM draws ORDER BY created_at DESC LIMIT 1").get()
  return res.json({ ...counts, charityTotals, latestDraw: drawResponse(latestDraw) })
})

app.get("/api/admin/charities", requireRole("admin"), (_req, res) => {
  return res.json({ charities: db.prepare("SELECT id, name, category, note, description, active, created_at AS createdAt, updated_at AS updatedAt FROM charities ORDER BY active DESC, name").all() })
})

app.post("/api/admin/charities", requireRole("admin"), (req, res) => {
  const { name, category, note = "", description = "" } = req.body || {}
  if (!name || !category || !note) return res.status(422).json({ message: "Name, category, and note are required." })
  const timestamp = now()
  try {
    const charityId = id("charity")
    db.prepare("INSERT INTO charities (id, name, category, note, description, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)").run(charityId, String(name).trim(), String(category).trim(), String(note).trim(), String(description).trim(), timestamp, timestamp)
    return res.status(201).json({ charity: db.prepare("SELECT id, name, category, note, description, active FROM charities WHERE id = ?").get(charityId) })
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(409).json({ message: "That charity already exists." })
    throw error
  }
})

app.put("/api/admin/charities/:id", requireRole("admin"), (req, res) => {
  const { name, category, note, description, active } = req.body || {}
  const existing = db.prepare("SELECT id FROM charities WHERE id = ?").get(req.params.id)
  if (!existing) return res.status(404).json({ message: "That charity could not be found." })
  if (!name || !category || !note) return res.status(422).json({ message: "Name, category, and note are required." })
  try {
    db.prepare("UPDATE charities SET name = ?, category = ?, note = ?, description = ?, active = ?, updated_at = ? WHERE id = ?").run(String(name).trim(), String(category).trim(), String(note).trim(), String(description || "").trim(), active === false ? 0 : 1, now(), req.params.id)
    return res.json({ charity: db.prepare("SELECT id, name, category, note, description, active FROM charities WHERE id = ?").get(req.params.id) })
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(409).json({ message: "That charity already exists." })
    throw error
  }
})

app.delete("/api/admin/charities/:id", requireRole("admin"), (req, res) => {
  const result = db.prepare("UPDATE charities SET active = 0, updated_at = ? WHERE id = ?").run(now(), req.params.id)
  if (!result.changes) return res.status(404).json({ message: "That charity could not be found." })
  return res.json({ ok: true })
})

app.get("/api/admin/draws", requireRole("admin"), (_req, res) => {
  return res.json({ draws: db.prepare("SELECT * FROM draws ORDER BY month DESC, created_at DESC").all().map(drawResponse) })
})

app.post("/api/admin/draws", requireRole("admin"), (req, res) => {
  const { month, mode = "algorithmic", poolMinor = 4826000, seed = `${month || "draw"}-${Date.now()}` } = req.body || {}
  const numericPool = Number(poolMinor)
  if (!validDrawMonth(month)) return res.status(422).json({ message: "Month must use YYYY-MM format." })
  if (!['random', 'algorithmic'].includes(mode)) return res.status(422).json({ message: "Draw mode must be random or algorithmic." })
  if (!Number.isInteger(numericPool) || numericPool < 100) return res.status(422).json({ message: "Prize pool must be at least INR 1.00 in minor units." })
  const drawId = id("draw")
  db.prepare("INSERT INTO draws (id, month, mode, status, pool_minor, seed, created_at) VALUES (?, ?, ?, 'draft', ?, ?, ?)").run(drawId, month, mode, numericPool, String(seed), now())
  return res.status(201).json({ draw: drawResponse(getDraw(drawId)) })
})

app.get("/api/admin/draws/:id", requireRole("admin"), (req, res) => {
  const draw = getDraw(req.params.id)
  if (!draw) return res.status(404).json({ message: "That draw could not be found." })
  return res.json({ draw: drawResponse(draw) })
})

app.post("/api/admin/draws/:id/simulate", requireRole("admin"), (req, res) => {
  const draw = getDraw(req.params.id)
  if (!draw) return res.status(404).json({ message: "That draw could not be found." })
  if (draw.status === "published" || draw.status === "completed") return res.status(409).json({ message: "Published draws cannot be simulated again." })
  return res.json({ draw: saveSimulation(draw) })
})

app.post("/api/admin/draws/:id/publish", requireRole("admin"), (req, res) => {
  const draw = getDraw(req.params.id)
  if (!draw) return res.status(404).json({ message: "That draw could not be found." })
  try { return res.json({ draw: publishDraw(draw) }) } catch (error) { return res.status(error.statusCode || 500).json({ message: error.message || "Draw could not be published." }) }
})

app.get("/api/admin/winners", requireRole("admin"), (req, res) => {
  const workflow = winnerWorkflowResponse(req.query)
  return res.json({ winners: workflow.winners, metrics: workflow.metrics })
})

app.get("/api/admin/winner-workflow", requireRole("admin"), (req, res) => {
  return res.set("Cache-Control", "no-store").json(winnerWorkflowResponse(req.query))
})

app.get("/api/admin/winners/:id/events", requireRole("admin"), (req, res) => {
  const winner = winnerRecord(req.params.id)
  if (!winner) return res.status(404).json({ message: "That winner record could not be found." })
  const events = db.prepare("SELECT events.id, events.action, events.note, events.metadata_json AS metadataJson, events.created_at AS createdAt, members.name AS actorName, members.email AS actorEmail FROM winner_workflow_events events LEFT JOIN members ON members.id = events.actor_member_id WHERE events.winner_id = ? ORDER BY events.created_at DESC").all(req.params.id).map((event) => ({ id: event.id, action: event.action, note: event.note, metadata: parseJson(event.metadataJson, {}), createdAt: event.createdAt, actor: event.actorName ? { name: event.actorName, email: event.actorEmail } : null }))
  return res.json({ winner: winnerResponse(winner), events })
})

app.post("/api/winners/:id/proof", requireRole("subscriber", "admin"), (req, res) => {
  const winner = winnerRecord(req.params.id)
  if (!winner) return res.status(404).json({ message: "That winner record could not be found." })
  if (req.member.role !== "admin" && winner.memberId !== req.member.id) return res.status(403).json({ message: "You can only upload proof for your own winning entry." })
  if (winner.status === "paid") return res.status(409).json({ message: "Paid winner records cannot be changed." })
  const proofUrl = typeof req.body?.proofUrl === "string" ? req.body.proofUrl.trim() : ""
  let parsedUrl
  try { parsedUrl = new URL(proofUrl) } catch { parsedUrl = null }
  if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol) || proofUrl.length > 500) return res.status(422).json({ message: "A valid HTTPS or HTTP proof URL is required." })
  db.prepare("UPDATE winners SET proof_url = ?, status = 'pending', admin_note = NULL, verified_at = NULL, updated_at = ? WHERE id = ?").run(proofUrl, now(), req.params.id)
  const event = recordWinnerEvent(req.params.id, req.member.id, "proof_submitted", "Winner proof uploaded for review.", { proofUrl })
  return res.json({ winner: winnerResponse(winnerRecord(req.params.id)), event })
})

app.post("/api/admin/winners/:id/verify", requireRole("admin"), (req, res) => {
  const decision = req.body?.decision
  if (!['verified', 'rejected'].includes(decision)) return res.status(422).json({ message: "Decision must be verified or rejected." })
  const winner = winnerRecord(req.params.id)
  if (!winner) return res.status(404).json({ message: "That winner record could not be found." })
  if (winner.status === "paid") return res.status(409).json({ message: "Paid winner records cannot be reviewed again." })
  if (decision === "verified" && !winner.proofUrl) return res.status(409).json({ message: "Score proof must be uploaded before a winner can be verified." })
  const note = String(req.body?.note || "").trim()
  if (note.length > 1000) return res.status(422).json({ message: "Review notes must be 1,000 characters or fewer." })
  if (decision === "rejected" && note.length < 5) return res.status(422).json({ message: "Add a short reason when rejecting winner proof." })
  const reviewedAt = now()
  db.prepare("UPDATE winners SET status = ?, admin_note = ?, verified_at = ?, updated_at = ? WHERE id = ?").run(decision, note || null, reviewedAt, reviewedAt, req.params.id)
  const event = recordWinnerEvent(req.params.id, req.member.id, decision === "verified" ? "winner_verified" : "winner_rejected", note, { decision })
  return res.json({ winner: winnerResponse(winnerRecord(req.params.id)), event })
})

app.post("/api/admin/winners/:id/pay", requireRole("admin"), (req, res) => {
  const winner = winnerRecord(req.params.id)
  if (!winner) return res.status(404).json({ message: "That winner record could not be found." })
  if (winner.status !== "verified") return res.status(409).json({ message: "Only verified winners can be marked as paid." })
  const provider = String(req.body?.provider || "manual").trim().toLowerCase()
  if (!['manual', 'bank_transfer', 'stripe'].includes(provider)) return res.status(422).json({ message: "Payout provider must be manual, bank_transfer, or stripe." })
  const payoutReference = String(req.body?.payoutReference || `manual-${Date.now()}`).trim()
  if (!/^[a-zA-Z0-9._:-]{3,120}$/.test(payoutReference)) return res.status(422).json({ message: "Payout reference must be 3–120 letters, numbers, dots, underscores, colons, or hyphens." })
  const processedAt = now()
  try {
    db.exec("BEGIN")
    db.prepare("UPDATE winners SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?").run(processedAt, processedAt, req.params.id)
    db.prepare("INSERT INTO payouts (id, winner_id, amount_minor, currency, provider, reference, status, processed_by, processed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)").run(id("payout"), req.params.id, winner.prizeMinor, "INR", provider, payoutReference, req.member.id, processedAt, processedAt, processedAt)
    const event = recordWinnerEvent(req.params.id, req.member.id, "payout_completed", `Payout completed via ${provider}.`, { provider, payoutReference, amountMinor: Number(winner.prizeMinor) })
    db.exec("COMMIT")
    return res.json({ winner: winnerResponse(winnerRecord(req.params.id)), event })
  } catch (error) {
    db.exec("ROLLBACK")
    if (String(error.message).includes("UNIQUE")) return res.status(409).json({ message: "That payout reference or winner payout already exists." })
    throw error
  }
})

if (!existsSync(dist)) {
  app.get(/.*/, (_req, res) => res.status(503).json({ message: "Build the app first with npm run build." }))
} else {
  app.use(express.static(dist))
  app.get(/.*/, (_req, res) => res.sendFile(join(dist, "index.html")))
}

app.use((error, _req, res, _next) => {
  console.error(error)
  return res.status(500).json({ message: "Unexpected server error." })
})

app.listen(port, "0.0.0.0", () => console.log(`Digital Heroes Express server listening on 0.0.0.0:${port}`))
