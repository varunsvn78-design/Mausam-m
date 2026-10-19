/**
 * Open-Meteo Air Quality API wrapper + normalizer (Member 4).
 * Docs: https://open-meteo.com/en/docs/air-quality-api
 *
 * Public API:
 *   buildAirQualityUrl(params)                 -> string
 *   fetchAirQuality(location, options)         -> Promise<NormalizedAirQuality>
 *   normalizeAirQuality(raw, location)         -> NormalizedAirQuality
 *   normalizeAirQualityHourly(raw)             -> AirQualityPoint[]
 *
 * Reuses the shared httpClient (buildUrl / fetchJson / ApiError) — there is
 * deliberately no second HTTP client in this codebase.
 *
 * ---------------------------------------------------------------------------
 * NORMALIZED AIR-QUALITY CONTRACT
 * ---------------------------------------------------------------------------
 * {
 *   location: NormalizedLocation,
 *   timezone: string | null,
 *   units: { aqi: 'US AQI', pm25: 'µg/m³', pm10: 'µg/m³' },
 *   current: {                       // may be all-null when the API omits it
 *     time: string | null,           // ISO-8601 local time
 *     usAqi: number | null,
 *     pm25: number | null,
 *     pm10: number | null,
 *   },
 *   hourly: [{ time, usAqi, pm25, pm10 }],  // up to `forecastDays`, oldest first
 *   fetchedAt: string,               // ISO timestamp of this normalization
 *   source: { name, url, license },
 * }
 *
 * MISSING-VALUE BEHAVIOUR (same as weatherService.js):
 *  - numeric fields are `number | null`; values are never guessed or faked
 *  - hourly entries with unparseable timestamps are dropped
 *  - a payload with neither current nor hourly data is rejected with ApiError
 * ---------------------------------------------------------------------------
 *
 * Scope notes:
 *  - `us_aqi` is the global US EPA index (CAMS global domain); the European
 *    AQI is Europe-only and therefore not requested.
 *  - Forecast horizon is up to 7 days; we request 3 — enough for hourly
 *    exercise windows today/tomorrow without an oversized payload.
 */

import { buildUrl, fetchJson, ApiError } from './httpClient.js'

export const AIR_QUALITY_BASE_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'

export const AIR_QUALITY_SOURCE = Object.freeze({
  name: 'Open-Meteo Air Quality (CAMS)',
  url: 'https://open-meteo.com/en/docs/air-quality-api',
  license: 'CC BY 4.0',
})

export const AIR_QUALITY_UNITS = Object.freeze({
  aqi: 'US AQI',
  pm25: 'µg/m³',
  pm10: 'µg/m³',
})

const DEFAULT_FORECAST_DAYS = 3
const MAX_FORECAST_DAYS = 7

const CURRENT_VARIABLES = ['us_aqi', 'pm2_5', 'pm10']
const HOURLY_VARIABLES = ['us_aqi', 'pm2_5', 'pm10']

/* ------------------------------------------------------------------ helpers */

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Coordinates must be present and numeric — `null`/`''` must not become 0. */
function toCoordinate(value) {
  if (value === null || value === undefined || value === '') return Number.NaN
  return Number(value)
}

function toText(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

/* --------------------------------------------------------------- url builder */

/**
 * Build a valid Open-Meteo air-quality URL. Exported for isolated testing.
 *
 * @param {{ latitude:number, longitude:number, timezone?:string, forecastDays?:number }} params
 * @throws {ApiError} when coordinates are missing or unusable
 */
export function buildAirQualityUrl({
  latitude,
  longitude,
  timezone = 'auto',
  forecastDays = DEFAULT_FORECAST_DAYS,
} = {}) {
  if (!Number.isFinite(toCoordinate(latitude)) || !Number.isFinite(toCoordinate(longitude))) {
    throw new ApiError('A latitude and longitude are required to fetch air quality.', { kind: 'invalid' })
  }

  const days = Math.min(Math.max(Math.trunc(Number(forecastDays) || DEFAULT_FORECAST_DAYS), 1), MAX_FORECAST_DAYS)

  return buildUrl(AIR_QUALITY_BASE_URL, {
    latitude,
    longitude,
    current: CURRENT_VARIABLES.join(','),
    hourly: HOURLY_VARIABLES.join(','),
    timezone,
    forecast_days: days,
  })
}

/* ---------------------------------------------------------------- normalizers */

/**
 * Normalize the `hourly` block.
 * @returns {Array<object>} one entry per hour, skipping malformed timestamps
 */
export function normalizeAirQualityHourly(raw) {
  const hourly = raw?.hourly
  if (!hourly || typeof hourly !== 'object' || !Array.isArray(hourly.time)) return []

  return hourly.time
    .map((time, index) => {
      if (time === null || time === undefined || time === '') return null
      return {
        time,
        usAqi: toNumber(hourly.us_aqi?.[index]),
        pm25: toNumber(hourly.pm2_5?.[index]),
        pm10: toNumber(hourly.pm10?.[index]),
      }
    })
    .filter(Boolean)
}

/**
 * Normalize a raw Air Quality payload into the stable contract above.
 *
 * @param {object} raw parsed JSON from the Air Quality API
 * @param {object} location NormalizedLocation the data belongs to
 * @throws {ApiError} when the payload is unusable
 */
export function normalizeAirQuality(raw, location) {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('The air-quality service returned malformed data.', { kind: 'parse' })
  }

  const hourly = normalizeAirQualityHourly(raw)
  const currentBlock = raw.current

  if ((!currentBlock || typeof currentBlock !== 'object') && hourly.length === 0) {
    throw new ApiError('The air-quality service returned malformed data.', { kind: 'parse' })
  }
  if (hourly.length === 0 && !currentBlock?.time) {
    throw new ApiError('The air-quality service returned malformed data.', { kind: 'parse' })
  }

  const current = {
    time: toText(currentBlock?.time),
    usAqi: toNumber(currentBlock?.us_aqi),
    pm25: toNumber(currentBlock?.pm2_5),
    pm10: toNumber(currentBlock?.pm10),
  }

  return {
    location,
    timezone: toText(raw.timezone) ?? location?.timezone ?? null,
    units: { ...AIR_QUALITY_UNITS },
    current,
    hourly,
    fetchedAt: new Date().toISOString(),
    source: { ...AIR_QUALITY_SOURCE },
  }
}

/* ------------------------------------------------------------------- fetcher */

/**
 * Fetch and normalize current + hourly air quality for a location.
 *
 * @param {{ latitude:number, longitude:number, timezone?:string }} location
 * @param {{ signal?:AbortSignal, forecastDays?:number }} [options]
 * @returns {Promise<object>} NormalizedAirQuality
 */
export async function fetchAirQuality(location, { signal, forecastDays = DEFAULT_FORECAST_DAYS } = {}) {
  const url = buildAirQualityUrl({
    latitude: location?.latitude,
    longitude: location?.longitude,
    timezone: location?.timezone ?? 'auto',
    forecastDays,
  })

  const raw = await fetchJson(url, { signal })
  return normalizeAirQuality(raw, location)
}
