import { useCallback, useEffect, useRef, useState } from 'react'
import { listReports, saveReport, clearReports } from '../services/reportStore.js'
import { checkReportsApi, fetchReports, submitReport } from '../services/reportsClient.js'

/**
 * Rain-check reports (Member 3, upgraded in Phase 5).
 *
 * Two clearly-separated modes:
 *   - 'shared'  — the community backend accepted the report (either persistent
 *                 MongoDB or server-memory, distinguished by `storage`).
 *   - 'local'   — the backend is unavailable; the report is stored only in this
 *                 browser and is NEVER presented as shared.
 *
 * Reports are never silently uploaded, and old local demo records are never
 * auto-pushed to the server.
 */

const API_STATUS = Object.freeze({
  CHECKING: 'checking',
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
})

export function useRainReports({ isOnline = true } = {}) {
  const [reports, setReports] = useState(() => listReports())
  const [clearFailed, setClearFailed] = useState(false)
  const [apiStatus, setApiStatus] = useState(API_STATUS.CHECKING)
  const [storageMode, setStorageMode] = useState(null)
  const [sharedReports, setSharedReports] = useState([])
  const sharedAbortRef = useRef(null)

  // Probe the backend once on mount (and whenever connectivity returns).
  useEffect(() => {
    let cancelled = false
    if (!isOnline) {
      setApiStatus(API_STATUS.UNAVAILABLE)
      return undefined
    }

    setApiStatus(API_STATUS.CHECKING)
    checkReportsApi().then((result) => {
      if (cancelled) return
      setApiStatus(result.available ? API_STATUS.AVAILABLE : API_STATUS.UNAVAILABLE)
      setStorageMode(result.storage)
    })

    return () => {
      cancelled = true
    }
  }, [isOnline])

  const loadShared = useCallback(async ({ location = null } = {}) => {
    sharedAbortRef.current?.abort()
    const controller = new AbortController()
    sharedAbortRef.current = controller
    try {
      const { reports: list, storage } = await fetchReports({ location, signal: controller.signal })
      setSharedReports(list)
      setStorageMode(storage)
      setApiStatus(API_STATUS.AVAILABLE)
      return { ok: true, reports: list }
    } catch {
      setApiStatus(API_STATUS.UNAVAILABLE)
      return { ok: false, reports: [] }
    }
  }, [])

  const submit = useCallback(
    async (draft, coordinates = null) => {
      const payload = {
        location: (draft.location ?? '').trim(),
        type: draft.type,
        description: (draft.description ?? '').trim(),
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
      }

      // Try the shared backend first when we believe it is reachable.
      if (isOnline && apiStatus !== API_STATUS.UNAVAILABLE) {
        try {
          const result = await submitReport(payload)
          setApiStatus(API_STATUS.AVAILABLE)
          setStorageMode(result.storage)
          setSharedReports((current) => {
            if (result.duplicate) return current
            return [result.report, ...current]
          })
          return {
            ok: true,
            mode: 'shared',
            storage: result.storage,
            duplicate: result.duplicate,
            report: result.report,
          }
        } catch (error) {
          // Validation failures are the user's to fix — do not fall back.
          if (error?.kind === 'validation') {
            return { ok: false, mode: 'shared', error: 'invalid', fieldErrors: error.errors ?? null }
          }
          // Otherwise the backend is unreachable: mark it and fall back to local.
          setApiStatus(API_STATUS.UNAVAILABLE)
        }
      }

      // Local-only fallback (clearly labelled in the UI).
      const result = saveReport({ ...draft, latitude: payload.latitude, longitude: payload.longitude })
      if (result.ok) {
        setReports(result.reports)
        setClearFailed(false)
        return { ok: true, mode: 'local', truncated: result.truncated, report: result.report }
      }
      return { ok: false, mode: 'local', error: result.error, fieldErrors: result.errors ?? null }
    },
    [apiStatus, isOnline],
  )

  const clear = useCallback(() => {
    const ok = clearReports()
    setClearFailed(!ok)
    if (ok) setReports([])
    return ok
  }, [])

  return {
    reports,
    sharedReports,
    submit,
    clear,
    clearFailed,
    loadShared,
    apiStatus,
    storageMode,
    apiAvailable: apiStatus === API_STATUS.AVAILABLE,
  }
}
