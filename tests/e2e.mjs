import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { spawn } from "node:child_process"
import { createHmac } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const port = 8899
const baseUrl = `http://127.0.0.1:${port}`
const tempDir = mkdtempSync(join(tmpdir(), "digital-heroes-e2e-"))
const databasePath = join(tempDir, "e2e.sqlite")
const useMockStripe = process.env.E2E_STRIPE_MODE !== "live"
let server
let cookie = ""

function startServer() {
  server = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DH_DB_PATH: databasePath, PUBLIC_BASE_URL: baseUrl, NODE_ENV: "test", STRIPE_MOCK_MODE: useMockStripe ? "true" : "false", STRIPE_WEBHOOK_SECRET: useMockStripe ? "mock-webhook-secret" : (process.env.STRIPE_WEBHOOK_SECRET || ""), STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "" },
    stdio: ["ignore", "pipe", "pipe"],
  })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not start in time.")), 10000)
    const onOutput = (chunk) => {
      if (chunk.toString().includes("Digital Heroes Express server")) { clearTimeout(timer); resolve() }
    }
    server.stdout.on("data", onOutput)
    server.stderr.on("data", (chunk) => { if (chunk.toString().includes("Error")) process.stderr.write(chunk) })
    server.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited before startup: ${code}`)) })
  })
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server || server.exitCode !== null) return resolve()
    server.once("exit", resolve)
    server.kill("SIGTERM")
  })
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers)
  if (cookie) headers.set("Cookie", cookie)
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers })
  const setCookies = response.headers.getSetCookie?.() || []
  if (setCookies.length) cookie = setCookies[0].split(";", 1)[0]
  const text = await response.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { response, body }
}

async function jsonRequest(path, method, body) {
  return request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}

async function login(email, password) {
  const result = await jsonRequest("/api/auth/login", "POST", { email, password })
  assert.equal(result.response.status, 200)
  return result.body.member
}

async function run() {
  await startServer()

  let result = await request("/health")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.ok, true)
  assert.equal(result.body.service, "digital-heroes-api")
  assert.equal(typeof result.body.payments.provider, "string")
  assert.equal(typeof result.body.auth.googleConfigured, "boolean")
  assert.equal(typeof result.body.auth.githubConfigured, "boolean")
  result = await request("/api/auth/providers")
  assert.equal(result.response.status, 200)
  assert.equal(typeof result.body.google, "boolean")
  assert.equal(typeof result.body.github, "boolean")

  result = await request("/api/impact")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.featuredCharity.name, "The Good Grief Trust")
  assert.equal(typeof result.body.charityTotal, "number")
  assert.equal(typeof result.body.prizePoolMinor, "number")
  assert.ok(result.body.activeMembers > 0)
  assert.ok(result.body.prizePoolMinor > 0)
  assert.equal(result.body.pool.currency, "INR")
  assert.equal(result.body.pool.amountMinor, result.body.prizePoolMinor)
  assert.equal(result.body.plans.length, 2)
  assert.ok(result.body.charities.length >= 3)
  result = await request("/api/past-draws")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.total, 0)
  result = await request("/api/charity-impact")
  assert.equal(result.response.status, 200)
  assert.equal(typeof result.body.totalMinor, "number")
  result = await request("/api/help/articles")
  assert.equal(result.response.status, 200)
  assert.ok(result.body.articles.length >= 6)
  assert.ok(result.body.categories.includes("Membership"))
  result = await request("/api/help/articles?query=Stableford")
  assert.equal(result.response.status, 200)
  assert.ok(result.body.articles.some((article) => article.slug === "manage-scores"))
  result = await request("/api/help/articles/manage-scores")
  assert.equal(result.response.status, 200)
  assert.match(result.body.article.body, /five/i)
  result = await request("/api/help/articles/missing-article")
  assert.equal(result.response.status, 404)
  result = await request("/api/help/status")
  assert.equal(result.response.status, 200)
  assert.equal(typeof result.body.gemini.configured, "boolean")
  assert.ok(result.body.publicArticleCount >= 6)
  result = await jsonRequest("/api/help/chat", "POST", { message: "How do I manage my Stableford scores?", history: [] })
  assert.equal(result.response.status, 200)
  assert.ok(["gemini", "knowledge-base"].includes(result.body.source))
  assert.match(result.body.reply, /score|Stableford/i)
  result = await jsonRequest("/api/help/chat", "POST", { message: "", history: [] })
  assert.equal(result.response.status, 422)

  result = await jsonRequest("/api/subscribe", "POST", { name: "Landing Visitor", email: "landing@example.com", plan: "monthly", charity: "The Good Grief Trust", currency: "INR" })
  assert.equal(result.response.status, 201)
  assert.equal(result.body.plan, "monthly")
  result = await jsonRequest("/api/subscribe", "POST", { name: "Landing Visitor", email: "landing@example.com", plan: "weekly", charity: "The Good Grief Trust", currency: "INR" })
  assert.equal(result.response.status, 422)

  result = await request("/api/scores")
  assert.equal(result.response.status, 401)
  result = await request("/api/member/content")
  assert.equal(result.response.status, 401)
  result = await request("/api/member/dashboard")
  assert.equal(result.response.status, 401)

  result = await jsonRequest("/api/auth/login", "POST", { email: "member@digitalheroes.local", password: "wrong" })
  assert.equal(result.response.status, 401)

  const member = await login("member@digitalheroes.local", "demo-subscriber")
  assert.equal(member.role, "subscriber")
  result = await request("/api/auth/session")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.member.id, "demo")
  result = await request("/api/member/subscription")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.subscription.status, "active")
  assert.equal(result.body.member.plan, "monthly")
  result = await request("/api/member/dashboard")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.member.id, "demo")
  assert.equal(result.body.plan.key, "monthly")
  assert.ok(result.body.perks.includes("Monthly draw entry"))
  assert.equal(result.body.scores.length, 3)
  assert.deepEqual(result.body.rewardSummary, { totalMinor: 0, paidMinor: 0, outstandingMinor: 0, count: 0 })

  result = await request("/api/scores")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.scores.length, 3)
  const originalOldestScoreId = result.body.scores.at(-1).id

  result = await jsonRequest("/api/scores", "POST", { date: "2026-03-21", value: 42 })
  assert.equal(result.response.status, 201)
  const createdScore = result.body.scores.find((score) => score.date === "2026-03-21")
  assert.ok(createdScore)

  result = await jsonRequest("/api/scores", "POST", { date: "2026-03-21", value: 43 })
  assert.equal(result.response.status, 409)
  result = await jsonRequest("/api/scores", "POST", { date: "2026-03-22", value: 46 })
  assert.equal(result.response.status, 422)
  result = await jsonRequest("/api/scores", "POST", { date: "2026-02-31", value: 40 })
  assert.equal(result.response.status, 422)
  result = await jsonRequest("/api/scores", "POST", { date: "2099-01-01", value: 40 })
  assert.equal(result.response.status, 422)

  result = await jsonRequest(`/api/scores/${createdScore.id}`, "PUT", { date: "2026-03-22", value: 44 })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.scores.find((score) => score.id === createdScore.id).value, 44)

  for (const [index, date] of ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27"].entries()) {
    result = await jsonRequest("/api/scores", "POST", { date, value: 30 + index })
    assert.equal(result.response.status, 201)
  }
  result = await request("/api/scores")
  assert.equal(result.body.scores.length, 5)
  assert.equal(result.body.scores[0].date, "2026-03-27")
  const visibleScoreId = result.body.scores[0].id
  result = await request(`/api/scores/${originalOldestScoreId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: "2026-03-28", value: 45 }) })
  assert.equal(result.response.status, 404)
  result = await request(`/api/scores/${visibleScoreId}`, { method: "DELETE" })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.scores.length, 4)
  assert.ok(!result.body.scores.some((score) => score.id === visibleScoreId))
  result = await jsonRequest("/api/scores", "POST", { date: "2026-03-28", value: 45 })
  assert.equal(result.response.status, 201)
  assert.equal(result.body.scores.length, 5)

  result = await request("/api/admin/members")
  assert.equal(result.response.status, 403)
  result = await jsonRequest("/api/auth/logout", "POST", {})
  assert.equal(result.response.status, 200)
  result = await request("/api/scores")
  assert.equal(result.response.status, 401)

  for (const index of [1, 2, 3, 4, 5]) {
    result = await jsonRequest("/api/auth/login", "POST", { email: `admin-0${index}@digitalheroes.local`, password: `DH-Admin-0${index}!Test` })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.member.id, `admin_demo_0${index}`)
    assert.equal(result.body.member.role, "admin")
    await jsonRequest("/api/auth/logout", "POST", {})
  }

  const admin = await login("admin@digitalheroes.local", "demo-admin")
  assert.equal(admin.role, "admin")
  result = await request("/api/admin/content")
  assert.equal(result.response.status, 200)
  assert.ok(result.body.articles.length >= 6)
  const contentSlug = `e2e-content-${Date.now()}`
  result = await jsonRequest("/api/admin/content", "POST", { slug: contentSlug, category: "E2E", title: "E2E content update", excerpt: "A temporary content record.", body: "This content is used to verify the publishing workflow.", tags: ["e2e", "studio"], audience: "members", active: false })
  assert.equal(result.response.status, 201)
  assert.equal(result.body.article.active, false)
  const contentId = result.body.article.id
  result = await jsonRequest(`/api/admin/content/${contentId}`, "PATCH", { slug: contentSlug, category: "E2E", title: "E2E content update", excerpt: "A temporary content record.", body: "The content editor can update this record.", tags: ["e2e", "updated"], active: false })
  assert.equal(result.response.status, 200)
  assert.deepEqual(result.body.article.tags, ["e2e", "updated"])
  result = await request(`/api/admin/content/${contentId}/publish`, { method: "POST" })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.article.active, true)
  assert.equal(result.body.article.audience, "members")
  result = await request(`/api/help/articles/${contentSlug}`)
  assert.equal(result.response.status, 404)
  result = await request(`/api/admin/content/${contentId}/unpublish`, { method: "POST" })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.article.active, false)
  result = await request(`/api/help/articles/${contentSlug}`)
  assert.equal(result.response.status, 404)
  result = await request(`/api/admin/content/${contentId}/publish`, { method: "POST" })
  assert.equal(result.response.status, 200)
  result = await request("/api/admin/members")
  assert.equal(result.response.status, 200)
  assert.ok(result.body.members.some((item) => item.id === "demo"))
  result = await jsonRequest("/api/admin/members/demo", "PATCH", { plan: null, charity: null })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.member.plan, null)
  result = await jsonRequest("/api/admin/members/demo", "PATCH", { plan: "monthly", charity: "The Good Grief Trust" })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.member.plan, "monthly")
  result = await request("/api/admin/subscriptions")
  assert.equal(result.response.status, 200)
  result = await request("/api/scores?member=demo")
  assert.equal(result.response.status, 200)

  result = await request("/api/admin/overview")
  assert.equal(result.response.status, 200)
  assert.ok(result.body.totalMembers >= 2)
  result = await request("/api/admin/charities")
  assert.equal(result.response.status, 200)
  result = await jsonRequest("/api/admin/charities", "POST", { name: "E2E Relief Fund", category: "Community", note: "A test cause for the control room." })
  assert.equal(result.response.status, 201)
  const testCharityId = result.body.charity.id
  result = await jsonRequest(`/api/admin/charities/${testCharityId}`, "PUT", { name: "E2E Relief Fund", category: "Community", note: "Updated test cause.", active: true })
  assert.equal(result.response.status, 200)
  result = await request(`/api/admin/charities/${testCharityId}`, { method: "DELETE" })
  assert.equal(result.response.status, 200)

  let publishedDraw = null
  for (let attempt = 0; attempt < 120 && !publishedDraw; attempt += 1) {
    result = await jsonRequest("/api/admin/draws", "POST", { month: "2026-11", mode: "algorithmic", poolMinor: 4826000, seed: `e2e-frequency-${attempt}` })
    assert.equal(result.response.status, 201)
    const drawId = result.body.draw.id
    result = await request(`/api/admin/draws/${drawId}/simulate`, { method: "POST" })
    assert.equal(result.response.status, 200)
    assert.equal(result.body.draw.status, "simulated")
    assert.equal(result.body.draw.winningNumbers.length, 5)
    assert.equal(Object.keys(result.body.draw.frequency).length, 45)
    if (result.body.draw.result.winners.length) publishedDraw = result.body.draw
  }
  assert.ok(publishedDraw, "A deterministic winner should be found during simulation coverage.")
  result = await request(`/api/admin/draws/${publishedDraw.id}/publish`, { method: "POST" })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.draw.status, "published")
  result = await request("/api/past-draws")
  assert.equal(result.response.status, 200)
  assert.ok(result.body.draws.some((draw) => draw.id === publishedDraw.id))
  const publicDraw = result.body.draws.find((draw) => draw.id === publishedDraw.id)
  assert.deepEqual(publicDraw.winningNumbers, publishedDraw.winningNumbers)
  assert.equal(publicDraw.status, "published")
  result = await request(`/api/past-draws/${publishedDraw.id}`)
  assert.equal(result.response.status, 200)
  assert.ok(result.body.draw.tiers.length >= 1)
  result = await request(`/api/past-draws?query=${publishedDraw.winningNumbers[0]}`)
  assert.ok(result.body.draws.some((draw) => draw.id === publishedDraw.id))
  result = await request(`/api/past-draws?month=${publishedDraw.month}`)
  assert.ok(result.body.draws.some((draw) => draw.id === publishedDraw.id))
  result = await request("/api/past-draws/draw_missing")
  assert.equal(result.response.status, 404)
  result = await request("/api/admin/winners")
  assert.equal(result.response.status, 200)
  assert.ok(result.body.winners.length > 0)
  const winnerRecord = result.body.winners.find((winner) => winner.drawId === publishedDraw.id)
  assert.ok(winnerRecord)
  result = await jsonRequest(`/api/admin/winners/${winnerRecord.id}/verify`, "POST", { decision: "verified", note: "Should require evidence." })
  assert.equal(result.response.status, 409)
  result = await jsonRequest(`/api/winners/${winnerRecord.id}/proof`, "POST", { proofUrl: "ftp://example.com/score-proof.png" })
  assert.equal(result.response.status, 422)
  result = await jsonRequest(`/api/winners/${winnerRecord.id}/proof`, "POST", { proofUrl: "https://example.com/e2e-score-proof.png" })
  assert.equal(result.response.status, 200)
  result = await request(`/api/admin/winners/${winnerRecord.id}/events`)
  assert.equal(result.response.status, 200)
  assert.ok(result.body.events.some((event) => event.action === "proof_submitted"))
  result = await jsonRequest(`/api/admin/winners/${winnerRecord.id}/verify`, "POST", { decision: "verified", note: "E2E proof reviewed." })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.winner.status, "verified")
  const payoutReference = `e2e-${winnerRecord.id.slice(-8)}`
  result = await jsonRequest(`/api/admin/winners/${winnerRecord.id}/pay`, "POST", { provider: "bank_transfer", payoutReference })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.winner.status, "paid")
  assert.equal(result.body.winner.payout.reference, payoutReference)
  result = await request("/api/admin/winner-workflow?status=paid")
  assert.equal(result.response.status, 200)
  assert.ok(result.body.metrics.paid >= 1)
  assert.ok(["MongoDB Atlas Data API", "MongoDB native driver", "not configured"].includes(result.body.storage.provider))

  result = await jsonRequest("/api/checkout/session", "POST", { name: "Checkout Tester", email: "checkout@example.com", plan: "monthly", charity: "The Good Grief Trust", currency: "GBP" })
  assert.equal(result.response.status, 422)
  result = await request("/api/checkout/session/status")
  assert.equal(result.response.status, 422)
  result = await request("/api/checkout/session/status?session_id=cs_missing")
  assert.equal(result.response.status, 404)
  result = await jsonRequest("/api/checkout/razorpay/verify", "POST", { razorpay_order_id: "order_missing", razorpay_payment_id: "pay_missing", razorpay_signature: "invalid" })
  assert.equal(result.response.status, 400)
  result = await jsonRequest("/api/checkout/session", "POST", { name: "Checkout Tester", email: "checkout@example.com", plan: "monthly", charity: "The Good Grief Trust", currency: "INR" })
  if (useMockStripe) {
    assert.equal(result.response.status, 201)
    assert.match(result.body.checkoutUrl, new RegExp(`${baseUrl}/mock-stripe/checkout/`))
    const mockCheckout = await request(new URL(result.body.checkoutUrl).pathname)
    assert.equal(mockCheckout.response.status, 200)
    assert.match(mockCheckout.body, /Mock Stripe/)
    result = await request(`/mock-stripe/checkout/${result.body.id}/complete`, { method: "POST", redirect: "manual" })
    assert.equal(result.response.status, 303)
    assert.match(result.response.headers.get("location"), /checkout=success/)
    result = await request(`/api/checkout/session/status?session_id=${encodeURIComponent(new URL(result.response.headers.get("location"), baseUrl).searchParams.get("session_id"))}`)
    assert.equal(result.response.status, 200)
    assert.equal(result.body.status, "active")
    result = await request("/api/admin/subscriptions")
    assert.ok(result.body.subscriptions.some((subscription) => subscription.status === "active"))

    result = await jsonRequest("/api/checkout/session", "POST", { name: "Cancel Tester", email: "cancel@example.com", plan: "yearly", charity: "Clean Air Fund", currency: "INR" })
    assert.equal(result.response.status, 201)
    const cancelledSessionId = result.body.id
    result = await request(`/mock-stripe/checkout/${cancelledSessionId}/cancel`, { method: "POST", redirect: "manual" })
    assert.equal(result.response.status, 303)
    result = await request(`/api/checkout/session/status?session_id=${encodeURIComponent(cancelledSessionId)}`)
    assert.equal(result.response.status, 200)
    assert.equal(result.body.status, "expired")
  } else if (process.env.STRIPE_SECRET_KEY) {
    assert.equal(result.response.status, 201)
    assert.match(result.body.checkoutUrl, /^https:\/\/checkout\.stripe\.com\//)
    const payload = JSON.stringify({ id: "evt_e2e", type: "checkout.session.completed", data: { object: { id: result.body.id, payment_intent: "pi_e2e", subscription: "sub_e2e", customer: "cus_e2e" } } })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET || "missing").update(`${timestamp}.${payload}`).digest("hex")
    result = await request("/api/stripe/webhook", { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": `t=${timestamp},v1=${signature}` }, body: payload })
    assert.equal(result.response.status, 200)
  } else {
    assert.equal(result.response.status, 503)
  }

  await jsonRequest("/api/auth/logout", "POST", {})
  await login("member@digitalheroes.local", "demo-subscriber")
  result = await request("/api/member/content")
  assert.equal(result.response.status, 200)
  assert.ok(result.body.articles.some((article) => article.slug === contentSlug && article.audience === "members"))
  result = await request("/api/member/subscription")
  assert.equal(result.body.subscription.status, "active")
  result = await request("/api/member/dashboard")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.drawEntries.length, 1)
  assert.ok(result.body.rewards.length > 0)
  assert.ok(result.body.rewardSummary.totalMinor > 0)
  assert.equal(result.body.rewards[0].status, "paid")
  result = await request("/api/member/subscription/cancel", { method: "POST" })
  assert.equal(result.response.status, 200)
  assert.equal(result.body.subscription.status, "cancelled")
  assert.equal(result.body.member.plan, null)
  result = await request("/api/member/dashboard")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.plan, null)
  assert.equal(result.body.perks.length, 0)
  result = await request("/api/auth/session")
  assert.equal(result.body.member.plan, null)

  result = await request("/api/stripe/webhook", { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=invalid" }, body: "{}" })
  assert.equal(result.response.status, 400)

  await stopServer()
  await startServer()
  result = await request("/api/auth/session")
  assert.equal(result.response.status, 200)
  result = await request("/api/scores?member=demo")
  assert.equal(result.response.status, 200)
  assert.equal(result.body.scores.length, 5)
  await stopServer()
  console.log(`E2E passed: auth, roles, score CRUD, rolling window, persistence, admin charities, draw simulation/publication, winner verification/payout, checkout validation, and webhook validation${useMockStripe ? ", plus mock Stripe checkout completion and cancellation" : process.env.STRIPE_SECRET_KEY ? ", plus Stripe session/webhook integration" : ". Stripe live calls skipped because STRIPE_SECRET_KEY is not configured"}.`)
}

run().catch(async (error) => {
  console.error(error.stack || error)
  await stopServer()
  process.exitCode = 1
}).finally(() => {
  rmSync(tempDir, { recursive: true, force: true })
})
