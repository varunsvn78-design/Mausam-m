import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAirQuality } from '../services/airQualityService.js'
import { isAbortError } from '../services/httpClient.js'

/**
 * UI state for the Air Quality & Outdoor Activity Advisor (Member 4).
 *
 * Fetches the Open-Meteo Air Quality API for the selected location and keeps
 * a small best-effort localStorage cache per place (1 h), so a reload or a
 * brief offline spell still shows the last reading clearly labelled as cached.
 *
 * `status`:
 *   'idle'    - no location selected
 *   'loading' - first fetch in flight, nothing to show yet
 *   'ready'   - data available (fresh or from cache)
 *   'error'   - the fetch failed (cached data, if any, is still returned)
 *
 * @param {object|null} location NormalizedLocation from useWeatherEngine()
 * @param {{ isOnline?: boolean }} [options]
 */

const CACHE_KEY = 'mausam.insights.air-quality.cache.v1'
const CACHE_VERSION = 1
const CACHE_STALE_AFTER_MS = 60 * 60 * 1000 // 1 hour

function placeKey(location) {
  if (!location) return null
  return location.id ?? `${location.latitude},${location.longitude}`
}

function readCache(location) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== CACHE_VERSION || parsed.placeKey !== placeKey(location)) return null
    const ageMs = Date.now() - Date.parse(parsed.savedAt)
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > CACHE_STALE_AFTER_MS) return null
    return { data: parsed.data, savedAt: parsed.savedAt, ageMs }
  } catch {
    return null
  }
}

function writeCache(location, data) {
  if (!data || typeof data !== 'object') return
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: CACHE_VERSION,
        placeKey: placeKey(location),
        savedAt: data.fetchedAt ?? new Date().toISOString(),
        data,
      }),
    )
  } catch {
    /* storage unavailable or full — cache is best-effort only */
  }
}

export function useAirQuality(location, { isOnline = true } = {}) {
  const [airQuality, setAirQuality] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const abortRef = useRef(null)
  const requestIdRef = useRef(0)
  const aqRef = useRef(null)
  aqRef.current = airQuality

  const load = useCallback(async (target, { background = false } = {}) => {
    if (!target) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current

    if (!background) setStatus('loading')
    setError(null)

    try {
      const data = await fetchAirQuality(target, { signal: controller.signal })
      if (requestId !== requestIdRef.current) return
      setAirQuality(data)
      setStatus('ready')
      writeCache(target, data)
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) return
      setError(err)
      if (!aqRef.current) {
        const cached = readCache(target)
        if (cached) {
          setAirQuality(cached.data)
          setStatus('ready')
          return
        }
      }
      setStatus('error')
    }
  }, [])

  const key = placeKey(location)

  useEffect(() => {
    if (!location || !key) {
      setAirQuality(null)
      setStatus('idle')
      setError(null)
      return
    }

    const cached = readCache(location)
    if (cached) {
      setAirQuality(cached.data)
      setStatus('ready')
    } else {
      setAirQuality(null)
      setStatus(isOnline ? 'loading' : 'error')
      if (!isOnline) setError(null)
    }

    if (isOnline) load(location, { background: Boolean(cached) })
    // placeKey identifies the place; run when it changes or connectivity returns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isOnline])

  const retry = useCallback(() => {
    if (location) load(location, { background: Boolean(aqRef.current) })
  }, [load, location])

  return {
    airQuality,
    status,
    error,
    isLoading: status === 'loading',
    retry,
  }
}

export default useAirQuality
