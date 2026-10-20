/**
 * Report persistence for the community reporting API (Phase 5).
 *
 * Two backends, selected at startup:
 *   - MongoDB  when MONGODB_URI is set (persistent, shared across users)
 *   - in-memory when it is not (single-process; survives no restart)
 *
 * The active mode is reported honestly via `getStorageMode()` and surfaced in
 * every API response, so the frontend never claims reports are shared when
 * they are only held in a volatile process. No credentials are ever logged or
 * returned.
 */

import { observationLabel } from './validation.js'

export const STORAGE_MEMORY = 'memory'
export const STORAGE_MONGODB = 'mongodb'

const MAX_RECORDS_PER_QUERY = 200

let mode = STORAGE_MEMORY
let mongoCollection = null
let memoryRecords = []
let memoryIdCounter = 0

function generateId() {
  memoryIdCounter += 1
  return `rpt_${Date.now().toString(36)}_${memoryIdCounter}_${Math.random().toString(36).slice(2, 8)}`
}

/** Shape a validated payload into a stored report record. */
export function buildRecord(value, { source = 'web' } = {}) {
  return {
    location: value.location,
    type: value.type,
    typeLabel: observationLabel(value.type),
    description: value.description || '',
    latitude: value.latitude,
    longitude: value.longitude,
    observedAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    source,
    // Community reports are UNVERIFIED by default — there is no verification
    // process, so we never claim otherwise.
    verificationStatus: 'unverified',
  }
}

function serialize(record) {
  return {
    id: String(record._id ?? record.id),
    location: record.location,
    type: record.type,
    typeLabel: record.typeLabel ?? observationLabel(record.type),
    description: record.description ?? '',
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
    observedAt: record.observedAt,
    submittedAt: record.submittedAt ?? record.observedAt,
    source: record.source ?? 'web',
    verificationStatus: record.verificationStatus ?? 'unverified',
  }
}

// A coarse recent-duplicate guard: same location+type within this window.
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000

function isRecentDuplicate(records, value) {
  const cutoff = Date.now() - DUPLICATE_WINDOW_MS
  return records.some(
    (record) =>
      record.location === value.location &&
      record.type === value.type &&
      Date.parse(record.submittedAt ?? record.observedAt) >= cutoff,
  )
}

/**
 * Connect to MongoDB when a URI is provided. Returns the active mode.
 * Never throws for a missing URI — that is the supported offline demo path.
 */
export async function initStore({ uri } = {}) {
  if (!uri) {
    mode = STORAGE_MEMORY
    return { mode, persistent: false }
  }

  // Lazy import so the app runs even when mongoose is not installed and no
  // URI is configured.
  let mongoose
  try {
    ;({ default: mongoose } = await import('mongoose'))
  } catch {
    throw new Error('MONGODB_URI is set but the "mongoose" package is not installed. Run: npm install mongoose')
  }

  const schema = new mongoose.Schema(
    {
      location: { type: String, required: true },
      type: { type: String, required: true },
      typeLabel: String,
      description: { type: String, default: '' },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      observedAt: String,
      submittedAt: String,
      source: { type: String, default: 'web' },
      verificationStatus: { type: String, default: 'unverified' },
    },
    { timestamps: true },
  )

  mongoCollection = mongoose.models.RainReport ?? mongoose.model('RainReport', schema)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
  mode = STORAGE_MONGODB
  return { mode, persistent: true }
}

/** The active storage mode — surfaced in API responses. */
export function getStorageMode() {
  return mode
}

/**
 * Persist a validated report.
 * @returns {{ ok: true, record: object } | { ok: false, duplicate: true, record: object }}
 */
export async function saveReport(value, { source = 'web' } = {}) {
  if (mode === STORAGE_MONGODB) {
    const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
    const existing = await mongoCollection.findOne({
      location: value.location,
      type: value.type,
      submittedAt: { $gte: cutoff },
    })
    if (existing) return { ok: false, duplicate: true, record: serialize(existing) }

    const record = buildRecord(value, { source })
    const created = await mongoCollection.create(record)
    return { ok: true, record: serialize(created) }
  }

  if (isRecentDuplicate(memoryRecords, value)) {
    const duplicate = memoryRecords.find(
      (record) => record.location === value.location && record.type === value.type,
    )
    return { ok: false, duplicate: true, record: serialize(duplicate) }
  }

  const record = { id: generateId(), ...buildRecord(value, { source }) }
  memoryRecords = [record, ...memoryRecords]
  return { ok: true, record: serialize(record) }
}

/** List recent reports, newest first, optionally filtered by place/bbox. */
export async function listReports({ location = null, limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), MAX_RECORDS_PER_QUERY)

  if (mode === STORAGE_MONGODB) {
    const query = location ? { location: new RegExp(escapeRegExp(location), 'i') } : {}
    const docs = await mongoCollection.find(query).sort({ submittedAt: -1 }).limit(safeLimit).lean()
    return docs.map(serialize)
  }

  let records = memoryRecords
  if (location) {
    const needle = location.toLowerCase()
    records = records.filter((record) => record.location.toLowerCase().includes(needle))
  }
  return records.slice(0, safeLimit).map(serialize)
}

/** Fetch a single report by id. */
export async function getReport(id) {
  if (mode === STORAGE_MONGODB) {
    let doc
    try {
      doc = await mongoCollection.findById(id).lean()
    } catch {
      return null // malformed ObjectId etc.
    }
    return doc ? serialize(doc) : null
  }
  const found = memoryRecords.find((record) => record.id === id)
  return found ? serialize(found) : null
}

/** Test/debug helper: wipe in-memory records. */
export function _resetMemoryStore() {
  memoryRecords = []
  memoryIdCounter = 0
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
