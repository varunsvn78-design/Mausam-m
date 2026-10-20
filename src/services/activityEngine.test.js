import { describe, expect, it } from 'vitest'
import {
  LEVELS,
  evaluateActivities,
  evaluateActivity,
  evaluateFactor,
} from './activityEngine.js'
import { ACTIVITIES } from '../config/activities.js'
import {
  COLD_THRESHOLDS,
  HEAT_THRESHOLDS,
  RAIN_THRESHOLDS,
  WIND_THRESHOLDS,
} from '../config/adaptiveThresholds.js'

/** A benign daytime hourly point that should be "recommended" for most activities. */
function fairPoint(overrides = {}) {
  return {
    time: '2026-05-01T10:00',
    isDay: true,
    temperature: 22,
    apparentTemperature: 22,
    relativeHumidity: 55,
    windSpeed: 5,
    precipitation: 0,
    precipitationProbability: 5,
    weatherCode: 1,
    condition: { code: 1, label: 'Mainly clear', group: 'clear', isDay: true },
    ...overrides,
  }
}

const walkActivity = ACTIVITIES.find((a) => a.id === 'walk')
const runActivity = ACTIVITIES.find((a) => a.id === 'run')
const cycleActivity = ACTIVITIES.find((a) => a.id === 'cycling')

describe('evaluateFactor thresholds', () => {
  it('classifies rain probability against caution/avoid boundaries', () => {
    expect(evaluateFactor('rain', fairPoint({ precipitationProbability: RAIN_THRESHOLDS.cautionAt - 1 })).level).toBe(
      LEVELS.OK,
    )
    expect(evaluateFactor('rain', fairPoint({ precipitationProbability: RAIN_THRESHOLDS.cautionAt })).level).toBe(
      LEVELS.CAUTION,
    )
    expect(evaluateFactor('rain', fairPoint({ precipitationProbability: RAIN_THRESHOLDS.avoidAt })).level).toBe(
      LEVELS.AVOID,
    )
  })

  it('classifies wind against boundaries', () => {
    expect(evaluateFactor('wind', fairPoint({ windSpeed: WIND_THRESHOLDS.cautionAt })).level).toBe(LEVELS.CAUTION)
    expect(evaluateFactor('wind', fairPoint({ windSpeed: WIND_THRESHOLDS.avoidAt })).level).toBe(LEVELS.AVOID)
  })

  it('treats cold as lower-is-worse', () => {
    expect(evaluateFactor('cold', fairPoint({ temperature: COLD_THRESHOLDS.cautionAt })).level).toBe(LEVELS.CAUTION)
    expect(evaluateFactor('cold', fairPoint({ temperature: COLD_THRESHOLDS.avoidAt })).level).toBe(LEVELS.AVOID)
  })

  it('uses the heat index for heat when available and records the source', () => {
    const result = evaluateFactor('heat', fairPoint(), { heatIndex: { status: 'ok', valueC: 41 } })
    expect(result.level).toBe(LEVELS.AVOID)
    expect(result.source).toBe('heatIndex')
    expect(result.value).toBe(41)
  })

  it('falls back to apparent temperature for heat when the heat index is unavailable', () => {
    const result = evaluateFactor('heat', fairPoint({ apparentTemperature: 34 }), {
      heatIndex: { status: 'unavailable', reasonKey: 'lowHumidity' },
    })
    expect(result.level).toBe(LEVELS.CAUTION)
    expect(result.source).toBe('apparentTemperature')
    expect(result.value).toBe(34)
  })

  it('returns unknown (never a fabricated value) when a numeric input is missing', () => {
    expect(evaluateFactor('rain', fairPoint({ precipitationProbability: null })).level).toBe(LEVELS.UNKNOWN)
    expect(evaluateFactor('wind', fairPoint({ windSpeed: undefined })).level).toBe(LEVELS.UNKNOWN)
    expect(evaluateFactor('heat', fairPoint({ apparentTemperature: null }), { heatIndex: { status: 'unavailable' } }).level).toBe(
      LEVELS.UNKNOWN,
    )
  })

  it('avoids thunderstorms and cautions other precipitation groups', () => {
    expect(
      evaluateFactor('thunder', fairPoint({ condition: { group: 'thunderstorm', label: 'Thunderstorm' } })).level,
    ).toBe(LEVELS.AVOID)
    expect(evaluateFactor('thunder', fairPoint({ condition: { group: 'rain', label: 'Rain' } })).level).toBe(
      LEVELS.CAUTION,
    )
    expect(evaluateFactor('thunder', fairPoint({ condition: { group: 'unknown', label: 'Unknown' } })).level).toBe(
      LEVELS.UNKNOWN,
    )
  })

  it('cautions on fog and at night', () => {
    expect(evaluateFactor('fog', fairPoint({ condition: { group: 'fog', label: 'Fog' } })).level).toBe(LEVELS.CAUTION)
    expect(evaluateFactor('dark', fairPoint({ isDay: false })).level).toBe(LEVELS.CAUTION)
    expect(evaluateFactor('dark', fairPoint({ isDay: true })).level).toBe(LEVELS.OK)
  })
})

