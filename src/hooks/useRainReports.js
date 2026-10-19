import { useCallback, useState } from 'react'
import { listReports, saveReport, clearReports } from '../services/reportStore.js'

/**
 * Local rain-check reports (Member 3).
 * All records live in this browser only — see reportStore.js.
 */
export function useRainReports() {
  const [reports, setReports] = useState(() => listReports())
  const [clearFailed, setClearFailed] = useState(false)

  const submit = useCallback((draft, options) => {
    const result = saveReport(draft, options)
    if (result.ok) {
      setReports(result.reports)
      setClearFailed(false)
    }
    return result
  }, [])

  const clear = useCallback(() => {
    const ok = clearReports()
    setClearFailed(!ok)
    if (ok) setReports([])
    return ok
  }, [])

  return { reports, submit, clear, clearFailed }
}
