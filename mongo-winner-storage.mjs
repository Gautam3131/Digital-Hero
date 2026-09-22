import { MongoClient } from "mongodb"

const dataApiUrl = (process.env.MONGODB_DATA_API_URL || "").replace(/\/$/, "")
const dataApiKey = process.env.MONGODB_DATA_API_KEY || ""
const mongoUri = process.env.MONGODB_URI || ""
const dataSource = process.env.MONGODB_DATA_SOURCE || "Cluster0"
const database = process.env.MONGODB_DATABASE || "digital_heroes"
const collection = process.env.MONGODB_WINNER_COLLECTION || "winner_workflows"
let nativeDatabasePromise

const snapshotTables = [
  { name: "members", key: (row) => row.id },
  { name: "subscriptions", key: (row) => row.id },
  { name: "scores", key: (row) => row.id },
  { name: "charities", key: (row) => row.id },
  { name: "draws", key: (row) => row.id },
  { name: "draw_entries", key: (row) => `${row.draw_id}:${row.member_id}` },
  { name: "winners", key: (row) => row.id },
  { name: "payouts", key: (row) => row.id },
  { name: "winner_workflow_events", key: (row) => row.id },
  { name: "help_articles", key: (row) => row.id },
]

export const mongoWinnerStorage = {
  configured: Boolean((dataApiUrl && dataApiKey) || mongoUri),
  connected: false,
  provider: mongoUri ? "MongoDB native driver" : dataApiUrl && dataApiKey ? "MongoDB Atlas Data API" : "not configured",
  database,
  collection,
  lastSyncAt: null,
  lastError: null,
}

export function mongoStatus() {
  return {
    configured: mongoWinnerStorage.configured,
    connected: mongoWinnerStorage.connected,
    provider: mongoWinnerStorage.provider,
    database: mongoWinnerStorage.database,
    lastSyncAt: mongoWinnerStorage.lastSyncAt,
    error: mongoWinnerStorage.lastError,
  }
}

async function nativeDatabase() {
  if (!mongoUri) return null
  if (!nativeDatabasePromise) {
    nativeDatabasePromise = (async () => {
      const client = new MongoClient(mongoUri, { connectTimeoutMS: 5000, serverSelectionTimeoutMS: 5000 })
      await client.connect()
      const connectedDatabase = client.db(database)
      await connectedDatabase.command({ ping: 1 })
      mongoWinnerStorage.connected = true
      mongoWinnerStorage.lastError = null
      return connectedDatabase
    })().catch((error) => {
      nativeDatabasePromise = null
      mongoWinnerStorage.connected = false
      mongoWinnerStorage.lastError = error.message
      throw error
    })
  }
  return nativeDatabasePromise
}

async function request(action, body) {
  const response = await fetch(`${dataApiUrl}/action/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": dataApiKey },
    body: JSON.stringify({ dataSource, database, collection, ...body }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `MongoDB Data API returned ${response.status}.`)
  mongoWinnerStorage.connected = true
  mongoWinnerStorage.lastError = null
  return data
}

export async function syncSqliteSnapshot(sqliteDb) {
  const connectedDatabase = await nativeDatabase()
  const useDataApi = Boolean(dataApiUrl && dataApiKey)
  if (!connectedDatabase && !useDataApi) return { stored: false, reason: "MongoDB is not configured." }
  let rowCount = 0
  for (const table of snapshotTables) {
    const rows = sqliteDb.prepare(`SELECT * FROM ${table.name}`).all()
    if (!rows.length) continue
    if (connectedDatabase) {
      await connectedDatabase.collection(table.name).bulkWrite(rows.map((row) => ({
        replaceOne: {
          filter: { _id: String(table.key(row)) },
          replacement: { ...row, _id: String(table.key(row)), mirroredAt: new Date() },
          upsert: true,
        },
      })), { ordered: false })
    } else {
      for (const row of rows) {
        const document = { ...row, _id: String(table.key(row)), mirroredAt: new Date().toISOString() }
        await request("updateOne", { collection: table.name, filter: { _id: document._id }, update: { $set: document }, upsert: true })
      }
    }
    rowCount += rows.length
  }
  const syncedAt = new Date().toISOString()
  if (connectedDatabase) await connectedDatabase.collection("_sync_metadata").updateOne({ _id: "sqlite" }, { $set: { syncedAt, rowCount } }, { upsert: true })
  else await request("updateOne", { collection: "_sync_metadata", filter: { _id: "sqlite" }, update: { $set: { syncedAt, rowCount } }, upsert: true })
  mongoWinnerStorage.lastSyncAt = syncedAt
  return { stored: true, rowCount, syncedAt }
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
      const connectedDatabase = await nativeDatabase()
      await connectedDatabase.collection(collection).updateOne({ winnerId: winner.id }, { $set: document, $push: { events: event } }, { upsert: true })
    }
    return { stored: true }
  } catch (error) {
    console.error(`MongoDB winner mirror failed for ${winner.id}: ${error.message}`)
    return { stored: false, reason: error.message }
  }
}
