/**
 * Offline cache for the last successful forecast.
 *
 * Stored in `localStorage` under a single versioned key. Cached data is ALWAYS
 * labelled with the time it was fetched and is never presented as live data -
 * the UI shows a "cached / last updated" banner whenever this is used.
 *
 * Public API:
 *   saveWeatherCache(data)                     -> void
 *   loadWeatherCache({ maxAgeMs? })            -> CachedWeather | null
 *   clearWeatherCache()                        -> void
 *   saveSelectedLocation(location)             -> void
 *   loadSelectedLocation()                     -> Location | null
 *   clearSelectedLocation()                    -> void
 *   saveRecentLocation(location)               -> void
 *   loadRecentLocations()                      -> Location[]
 *   clearRecentLocations()                     -> void
 *   isCacheStale(cachedEntry, maxAgeMs?)       -> boolean
 *   CACHE_STALE_AFTER_MS
 *
 * CachedWeather = { data: NormalizedWeather, savedAt: string /* ISO *\/, ageMs: number, isStale: boolean }
 */

const STORAGE_KEY = 'mausam.weather-engine.cache.v1'
const SELECTION_KEY = 'mausam.weather-engine.selection.v1'
const RECENT_KEY = 'mausam.weather-engine.recent.v1'
const RECENT_LIMIT = 5
const SCHEMA_VERSION = 1

/** After this age the cached forecast is flagged as stale (but still shown). */
export const CACHE_STALE_AFTER_MS = 60 * 60 * 1000 // 1 hour

/**
 * Hard upper bound on how old a cached forecast may be before it is discarded
 * even for offline display. Beyond this the forecast window has almost
 * certainly passed and showing it would be misleading.
 */
export const CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000 // 48 hours

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    // Private mode / blocked storage - fail silently, cache is best-effort.
    return null
  }
}

/** Structural validation so corrupt / outdated payloads are never rendered. */
function isValidCachedPayload(payload) {
  if (!payload || typeof payload !== 'object') return false
  if (payload.version !== SCHEMA_VERSION) return false
  if (typeof payload.savedAt !== 'string' || Number.isNaN(Date.parse(payload.savedAt))) return false

  const data = payload.data
  if (!data || typeof data !== 'object') return false
  if (!data.location || typeof data.location !== 'object') return false
  if (!Number.isFinite(Number(data.location.latitude))) return false
  if (!Number.isFinite(Number(data.location.longitude))) return false
  if (!data.current || typeof data.current !== 'object') return false
  if (!Array.isArray(data.daily)) return false
  if (!Array.isArray(data.hourly)) return false

  return true
}

/** Persist the most recent successful fetch. Silently no-ops when storage is unavailable. */
export function saveWeatherCache(data) {
  if (!data || typeof data !== 'object') return
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SCHEMA_VERSION, savedAt: data.fetchedAt ?? new Date().toISOString(), data }),
    )
  } catch {
    // Quota exceeded etc. - non fatal.
  }
}

/**
 * Read the cached forecast if it is present and structurally valid.
 * @param {{ maxAgeMs?: number }} [options] entries older than this are discarded (default: 48h)
 * @returns {{ data: object, savedAt: string, ageMs: number, isStale: boolean } | null}
 */
export function loadWeatherCache({ maxAgeMs = CACHE_MAX_AGE_MS } = {}) {
  const storage = getStorage()
  if (!storage) return null

  let parsed
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return null
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isValidCachedPayload(parsed)) return null

  const savedAtMs = Date.parse(parsed.savedAt)
  const ageMs = Math.max(0, Date.now() - savedAtMs)
  if (ageMs > maxAgeMs) return null

  return {
    data: parsed.data,
    savedAt: parsed.savedAt,
    ageMs,
    isStale: ageMs > CACHE_STALE_AFTER_MS,
  }
}

export function clearWeatherCache() {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/* --------------------------------------------------- selected location memory */

/** Persist the user's selected location so a reload restores the same place. */
export function saveSelectedLocation(location) {
  const storage = getStorage()
  if (!storage || !location) return
  try {
    storage.setItem(SELECTION_KEY, JSON.stringify(location))
  } catch {
    // ignore
  }
}

/** @returns {object|null} the last selected NormalizedLocation, if valid */
export function loadSelectedLocation() {
  const storage = getStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(SELECTION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!Number.isFinite(Number(parsed.latitude)) || !Number.isFinite(Number(parsed.longitude))) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSelectedLocation() {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(SELECTION_KEY)
  } catch {
    // ignore
  }
}

/* ----------------------------------------------------- recent location memory */

function isValidLocation(value) {
  return (
    value &&
    typeof value === 'object' &&
    Number.isFinite(Number(value.latitude)) &&
    Number.isFinite(Number(value.longitude))
  )
}

/**
 * Remember a selected location for quick access (most recent first, de-duped by
 * id, capped at RECENT_LIMIT). Silent no-op when storage is unavailable.
 */
export function saveRecentLocation(location) {
  const storage = getStorage()
  if (!storage || !isValidLocation(location)) return

  const key = location.id ?? `${location.latitude},${location.longitude}`
  const existing = loadRecentLocations().filter(
    (entry) => (entry.id ?? `${entry.latitude},${entry.longitude}`) !== key,
  )
  const next = [location, ...existing].slice(0, RECENT_LIMIT)

  try {
    storage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Quota exceeded etc. - non fatal.
  }
}

/** @returns {Array<object>} valid recent locations, most recent first */
export function loadRecentLocations() {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidLocation)
  } catch {
    return []
  }
}

export function clearRecentLocations() {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(RECENT_KEY)
  } catch {
    // ignore
  }
}

/** @deprecated internal helper kept public for tests. */
export function isCacheStale(cachedEntry, maxAgeMs = CACHE_STALE_AFTER_MS) {
  if (!cachedEntry) return true
  return (cachedEntry.ageMs ?? Infinity) > maxAgeMs
}
