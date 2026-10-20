/**
 * Community reporting API client (Phase 5).
 *
 * Talks to the optional Express backend at /api (proxied in dev, same-origin in
 * production). This module NEVER fabricates a success: if the backend is
 * unreachable it reports that honestly so the caller can fall back to the
 * clearly-labelled localStorage demo mode.
 *
 * Response contract from the server:
 *   { report, storage: 'mongodb' | 'memory', duplicate: boolean }
 */

const REPORTS_BASE = '/api'
const REQUEST_TIMEOUT_MS = 10000

export class ReportsApiError extends Error {
  constructor(message, { kind = 'network', status = null, errors = null } = {}) {
    super(message)
    this.name = 'ReportsApiError'
    this.kind = kind
    this.status = status
    this.errors = errors
  }
}

async function request(path, { method = 'GET', body = null, signal = null } = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  let response
  try {
    response = await fetch(`${REPORTS_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch {
    throw new ReportsApiError('Could not reach the community reporting service.', {
      kind: controller.signal.aborted ? 'timeout' : 'network',
    })
  } finally {
    clearTimeout(timeoutId)
    if (signal) signal.removeEventListener('abort', onAbort)
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ReportsApiError(payload?.message ?? `The reporting service responded with status ${response.status}.`, {
      kind: response.status === 400 ? 'validation' : 'http',
      status: response.status,
      errors: payload?.errors ?? null,
    })
  }

  return payload
}

/** Is the community backend currently reachable? */
export async function checkReportsApi({ signal = null } = {}) {
  try {
    const payload = await request('/health', { signal })
    return { available: Boolean(payload?.ok), storage: payload?.storage ?? null }
  } catch {
    return { available: false, storage: null }
  }
}

/**
 * Submit a report to the shared backend.
 * Throws ReportsApiError when the service is unreachable or rejects the data.
 */
export async function submitReport(payload, { signal = null } = {}) {
  const result = await request('/reports', { method: 'POST', body: payload, signal })
  return {
    report: result.report,
    duplicate: Boolean(result.duplicate),
    storage: result.storage ?? null,
  }
}

/** Fetch shared community reports. */
export async function fetchReports({ location = null, limit = 100, signal = null } = {}) {
  const params = new URLSearchParams()
  if (location) params.set('location', location)
  if (limit) params.set('limit', String(limit))
  const query = params.toString()
  const result = await request(`/reports${query ? `?${query}` : ''}`, { signal })
  return { reports: Array.isArray(result.reports) ? result.reports : [], storage: result.storage ?? null }
}
