import { describe, expect, it } from 'vitest'
import { ApiError } from './httpClient.js'
import {
  AIR_QUALITY_BASE_URL,
  buildAirQualityUrl,
  fetchAirQuality,
  normalizeAirQuality,
  normalizeAirQualityHourly,
} from './airQualityService.js'

const LOCATION = { id: 'delhi', latitude: 28.6, longitude: 77.2, timezone: 'Asia/Kolkata' }

function samplePayload() {
  return {
    latitude: 28.5,
    longitude: 77.1,
    timezone: 'Asia/Kolkata',
    current: { time: '2026-10-19T12:00', us_aqi: 152, pm2_5: 68.4, pm10: 112.5 },
    hourly: {
      time: ['2026-10-19T00:00', '2026-10-19T01:00', '2026-10-19T02:00'],
      us_aqi: [140, 145, 151],
      pm2_5: [60, 63, 70],
      pm10: [100, 105, 110],
    },
  }
}

describe('buildAirQualityUrl', () => {
  it('builds a URL with coordinates, variables, timezone and forecast days', () => {
    const url = buildAirQualityUrl({ latitude: 28.6, longitude: 77.2, timezone: 'Asia/Kolkata', forecastDays: 3 })
    expect(url.startsWith(AIR_QUALITY_BASE_URL)).toBe(true)
    expect(url).toContain('latitude=28.6')
    expect(url).toContain('longitude=77.2')
    expect(url).toContain('timezone=Asia%2FKolkata')
    expect(url).toContain('forecast_days=3')
    expect(url).toContain('current=us_aqi%2Cpm2_5%2Cpm10')
    expect(url).toContain('hourly=us_aqi%2Cpm2_5%2Cpm10')
  })

  it('clamps forecast days to the supported maximum of 7', () => {
    expect(buildAirQualityUrl({ latitude: 1, longitude: 2, forecastDays: 30 })).toContain('forecast_days=7')
  })

  it('defaults forecast days when the value is unusable', () => {
    expect(buildAirQualityUrl({ latitude: 1, longitude: 2, forecastDays: 0 })).toContain('forecast_days=3')
  })

  it('throws an invalid ApiError when coordinates are missing', () => {
    expect(() => buildAirQualityUrl({})).toThrowError(ApiError)
    try {
      buildAirQualityUrl({ latitude: null, longitude: null })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error.kind).toBe('invalid')
    }
  })
})

describe('normalizeAirQualityHourly', () => {
  it('drops entries with malformed timestamps and preserves nulls', () => {
    const hourly = normalizeAirQualityHourly({
      hourly: {
        time: ['2026-10-19T00:00', '', '2026-10-19T02:00'],
        us_aqi: [50, 60, null],
        pm2_5: [10, 20, 30],
        pm10: [null, 40, 50],
      },
    })
    expect(hourly).toHaveLength(2)
    expect(hourly[0]).toEqual({ time: '2026-10-19T00:00', usAqi: 50, pm25: 10, pm10: null })
    expect(hourly[1].usAqi).toBeNull()
  })

  it('returns an empty array when the block is missing', () => {
    expect(normalizeAirQualityHourly(undefined)).toEqual([])
    expect(normalizeAirQualityHourly({ hourly: {} })).toEqual([])
  })
})

describe('normalizeAirQuality', () => {
  it('normalizes a full payload into the stable contract', () => {
    const result = normalizeAirQuality(samplePayload(), LOCATION)
    expect(result.location).toBe(LOCATION)
    expect(result.timezone).toBe('Asia/Kolkata')
    expect(result.current).toEqual({ time: '2026-10-19T12:00', usAqi: 152, pm25: 68.4, pm10: 112.5 })
    expect(result.hourly).toHaveLength(3)
    expect(result.units).toEqual({ aqi: 'US AQI', pm25: 'µg/m³', pm10: 'µg/m³' })
    expect(result.source.name).toContain('Open-Meteo')
    expect(Number.isNaN(Date.parse(result.fetchedAt))).toBe(false)
  })

  it('preserves missing current values as null instead of guessing', () => {
    const raw = samplePayload()
    raw.current = { time: '2026-10-19T12:00', us_aqi: null, pm2_5: null, pm10: null }
    const result = normalizeAirQuality(raw, LOCATION)
    expect(result.current.usAqi).toBeNull()
    expect(result.current.pm25).toBeNull()
    expect(result.current.pm10).toBeNull()
  })

  it('accepts a current-only payload (no hourly block)', () => {
    const result = normalizeAirQuality({ timezone: 'UTC', current: { time: 't', us_aqi: 42 } }, LOCATION)
    expect(result.current.usAqi).toBe(42)
    expect(result.hourly).toEqual([])
  })

  it('accepts an hourly-only payload (no current block)', () => {
    const raw = samplePayload()
    delete raw.current
    const result = normalizeAirQuality(raw, LOCATION)
    expect(result.hourly).toHaveLength(3)
    expect(result.current.usAqi).toBeNull()
  })

  it('rejects unusable payloads with a parse ApiError', () => {
    for (const bad of [null, 'text', {}, { timezone: 'UTC' }]) {
      expect(() => normalizeAirQuality(bad, LOCATION)).toThrowError(ApiError)
      try {
        normalizeAirQuality(bad, LOCATION)
      } catch (error) {
        expect(error.kind).toBe('parse')
      }
    }
  })
})

describe('fetchAirQuality', () => {
  it('rejects with an invalid ApiError for a location without coordinates', async () => {
    await expect(fetchAirQuality({ id: 'broken' })).rejects.toBeInstanceOf(ApiError)
    await expect(fetchAirQuality({ id: 'broken' })).rejects.toMatchObject({ kind: 'invalid' })
  })
})
