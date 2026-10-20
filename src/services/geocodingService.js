/**
 * Open-Meteo Geocoding API wrapper.
 * Docs: https://open-meteo.com/en/docs/geocoding-api
 *
 * Public API:
 *   searchLocations(query, options) -> Promise<NormalizedLocation[]>
 *   normalizeLocation(raw)          -> NormalizedLocation | null
 *   createLocationFromCoordinates(coords, options) -> NormalizedLocation
 *   MIN_QUERY_LENGTH
 *
 * NormalizedLocation shape (the app-wide location contract):
 *   {
 *     id: string,                 // stable id ("geo-<id>", "gps-<lat>,<lon>")
 *     name: string,               // place name
 *     region: string | null,      // admin1 / state, when available
 *     district: string | null,    // admin2 / district, when available
 *     subdistrict: string | null, // admin3, when available
 *     country: string | null,
 *     countryCode: string | null, // ISO 3166-1 alpha-2
 *     latitude: number,
 *     longitude: number,
 *     timezone: string | null,    // IANA timezone reported by the API
 *     elevation: number | null,   // metres, when available
 *     source: 'geocoding' | 'coordinates'
 *   }
 *
 * Missing values are returned as `null` (never `undefined`, never invented).
 * Open-Meteo geocoding does not always report a district; `district` is then
 * `null` and the UI must show a fallback rather than fabricate one.
 */

import { buildUrl, fetchJson } from './httpClient.js'

export const GEOCODING_BASE_URL = 'https://geocoding-api.open-meteo.com/v1/search'

/** Below this many characters a search would return too many unrelated places. */
export const MIN_QUERY_LENGTH = 2

const MAX_RESULTS = 8

/** Tiny in-memory cache so repeated identical searches do not hit the network. */
const resultCache = new Map()
const CACHE_LIMIT = 50

function cacheKey(query, language) {
  return `${language}:${query.trim().toLowerCase()}`
}

function rememberInCache(key, value) {
  if (resultCache.size >= CACHE_LIMIT) {
    resultCache.delete(resultCache.keys().next().value)
  }
  resultCache.set(key, value)
}

function toNullableString(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Convert one raw geocoding result into the normalized location contract.
 * Returns null when the entry is unusable (no coordinates).
 */
export function normalizeLocation(raw) {
  if (!raw || typeof raw !== 'object') return null

  const latitude = toNullableNumber(raw.latitude)
  const longitude = toNullableNumber(raw.longitude)
  if (latitude === null || longitude === null) return null

  const name = toNullableString(raw.name) ?? 'Unknown place'
  const region = toNullableString(raw.admin1)
  const district = toNullableString(raw.admin2)
  const subdistrict = toNullableString(raw.admin3)
  const country = toNullableString(raw.country)
  const countryCode = toNullableString(raw.country_code)

  return {
    id: raw.id !== undefined && raw.id !== null ? `geo-${raw.id}` : `geo-${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    name,
    region,
    district,
    subdistrict,
    country,
    countryCode,
    latitude,
    longitude,
    timezone: toNullableString(raw.timezone),
    elevation: toNullableNumber(raw.elevation),
    source: 'geocoding',
  }
}

/**
 * Build a NormalizedLocation from raw device coordinates (the "Use my location"
 * flow). Open-Meteo offers no reverse geocoding, so the place is deliberately
 * labelled `name` (default "My location") rather than guessing a city name.
 *
 * @param {{ latitude:number, longitude:number, accuracy?:number|null }} coords
 * @param {{ name?:string, timezone?:string|null }} [options]
 * @returns {NormalizedLocation}
 * @throws {TypeError} when coordinates are missing or not finite
 */
export function createLocationFromCoordinates(coords, { name = 'My location', timezone = null } = {}) {
  const latitude = toNullableNumber(coords?.latitude)
  const longitude = toNullableNumber(coords?.longitude)
  if (latitude === null || longitude === null) {
    throw new TypeError('A latitude and longitude are required to use device coordinates.')
  }

  return {
    id: `gps-${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    name: toNullableString(name) ?? 'My location',
    region: null,
    district: null,
    subdistrict: null,
    country: null,
    countryCode: null,
    latitude,
    longitude,
    timezone: toNullableString(timezone),
    elevation: null,
    accuracy: toNullableNumber(coords?.accuracy),
    source: 'coordinates',
  }
}

/**
 * Search for places by name.
 *
 * @param {string} query free-text city / town name
 * @param {{ signal?: AbortSignal, language?: string, count?: number, skipCache?: boolean }} [options]
 * @returns {Promise<NormalizedLocation[]>} always an array (possibly empty); never `null` entries
 * @throws {ApiError} on network / HTTP / parse failure
 */
export async function searchLocations(query, { signal, language = 'en', count = MAX_RESULTS, skipCache = false } = {}) {
  const trimmed = (query ?? '').trim()
  if (trimmed.length < MIN_QUERY_LENGTH) return []

  const key = cacheKey(trimmed, language)
  if (!skipCache && resultCache.has(key)) {
    return resultCache.get(key)
  }

  const url = buildUrl(GEOCODING_BASE_URL, {
    name: trimmed,
    count,
    language,
    format: 'json',
  })

  const payload = await fetchJson(url, { signal, serviceName: 'location search service' })

  // The API omits `results` entirely when nothing matches.
  const rawResults = Array.isArray(payload?.results) ? payload.results : []
  const locations = rawResults.map(normalizeLocation).filter(Boolean)

  rememberInCache(key, locations)
  return locations
}

/** Exposed for tests / debugging. */
export function clearGeocodingCache() {
  resultCache.clear()
}