describe('evaluateActivity status precedence', () => {
  it('recommends a fair daytime hour', () => {
    const result = evaluateActivity(walkActivity, fairPoint())
    expect(result.status).toBe('recommended')
    expect(result.deciding).toHaveLength(0)
  })

  it('prefers avoid over caution over recommended', () => {
    const result = evaluateActivity(walkActivity, fairPoint({ precipitationProbability: 80, windSpeed: 22 }))
    expect(result.status).toBe('not-recommended')
    // Worst factor sorts first in `deciding`.
    expect(result.deciding[0].factorId).toBe('rain')
  })

  it('reports unknown only when no factor produced a judgement', () => {
    const bare = { condition: { group: 'unknown', label: 'Unknown' } }
    const result = evaluateActivity(walkActivity, bare)
    expect(result.status).toBe('unknown')
  })

  it('returns unknown for a null point without throwing', () => {
    const result = evaluateActivity(walkActivity, null)
    expect(result.status).toBe('unknown')
    expect(result.values).toBeNull()
  })

  it('applies per-activity threshold overrides (running acts earlier on heat than walking)', () => {
    const hot = fairPoint({ apparentTemperature: 31 })
    const ctx = { heatIndex: { status: 'unavailable', reasonKey: 'lowHumidity' } }
    expect(evaluateActivity(runActivity, hot, ctx).status).toBe('caution')
    expect(evaluateActivity(walkActivity, hot, ctx).status).toBe('recommended')
  })

  it('applies the cycling wind override', () => {
    const windy = fairPoint({ windSpeed: 18 })
    // Default wind caution starts at 20 km/h; cycling narrows it to 15.
    expect(evaluateActivity(cycleActivity, windy).status).toBe('caution')
    expect(evaluateActivity(walkActivity, windy).status).toBe('recommended')
  })

  it('exposes the values used so a recommendation can be explained', () => {
    const result = evaluateActivity(walkActivity, fairPoint({ precipitationProbability: 55 }))
    expect(result.values.precipitationProbability).toBe(55)
    expect(result.values.temperature).toBe(22)
    expect(result.deciding.map((r) => r.factorId)).toContain('rain')
  })
})

describe('evaluateActivities', () => {
  it('returns one evaluation per configured activity, in order', () => {
    const results = evaluateActivities(fairPoint())
    expect(results).toHaveLength(ACTIVITIES.length)
    expect(results.map((r) => r.activity.id)).toEqual(ACTIVITIES.map((a) => a.id))
  })

  it('never uses an avoid threshold lower than a caution threshold in the config', () => {
    for (const [id, def] of Object.entries({ rain: RAIN_THRESHOLDS, wind: WIND_THRESHOLDS, heat: HEAT_THRESHOLDS })) {
      expect(def.avoidAt, `${id} avoidAt must exceed cautionAt`).toBeGreaterThan(def.cautionAt)
    }
  })
})
