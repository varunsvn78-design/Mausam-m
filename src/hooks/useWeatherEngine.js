import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchWeather } from '../services/weatherService.js'
import { isAbortError } from '../services/httpClient.js'
import {
  loadSelectedLocation,
  loadWeatherCache,
  saveSelectedLocation,
  saveWeatherCache,
  clearSelectedLocation,
  loadRecentLocations,
  saveRecentLocation,
  clearRecentLocations,
} from '../services/weatherCache.js'
import { useOnlineStatus } from './useOnlineStatus.js'

/**
 * UI state machine for the Weather Engine.
 *
 * `status` values:
 *   'empty'   - no location selected yet (show the empty state)
 *   'loading' - a fetch is in flight and there is no data to show yet
 *   'ready'   - normalized weather data is available (fresh or cached)
 *   'error'   - the last fetch failed (may still have cached `weather` to show)
 *
 * The hook deliberately keeps UI state here and normalized weather data in
 * `weather` (see weatherService.js for the data contract), so Member 2 can
 * consume `weather` directly without touching the API layer.
 */
export function useWeatherEngine() {
  const isOnline = useOnlineStatus()

  const [location, setLocation] = useState(() => loadSelectedLocation())
  const [recentLocations, setRecentLocations] = useState(() => loadRecentLocations())
  const [weather, setWeather] = useState(null)
  const [cacheInfo, setCacheInfo] = useState(null)
  const [status, setStatus] = useState(() => (loadSelectedLocation() ? 'loading' : 'empty'))
  const [error, setError] = useState(null)

  const abortRef = useRef(null)
  const requestIdRef = useRef(0)
  const weatherRef = useRef(null)
  weatherRef.current = weather

  /** Fetch a location, falling back to cached data when the network fails. */
  const load = useCallback(async (target, { background = false } = {}) => {
    if (!target) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current

    if (!background) setStatus('loading')
    setError(null)

    try {
      const data = await fetchWeather(target, { signal: controller.signal })
      if (requestId !== requestIdRef.current) return
      setWeather(data)
      setCacheInfo(null)
      setStatus('ready')
      saveWeatherCache(data)
    } catch (err) {
      if (isAbortError(err) || requestId !== requestIdRef.current) return

      setError(err)

      // Prefer showing the last successful forecast (possibly from cache).
      if (weatherRef.current?.location) {
        setStatus('error')
        return
      }

      const cached = loadWeatherCache()
      if (cached) {
        setWeather(cached.data)
        setCacheInfo({ savedAt: cached.savedAt, ageMs: cached.ageMs, isStale: cached.isStale })
        setStatus('error')
        return
      }

      setStatus('error')
    }
  }, [])

  // Restore the last selection: show cached data immediately, then refresh when online.
  useEffect(() => {
    const saved = loadSelectedLocation()
    if (!saved) return

    const cached = loadWeatherCache()
    if (cached) {
      setWeather(cached.data)
      setCacheInfo({ savedAt: cached.savedAt, ageMs: cached.ageMs, isStale: cached.isStale })
      setStatus('ready')
    }

    if (navigator.onLine !== false) {
      load(saved, { background: Boolean(cached) })
    }
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the browser comes back online, retry automatically if we are showing errors.
  useEffect(() => {
    if (!isOnline || !location) return
    if (status === 'error' || status === 'empty') {
      load(location, { background: Boolean(weatherRef.current) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  const selectLocation = useCallback(
    (nextLocation) => {
      if (!nextLocation) return
      setLocation(nextLocation)
      saveSelectedLocation(nextLocation)
      saveRecentLocation(nextLocation)
      setRecentLocations(loadRecentLocations())
      setCacheInfo(null)
      setWeather(null)
      load(nextLocation)
    },
    [load],
  )

  const clearLocation = useCallback(() => {
    abortRef.current?.abort()
    requestIdRef.current += 1
    clearSelectedLocation()
    setLocation(null)
    setWeather(null)
    setCacheInfo(null)
    setError(null)
    setStatus('empty')
  }, [])

  const retry = useCallback(() => {
    if (location) load(location, { background: Boolean(weatherRef.current) })
  }, [load, location])

  const clearRecent = useCallback(() => {
    clearRecentLocations()
    setRecentLocations([])
  }, [])

  return {
    isOnline,
    location,
    weather,
    status,
    error,
    cacheInfo,
    isLoading: status === 'loading',
    hasWeather: Boolean(weather),
    recentLocations,
    selectLocation,
    clearLocation,
    clearRecent,
    retry,
  }
}
