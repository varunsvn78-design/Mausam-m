import { describe, expect, it } from 'vitest'
import {
  FORECAST_BASE_URL,
  buildForecastUrl,
  normalizeDaily,
  normalizeForecast,
  normalizeHourly,
} from './weatherService.js'
import { ApiError } from './httpClient.js'

const LOCATION = { latitude: 28.6, longitude: 77.2, timezone: null, name: 'Testville' }

/** Minimal but complete Open-Meteo-shaped payload. */
function rawForecast(overrides = {}) {
  return {
    timezone: 'Asia/Kolkata',
    timezone_abbreviation: 'IST',
    current: {
      time: '2026-05-01T10:00',
      temperature_2m: 30,
      apparent_temperature: 33,
      relative_humidity_2m: 60,
      is_day: 1,
      precipitation: 0,
      weather_code: 1,
      wind_speed_10m: 12,
      wind_direction_10m: 200,
    },
    hourly: {
      time: ['2026-05-01T10:00', '2026-05-01T11:00'],
      temperature_2m: [30, 31],
      apparent_temperature: [33, 34],
      relative_humidity_2m: [60, 58],
      precipitation: [0, 0.2],
      precipitation_probability: [10, 45],
      weather_code: [1, 2],
      wind_speed_10m: [12, 15],
      is_day: [1, 1],
    },
    daily: {
      time: ['2026-05-01'],
      weather_code: [2],
      temperature_2m_max: [34],
      temperature_2m_min: [24],
      precipitation_probability_max: [45],
      wind_speed_10m_max: [18],
      sunrise: ['2026-05-01T06:00'],
      sunset: ['2026-05-01T18:30'],
    },
    ...overrides,
  }
}

describe('buildForecastUrl', () => {
  it('builds a URL against the Open-Meteo forecast endpoint', () => {
    const url = new URL(buildForecastUrl({ latitude: 28.6, longitude: 77.2 }))
    expect(url.origin + url.pathname).toBe(FORECAST_BASE_URL)
    expect(url.searchParams.get('latitude')).toBe('28.6')
    expect(url.searchParams.get('longitude')).toBe('77.2')
    expect(url.searchParams.get('forecast_days')).toBe('7')
    expect(url.searchParams.get('current')).toContain('temperature_2m')
  })

  it('throws an invalid ApiError when coordinates are missing or non-finite', () => {
    expect(() => buildForecastUrl({ latitude: undefined, longitude: 77.2 })).toThrow(ApiError)
    try {
      buildForecastUrl({ latitude: NaN, longitude: 77.2 })
    } catch (error) {
      expect(error.kind).toBe('invalid')
    }
  })
})

describe('normalizeHourly', () => {
  it('maps each hour and drops malformed timestamps', () => {
    const raw = rawForecast()
    raw.hourly.time = ['2026-05-01T10:00', null, '']
    const hourly = normalizeHourly(raw)
    expect(hourly).toHaveLength(1)
    expect(hourly[0].temperature).toBe(30)
    expect(hourly[0].condition.label).toBeTruthy()
  })

  it('returns null (never 0) for missing numeric fields', () => {
    const raw = rawForecast()
    raw.hourly.precipitation_probability = [null, null]
    const hourly = normalizeHourly(raw)
    expect(hourly[0].precipitationProbability).toBeNull()
  })

  it('returns an empty array for a missing hourly block', () => {
    expect(normalizeHourly({})).toEqual([])
    expect(normalizeHourly(null)).toEqual([])
  })
})

describe('normalizeDaily', () => {
  it('maps each day and keeps sunrise/sunset strings', () => {
    const daily = normalizeDaily(rawForecast())
    expect(daily).toHaveLength(1)
    expect(daily[0].temperatureMax).toBe(34)
    expect(daily[0].sunrise).toBe('2026-05-01T06:00')
  })

  it('returns an empty array for a missing daily block', () => {
    expect(normalizeDaily({})).toEqual([])
  })
})

describe('normalizeForecast', () => {
  it('produces the documented contract', () => {
    const weather = normalizeForecast(rawForecast(), LOCATION)
    expect(weather.location).toBe(LOCATION)
    expect(weather.timezone).toBe('Asia/Kolkata')
    expect(weather.units.temperature).toBe('°C')
    expect(weather.current.temperature).toBe(30)
    expect(weather.current.windDirection).toBe(200)
    expect(weather.hourly).toHaveLength(2)
    expect(weather.daily).toHaveLength(1)
    expect(typeof weather.fetchedAt).toBe('string')
    expect(weather.source.name).toBe('Open-Meteo')
  })

  it('labels the current block as a model estimate, not an observation', () => {
    const weather = normalizeForecast(rawForecast(), LOCATION)
    expect(weather.dataType).toBe('model-estimate')
  })

  it('synthesizes current precipitation probability from the matching hour', () => {
    const weather = normalizeForecast(rawForecast(), LOCATION)
    expect(weather.current.precipitationProbability).toBe(10)
  })

  it('leaves synthesized probability null when no hour matches', () => {
    const raw = rawForecast()
    raw.current.time = '2026-05-01T23:00'
    const weather = normalizeForecast(raw, LOCATION)
    expect(weather.current.precipitationProbability).toBeNull()
  })

  it('throws a parse ApiError when the payload is unusable', () => {
    expect(() => normalizeForecast(null, LOCATION)).toThrow(ApiError)
    expect(() => normalizeForecast({}, LOCATION)).toThrow(ApiError)
    try {
      normalizeForecast({ current: {}, hourly: { time: [] }, daily: { time: [] } }, LOCATION)
    } catch (error) {
      expect(error.kind).toBe('parse')
    }
  })

  it('accepts an hourly-only payload without a current block', () => {
    const raw = rawForecast({ current: undefined })
    const weather = normalizeForecast(raw, LOCATION)
    expect(weather.current.temperature).toBeNull()
    expect(weather.hourly).toHaveLength(2)
  })

  it('falls back to the location timezone when the response omits one', () => {
    const raw = rawForecast({ timezone: undefined })
    const weather = normalizeForecast(raw, { ...LOCATION, timezone: 'Asia/Kolkata' })
    expect(weather.timezone).toBe('Asia/Kolkata')
  })
})
