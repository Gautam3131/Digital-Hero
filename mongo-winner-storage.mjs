const dataApiUrl = (process.env.MONGODB_DATA_API_URL || "").replace(/\/$/, "")
const dataApiKey = process.env.MONGODB_DATA_API_KEY || ""
const mongoUri = process.env.MONGODB_URI || ""
const dataSource = process.env.MONGODB_DATA_SOURCE || "Cluster0"
const database = process.env.MONGODB_DATABASE || "digital_heroes"
const collection = process.env.MONGODB_WINNER_COLLECTION || "winner_workflows"
let nativeClientPromise

export const mongoWinnerStorage = {
  configured: Boolean((dataApiUrl && dataApiKey) || mongoUri),
  provider: mongoUri ? "MongoDB native driver" : dataApiUrl && dataApiKey ? "MongoDB Atlas Data API" : "not configured",
  database,
  collection,
}

async function request(action, body) {
  const response = await fetch(`${dataApiUrl}/action/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": dataApiKey },
    body: JSON.stringify({ dataSource, database, collection, ...body }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `MongoDB Data API returned ${response.status}.`)
  return data
}

export async function mirrorWinnerWorkflow({ winner, event, payout = null }) {
  if (!mongoWinnerStorage.configured) return { stored: false, reason: "MongoDB is not configured." }
  const document = {
    winnerId: winner.id,
    drawId: winner.drawId || winner.draw_id,
    memberId: winner.memberId || winner.member_id,
    memberName: winner.name,
    memberEmail: winner.email,
    month: winner.month,
    matchType: winner.matchType || winner.match_type,
    matchedCount: Number(winner.matchedCount || winner.matched_count || 0),
    prizeMinor: Number(winner.prizeMinor || winner.prize_minor || 0),
    status: winner.status,
    proofUrl: winner.proofUrl || winner.proof_url || null,
    adminNote: winner.adminNote || winner.admin_note || null,
    verifiedAt: winner.verifiedAt || winner.verified_at || null,
    paidAt: winner.paidAt || winner.paid_at || null,
    payout,
    updatedAt: event.createdAt,
  }
  try {
    if (dataApiUrl && dataApiKey) {
      await request("updateOne", { filter: { winnerId: winner.id }, update: { $set: document, $push: { events: event } }, upsert: true })
    } else {
      const { MongoClient } = await import("mongodb")
      if (!nativeClientPromise) {
        const client = new MongoClient(mongoUri)
        nativeClientPromise = client.connect().then(() => client)
      }
      const client = await nativeClientPromise
      await client.db(database).collection(collection).updateOne({ winnerId: winner.id }, { $set: document, $push: { events: event } }, { upsert: true })
    }
    return { stored: true }
  } catch (error) {
    console.error(`MongoDB winner mirror failed for ${winner.id}: ${error.message}`)
    return { stored: false, reason: error.message }
  }
}
