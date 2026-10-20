import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportsApiError, checkReportsApi, fetchReports, submitReport } from './reportsClient.js'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkReportsApi', () => {
  it('reports availability and storage mode from /health', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: true, storage: 'mongodb' })))
    await expect(checkReportsApi()).resolves.toEqual({ available: true, storage: 'mongodb' })
  })

  it('reports unavailable when the request fails (never fabricates success)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down')
    }))
    await expect(checkReportsApi()).resolves.toEqual({ available: false, storage: null })
  })
})

describe('submitReport', () => {
  it('returns the created report and duplicate flag', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ report: { id: 'r1', location: 'Pune' }, storage: 'memory', duplicate: false }, { status: 201 }),
      ),
    )
    const result = await submitReport({ location: 'Pune', type: 'light-rain' })
    expect(result.report.id).toBe('r1')
    expect(result.duplicate).toBe(false)
    expect(result.storage).toBe('memory')
  })

  it('throws a validation ReportsApiError carrying field errors on 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { error: 'validation_failed', message: 'bad', errors: { location: 'required' } },
          { ok: false, status: 400 },
        ),
      ),
    )
    await expect(submitReport({})).rejects.toMatchObject({
      name: 'ReportsApiError',
      kind: 'validation',
      status: 400,
      errors: { location: 'required' },
    })
  })

  it('throws a network ReportsApiError when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline')
    }))
    const error = await submitReport({}).catch((e) => e)
    expect(error).toBeInstanceOf(ReportsApiError)
    expect(error.kind).toBe('network')
  })
})

describe('fetchReports', () => {
  it('returns an array of reports and storage mode', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ reports: [{ id: 'a' }], storage: 'memory' })))
    await expect(fetchReports()).resolves.toEqual({ reports: [{ id: 'a' }], storage: 'memory' })
  })

  it('tolerates a malformed reports payload by returning an empty array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ reports: null })))
    await expect(fetchReports()).resolves.toEqual({ reports: [], storage: null })
  })

  it('encodes the location filter into the query string', async () => {
    const spy = vi.fn(async () => jsonResponse({ reports: [] }))
    vi.stubGlobal('fetch', spy)
    await fetchReports({ location: 'New Delhi', limit: 5 })
    const calledUrl = spy.mock.calls[0][0]
    expect(calledUrl).toContain('location=New+Delhi')
    expect(calledUrl).toContain('limit=5')
  })
})
