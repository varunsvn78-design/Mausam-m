import { useCallback, useEffect, useRef, useState } from 'react'
import { MIN_QUERY_LENGTH, searchLocations } from '../services/geocodingService.js'
import { isAbortError } from '../services/httpClient.js'

const DEBOUNCE_MS = 350

/**
 * Debounced, cancellable city/town search for the location picker.
 *
 * Guarantees:
 *  - typing fast does not fire one request per keystroke (350 ms debounce)
 *  - a new search / unmount aborts the previous request (AbortController)
 *  - repeated identical queries are served from the service-level cache
 *  - `status` is one of: 'idle' | 'loading' | 'success' | 'empty' | 'error'
 */
export function useLocationSearch({ debounceMs = DEBOUNCE_MS, limit } = {}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const abortRef = useRef(null)
  const requestIdRef = useRef(0)

  const runSearch = useCallback(
    async (term) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const requestId = ++requestIdRef.current

      setStatus('loading')
      setError(null)

      try {
        const locations = await searchLocations(term, { signal: controller.signal, count: limit })
        if (requestId !== requestIdRef.current) return // a newer search superseded this one
        setResults(locations)
        setStatus(locations.length > 0 ? 'success' : 'empty')
      } catch (err) {
        if (isAbortError(err) || requestId !== requestIdRef.current) return
        setResults([])
        setError(err)
        setStatus('error')
      }
    },
    [limit],
  )

  useEffect(() => {
    const trimmed = query.trim()

    if (trimmed.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort()
      setResults([])
      setError(null)
      setStatus('idle')
      return undefined
    }

    const timer = setTimeout(() => runSearch(trimmed), debounceMs)
    return () => clearTimeout(timer)
  }, [query, debounceMs, runSearch])

  // Cancel any in-flight request when the component goes away.
  useEffect(() => () => abortRef.current?.abort(), [])

  const clear = useCallback(() => {
    abortRef.current?.abort()
    setQuery('')
    setResults([])
    setError(null)
    setStatus('idle')
  }, [])

  const retry = useCallback(() => {
    const trimmed = query.trim()
    if (trimmed.length >= MIN_QUERY_LENGTH) runSearch(trimmed)
  }, [query, runSearch])

  return {
    query,
    setQuery,
    results,
    status,
    error,
    clear,
    retry,
    minQueryLength: MIN_QUERY_LENGTH,
  }
}
