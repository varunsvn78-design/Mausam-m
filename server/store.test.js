import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  STORAGE_MEMORY,
  _resetMemoryStore,
  buildRecord,
  getReport,
  getStorageMode,
  initStore,
  listReports,
  saveReport,
} from './store.js'

beforeEach(async () => {
  _resetMemoryStore()
  await initStore({})
})

test('defaults to in-memory storage when no URI is given', async () => {
  const { mode, persistent } = await initStore({})
  assert.equal(mode, STORAGE_MEMORY)
  assert.equal(persistent, false)
  assert.equal(getStorageMode(), STORAGE_MEMORY)
})

test('buildRecord marks reports unverified with the resolved label', () => {
  const record = buildRecord({ location: 'Pune', type: 'heavy-rain', description: '', latitude: null, longitude: null })
  assert.equal(record.verificationStatus, 'unverified')
  assert.equal(record.typeLabel, 'Heavy rain')
  assert.equal(record.source, 'web')
})

test('saveReport stores a record and listReports returns it newest-first', async () => {
  const first = await saveReport({ location: 'Pune', type: 'light-rain', description: '', latitude: null, longitude: null })
  assert.equal(first.ok, true)
  assert.equal(first.record.verificationStatus, 'unverified')
  assert.equal(first.record.id.startsWith('rpt_'), true)

  await saveReport({ location: 'Delhi', type: 'no-rain', description: '', latitude: null, longitude: null })
  const reports = await listReports()
  assert.equal(reports.length, 2)
  assert.equal(reports[0].location, 'Delhi')
})

test('saveReport flags a recent duplicate instead of storing twice', async () => {
  const draft = { location: 'Pune', type: 'heavy-rain', description: '', latitude: null, longitude: null }
  const first = await saveReport(draft)
  assert.equal(first.ok, true)
  const second = await saveReport(draft)
  assert.equal(second.ok, false)
  assert.equal(second.duplicate, true)
  assert.equal(second.record.id, first.record.id)
  assert.equal((await listReports()).length, 1)
})

test('listReports filters by location and respects the limit', async () => {
  await saveReport({ location: 'Pune', type: 'light-rain', description: '', latitude: null, longitude: null })
  await saveReport({ location: 'Pune', type: 'heavy-rain', description: '', latitude: null, longitude: null })
  await saveReport({ location: 'Delhi', type: 'no-rain', description: '', latitude: null, longitude: null })

  const filtered = await listReports({ location: 'pun' })
  assert.equal(filtered.length, 2)
  assert.ok(filtered.every((r) => r.location === 'Pune'))

  const limited = await listReports({ limit: 1 })
  assert.equal(limited.length, 1)
})

test('getReport returns a stored record by id and null for unknown ids', async () => {
  const saved = await saveReport({ location: 'Pune', type: 'other', description: '', latitude: null, longitude: null })
  const found = await getReport(saved.record.id)
  assert.equal(found.id, saved.record.id)
  assert.equal(await getReport('rpt_missing'), null)
})
