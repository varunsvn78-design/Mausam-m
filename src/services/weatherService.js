/**
 * Open-Meteo Forecast API wrapper + normalizer.
 * Docs: https://open-meteo.com/en/docs
 *
 * Public API:
 *   buildForecastUrl(params)              -> string
 *   fetchWeather(location, options)       -> Promise<NormalizedWeather>
 *   normalizeForecast(raw, location)      -> NormalizedWeather
 *   normalizeHourly(raw)                  -> HourlyPoint[]
 *   normalizeDaily(raw)                   -> DailyForecast[]
 *
 * ---------------------------------------------------------------------------
 * NORMALIZED WEATHER CONTRACT (stable, consumed by the UI and by Member 2)
 * ---------------------------------------------------------------------------
 * {
 *   location: NormalizedLocation,   // see geocodingService.js
 *   timezone: string | null,        // IANA timezone used by the API response
 *   timezoneAbbreviation: string | null,
 *   units: {
 *     temperature: '°C',
 *     apparentTemperature: '°C',
 *     humidity: '%',
 *     windSpeed: 'km/h',
 *     precipitation: 'mm',
 *     precipitationProbability: '%'
 *   },
 *   current: {
 *     time: string,                       // ISO-8601 local time from the API
 *     isDay: boolean,
 *     temperature: number | null,         // °C
 *     apparentTemperature: number | null, // °C
 *     relativeHumidity: number | null,    // %
 *     windSpeed: number | null,           // km/h (10 m)
 *     windDirection: number | null,       // degrees
 *     precipitation: number | null,       // mm (last hour)
 *     precipitationProbability: number | null, // % - taken from the matching hourly point
 *     weatherCode: number | null,
 *     condition: { code, label, group, isDay }  // from weatherCodes.js
 *   },
 *   hourly: [{                            // up to 7 days, local time, oldest first
 *     time, isDay, temperature, apparentTemperature,
 *     relativeHumidity, windSpeed, weatherCode, condition,
 *     precipitation, precipitationProbability
 *   }],
 *   daily: [{                             // exactly the days returned by the API (7 by default)
 *     date, time,
 *     weatherCode, condition,
 *     temperatureMax, temperatureMin,
 *     precipitationProbability,           // % (daily max), may be null
 *     windSpeedMax,                       // km/h, may be null
 *     sunrise, sunset                     // ISO-8601 local times, may be null
 *   }],
 *   fetchedAt: string,                    // ISO timestamp of the successful fetch (UTC)
 *   source: { name: 'Open-Meteo', url: 'https://open-meteo.com/' }
 * }
 *
 * MISSING-VALUE BEHAVIOUR
 *  - Every numeric field is `number | null`. `null` means the API did not
 *    provide the value. Values are never guessed, defaulted to 0, or faked.
 *  - Array fields (`hourly`, `daily`) are always arrays; entries with an
 *    unparseable timestamp are dropped rather than mislabelled.
 *  - `condition` is always present; unknown codes fall back to
 *    { group: 'unknown', label: 'Unknown conditions' }.
 * ---------------------------------------------------------------------------
 */

import { describeWeatherCode } from './weatherCodes.js'
import { buildUrl, fetchJson, ApiError } from './httpClient.js'

export const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast'

export const FORECAST_SOURCE = Object.freeze({
  name: 'Open-Meteo',
  url: 'https://open-meteo.com/',
})

export const WEATHER_UNITS = Object.freeze({
  temperature: '°C',
  apparentTemperature: '°C',
  humidity: '%',
  windSpeed: 'km/h',
  precipitation: 'mm',
  precipitationProbability: '%',
})

const DEFAULT_FORECAST_DAYS = 7

const CURRENT_VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
]

const HOURLY_VARIABLES = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'precipitation_probability',
  'weather_code',
  'wind_speed_10m',
  'is_day',
]

const DAILY_VARIABLES = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'sunrise',
  'sunset',
]

/* ------------------------------------------------------------------ helpers */

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toBoolean(value) {
  return value === 1 || value === true
}

function toText(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

/* --------------------------------------------------------------- url builder */

/**
 * Build a valid Open-Meteo forecast URL. Exported so it can be tested in isolation
 * and reused if another module needs the same parameters.
 *
 * @param {{ latitude:number, longitude:number, timezone?:string, forecastDays?:number, hourly?:string[] }} params
 */
export function buildForecastUrl({
  latitude,
  longitude,
  timezone = 'auto',
  forecastDays = DEFAULT_FORECAST_DAYS,
} = {}) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    throw new ApiError('A latitude and longitude are required to fetch weather.', { kind: 'invalid' })
  }

  return buildUrl(FORECAST_BASE_URL, {
    latitude,
    longitude,
    current: CURRENT_VARIABLES.join(','),
    hourly: HOURLY_VARIABLES.join(','),
    daily: DAILY_VARIABLES.join(','),
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
    timezone,
    forecast_days: forecastDays,
  })
}

/* ---------------------------------------------------------------- normalizers */

/**
 * Normalize the `hourly` block.
 * @returns {Array<object>} one entry per hour, skipping malformed timestamps
 */
