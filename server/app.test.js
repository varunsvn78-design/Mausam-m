import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createApp } from './app.js'
import { _resetMemoryStore, initStore } from './store.js'

let server
let baseUrl

before(async () => {
  await initStore({})
  const app = createApp()
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  baseUrl = `http://127.0.0.1:${port}`
})

after(() => {
  server?.close()
})

beforeEach(() => {
  _resetMemoryStore()
})

test('GET /api/health reports ok and storage mode', async () => {
  const res = await fetch(`${baseUrl}/api/health`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.storage, 'memory')
})

test('POST /api/reports creates a report and labels it unverified', async () => {
  const res = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Pune', type: 'light-rain' }),
  })
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.equal(body.duplicate, false)
  assert.equal(body.storage, 'memory')
  assert.equal(body.report.verificationStatus, 'unverified')
  assert.equal(body.report.location, 'Pune')
})

test('POST /api/reports rejects invalid payloads with 400 and field errors', async () => {
  const res = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: '', type: 'bogus' }),
  })
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.error, 'validation_failed')
  assert.ok(body.errors.location)
  assert.ok(body.errors.type)
})

test('POST /api/reports returns 200 with duplicate flag on repeat submission', async () => {
  const payload = JSON.stringify({ location: 'Pune', type: 'heavy-rain' })
  const first = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  })
  const created = await first.json()
  const second = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  })
  assert.equal(second.status, 200)
  const body = await second.json()
  assert.equal(body.duplicate, true)
  assert.equal(body.report.id, created.report.id)
})

test('GET /api/reports lists stored reports with count and storage', async () => {
  await fetch(`${baseUrl}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Pune', type: 'light-rain' }),
  })
  const res = await fetch(`${baseUrl}/api/reports`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.count, 1)
  assert.equal(body.reports[0].location, 'Pune')
  assert.equal(body.storage, 'memory')
})

test('GET /api/reports/:id returns a report or a clean 404', async () => {
  const created = await (
    await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: 'Delhi', type: 'no-rain' }),
    })
  ).json()

  const ok = await fetch(`${baseUrl}/api/reports/${created.report.id}`)
  assert.equal(ok.status, 200)
  assert.equal((await ok.json()).report.id, created.report.id)

  const missing = await fetch(`${baseUrl}/api/reports/rpt_missing`)
  assert.equal(missing.status, 404)
  assert.equal((await missing.json()).error, 'not_found')
})

test('unknown API route returns a JSON 404', async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`)
  assert.equal(res.status, 404)
  assert.equal((await res.json()).error, 'not_found')
})
