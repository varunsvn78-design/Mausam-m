/**
 * Community reporting API (Phase 5).
 *
 * Express app exporting the router so it can be mounted by the dev server and
 * exercised by tests without binding a port. Routes:
 *   GET  /api/health
 *   GET  /api/reports         (?location=&limit=)
 *   POST /api/reports
 *   GET  /api/reports/:id
 *
 * Every response includes `storage` so the client always knows whether reports
 * are persisted (MongoDB) or held only in this process (memory). No secrets or
 * database credentials are ever returned or logged.
 */

import express from 'express'
import { validateReportPayload } from './validation.js'
import { getReport, getStorageMode, listReports, saveReport } from './store.js'

const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 20

/** Tiny in-process rate limiter keyed by client IP (no external dependency). */
function createRateLimiter({ windowMs = RATE_LIMIT_WINDOW_MS, max = RATE_LIMIT_MAX } = {}) {
  const hits = new Map()
  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown'
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 })
      return next()
    }
    entry.count += 1
    if (entry.count > max) {
      return res.status(429).json({
        error: 'rate_limited',
        message: 'Too many reports submitted. Please wait a minute and try again.',
      })
    }
    return next()
  }
}

/** Wrap an async route so rejections become clean 500s instead of crashes. */
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

export function createApp() {
  const app = express()
  app.use(express.json({ limit: '16kb' }))

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, storage: getStorageMode(), time: new Date().toISOString() })
  })

  app.get(
    '/api/reports',
    asyncHandler(async (req, res) => {
      const location = typeof req.query.location === 'string' ? req.query.location.slice(0, 120) : null
      const limit = Number.parseInt(req.query.limit, 10)
      const reports = await listReports({ location, limit: Number.isFinite(limit) ? limit : 100 })
      res.json({ reports, storage: getStorageMode(), count: reports.length })
    }),
  )

  app.get(
    '/api/reports/:id',
    asyncHandler(async (req, res) => {
      const report = await getReport(req.params.id)
      if (!report) return res.status(404).json({ error: 'not_found', message: 'No report with that id.' })
      return res.json({ report, storage: getStorageMode() })
    }),
  )

  app.post(
    '/api/reports',
    createRateLimiter(),
    asyncHandler(async (req, res) => {
      const validation = validateReportPayload(req.body)
      if (!validation.valid) {
        return res.status(400).json({
          error: 'validation_failed',
          message: 'The report could not be accepted.',
          errors: validation.errors,
        })
      }

      const result = await saveReport(validation.value, { source: 'web' })
      if (!result.ok) {
        // Duplicate within the recent window: return the existing record with
        // 200 so the client can show it without creating a second copy.
        return res.status(200).json({
          report: result.record,
          storage: getStorageMode(),
          duplicate: true,
        })
      }

      return res.status(201).json({ report: result.record, storage: getStorageMode(), duplicate: false })
    }),
  )

  // Unknown API route
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Unknown API endpoint.' })
  })

  // Central error handler — never leak internal details.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(500).json({ error: 'server_error', message: 'The reporting service hit an error.' })
  })

  return app
}

export default createApp