export function normalizeHourly(raw) {
  const hourly = raw?.hourly
  if (!hourly || typeof hourly !== 'object' || !Array.isArray(hourly.time)) return []

  return hourly.time
    .map((time, index) => {
      if (time === null || time === undefined || time === '') return null
      const isDay = toBoolean(hourly.is_day?.[index])
      const weatherCode = toNumber(hourly.weather_code?.[index])
      return {
        time,
        isDay,
        temperature: toNumber(hourly.temperature_2m?.[index]),
        apparentTemperature: toNumber(hourly.apparent_temperature?.[index]),
        relativeHumidity: toNumber(hourly.relative_humidity_2m?.[index]),
        windSpeed: toNumber(hourly.wind_speed_10m?.[index]),
        precipitation: toNumber(hourly.precipitation?.[index]),
        precipitationProbability: toNumber(hourly.precipitation_probability?.[index]),
        weatherCode,
        condition: describeWeatherCode(weatherCode, isDay),
      }
    })
    .filter(Boolean)
}

/**
 * Normalize the `daily` block.
 * @returns {Array<object>} one entry per day (undefined days are dropped)
 */
export function normalizeDaily(raw) {
  const daily = raw?.daily
  if (!daily || typeof daily !== 'object' || !Array.isArray(daily.time)) return []

  return daily.time
    .map((date, index) => {
      if (date === null || date === undefined || date === '') return null
      const weatherCode = toNumber(daily.weather_code?.[index])
      return {
        date,
        time: date,
        weatherCode,
        condition: describeWeatherCode(weatherCode, true),
        temperatureMax: toNumber(daily.temperature_2m_max?.[index]),
        temperatureMin: toNumber(daily.temperature_2m_min?.[index]),
        precipitationProbability: toNumber(daily.precipitation_probability_max?.[index]),
        windSpeedMax: toNumber(daily.wind_speed_10m_max?.[index]),
        sunrise: toText(daily.sunrise?.[index]),
        sunset: toText(daily.sunset?.[index]),
      }
    })
    .filter(Boolean)
}

/** Find the hourly point whose local timestamp matches the current observation. */
function findHourlyPointForTime(hourly, currentTime) {
  if (!currentTime || hourly.length === 0) return null
  const target = String(currentTime).slice(0, 13) // "YYYY-MM-DDTHH"
  return hourly.find((point) => String(point.time).slice(0, 13) === target) ?? null
}

/**
 * Normalize a raw Open-Meteo forecast payload into the stable contract above.
 *
 * @param {object} raw parsed JSON from the Forecast API
 * @param {object} location NormalizedLocation the data belongs to
 * @throws {ApiError} when the payload is unusable (no current block, wrong shape)
 */
export function normalizeForecast(raw, location) {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('The weather service returned malformed data.', { kind: 'parse' })
  }

  const hourly = normalizeHourly(raw)
  const daily = normalizeDaily(raw)

  const currentBlock = raw.current
  if (!currentBlock || typeof currentBlock !== 'object' || currentBlock.time === undefined) {
    // Without a current block we still allow daily/hourly-only payloads, but if
    // there is nothing at all this is unusable data.
    if (hourly.length === 0 && daily.length === 0) {
      throw new ApiError('The weather service returned malformed data.', { kind: 'parse' })
    }
  }

  const currentTime = toText(currentBlock?.time)
  const currentIsDay = currentBlock ? toBoolean(currentBlock.is_day) : true
  const currentWeatherCode = toNumber(currentBlock?.weather_code)
  const matchedHour = findHourlyPointForTime(hourly, currentTime)

  const current = {
    time: currentTime,
    isDay: currentIsDay,
    temperature: toNumber(currentBlock?.temperature_2m),
    apparentTemperature: toNumber(currentBlock?.apparent_temperature),
    relativeHumidity: toNumber(currentBlock?.relative_humidity_2m),
    windSpeed: toNumber(currentBlock?.wind_speed_10m),
    windDirection: toNumber(currentBlock?.wind_direction_10m),
    precipitation: toNumber(currentBlock?.precipitation),
    // The API has no "current precipitation probability"; the matching hourly
    // point is the honest source. It may be null when the model has no value.
    precipitationProbability: matchedHour ? matchedHour.precipitationProbability : null,
    weatherCode: currentWeatherCode,
    condition: describeWeatherCode(currentWeatherCode, currentIsDay),
  }

  return {
    location,
    timezone: toText(raw.timezone) ?? location?.timezone ?? null,
    timezoneAbbreviation: toText(raw.timezone_abbreviation),
    units: { ...WEATHER_UNITS },
    current,
    hourly,
    daily,
    fetchedAt: new Date().toISOString(),
    source: { ...FORECAST_SOURCE },
  }
}

/* ------------------------------------------------------------------- fetcher */

/**
 * Fetch and normalize current + hourly + 7-day weather for a location.
 *
 * @param {{ latitude:number, longitude:number, timezone?:string }} location
 * @param {{ signal?:AbortSignal, forecastDays?:number }} [options]
 * @returns {Promise<object>} NormalizedWeather
 */
export async function fetchWeather(location, { signal, forecastDays = DEFAULT_FORECAST_DAYS } = {}) {
  const url = buildForecastUrl({
    latitude: location?.latitude,
    longitude: location?.longitude,
    timezone: location?.timezone ?? 'auto',
    forecastDays,
  })

  const raw = await fetchJson(url, { signal })
  return normalizeForecast(raw, location)
}
