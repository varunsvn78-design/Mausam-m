import { describe, expect, it } from 'vitest'
import {
  buildExercisePlan,
  classifyAqi,
  describeAirQuality,
  evaluateExerciseHour,
  groupIntoWindows,
  joinExerciseHours,
} from './airQualityAdvisor.js'

const DATE = '2026-10-19'

function aqPoint(hour, usAqi, pm25 = 20) {
  return { time: `${DATE}T${String(hour).padStart(2, '0')}:00`, usAqi, pm25, pm10: pm25 * 2 }
}

function wxPoint(hour, { rainProbability = 5, windSpeed = 8, group = 'clear', isDay = true, temperature = 25 } = {}) {
  return {
    time: `${DATE}T${String(hour).padStart(2, '0')}:00`,
    isDay,
    temperature,
    relativeHumidity: 50,
    windSpeed,
    precipitation: 0,
    precipitationProbability: rainProbability,
    weatherCode: 0,
    condition: { group },
  }
}

function makeAirQuality(points) {
  return { hourly: points, current: points[0] ?? null }
}

function makeWeather(points) {
  return { hourly: points, current: { time: `${DATE}T08:00` } }
}

describe('classifyAqi', () => {
  it('matches the US EPA band boundaries', () => {
    expect(classifyAqi(0).id).toBe('good')
    expect(classifyAqi(50).id).toBe('good')
    expect(classifyAqi(51).id).toBe('moderate')
    expect(classifyAqi(100).id).toBe('moderate')
    expect(classifyAqi(101).id).toBe('unhealthy-sensitive')
    expect(classifyAqi(150).id).toBe('unhealthy-sensitive')
    expect(classifyAqi(151).id).toBe('unhealthy')
    expect(classifyAqi(201).id).toBe('very-unhealthy')
    expect(classifyAqi(301).id).toBe('hazardous')
    expect(classifyAqi(500).id).toBe('hazardous')
  })

  it('returns null for missing or unusable values', () => {
    expect(classifyAqi(null)).toBeNull()
    expect(classifyAqi(undefined)).toBeNull()
    expect(classifyAqi(Number.NaN)).toBeNull()
    expect(classifyAqi(-5)).toBeNull()
    expect(classifyAqi('80')).toBeNull()
  })
})

describe('describeAirQuality', () => {
  it('returns band, label, advice and precautions for a reading', () => {
    const result = describeAirQuality({ time: 't', usAqi: 120, pm25: 45, pm10: 90 })
    expect(result.bandId).toBe('unhealthy-sensitive')
    expect(result.label).toBe('Unhealthy for sensitive groups')
    expect(result.advice).toBeTruthy()
    expect(result.precautions.length).toBeGreaterThan(0)
  })

  it('returns null when nothing measurable is present', () => {
    expect(describeAirQuality(null)).toBeNull()
    expect(describeAirQuality({ usAqi: null, pm25: null, pm10: null })).toBeNull()
  })

  it('still reports pollutants when the index is missing', () => {
    const result = describeAirQuality({ usAqi: null, pm25: 30, pm10: 60 })
    expect(result.usAqi).toBeNull()
    expect(result.bandId).toBeNull()
    expect(result.label).toBe('Air quality not available')
    expect(result.pm25).toBe(30)
  })
})

describe('evaluateExerciseHour', () => {
  const good = { usAqi: 40, rainProbability: 5, windSpeed: 6, conditionGroup: 'clear', isDay: true }

  it('recommends a good-AQ, dry, calm daytime hour', () => {
    const result = evaluateExerciseHour(good)
    expect(result.verdict).toBe('recommended')
    expect(result.reasons.map((r) => r.id)).toContain('aqiGood')
  })

  it('blocks thunderstorms regardless of air quality', () => {
    const result = evaluateExerciseHour({ ...good, conditionGroup: 'thunderstorm' })
    expect(result.verdict).toBe('not-recommended')
    expect(result.reasons.map((r) => r.id)).toContain('thunderstorm')
  })

  it('blocks hours with likely rain, strong wind or unhealthy AQ', () => {
    expect(evaluateExerciseHour({ ...good, rainProbability: 75 }).verdict).toBe('not-recommended')
    expect(evaluateExerciseHour({ ...good, windSpeed: 40 }).verdict).toBe('not-recommended')
    expect(evaluateExerciseHour({ ...good, usAqi: 160 }).verdict).toBe('not-recommended')
  })

  it('downgrades to caution for sensitive bands, possible rain, breeze and darkness', () => {
    expect(evaluateExerciseHour({ ...good, usAqi: 120 }).verdict).toBe('caution')
    expect(evaluateExerciseHour({ ...good, usAqi: 120 }).reasons.map((r) => r.id)).toContain('aqiSensitive')
    expect(evaluateExerciseHour({ ...good, rainProbability: 50 }).verdict).toBe('caution')
    expect(evaluateExerciseHour({ ...good, rainProbability: 50 }).reasons.map((r) => r.id)).toContain('rainPossible')
    expect(evaluateExerciseHour({ ...good, windSpeed: 22 }).verdict).toBe('caution')
    expect(evaluateExerciseHour({ ...good, isDay: false }).verdict).toBe('caution')
    expect(evaluateExerciseHour({ ...good, isDay: false }).reasons.map((r) => r.id)).toContain('night')
  })

  it('never recommends when the AQI value is missing', () => {
    const result = evaluateExerciseHour({ ...good, usAqi: null })
    expect(result.verdict).toBe('caution')
    expect(result.reasons.map((r) => r.id)).toContain('missingAqi')
  })

  it('returns unknown when neither AQ nor weather facts exist', () => {
    const result = evaluateExerciseHour({})
    expect(result.verdict).toBe('unknown')
    expect(result.reasons.map((r) => r.id)).toEqual(expect.arrayContaining(['missingAqi', 'missingWeather']))
  })

  it('downgrades to caution when weather facts are missing but AQ is good', () => {
    const result = evaluateExerciseHour({ usAqi: 40 })
    expect(result.verdict).toBe('caution')
    expect(result.reasons.map((r) => r.id)).toContain('missingWeather')
  })
})

describe('joinExerciseHours', () => {
  it('joins AQ and weather by hour for the requested date', () => {
    const airQuality = makeAirQuality([aqPoint(0, 40), aqPoint(1, 120)])
    const weather = makeWeather([wxPoint(0), wxPoint(1, { rainProbability: 80 })])
    const hours = joinExerciseHours({ airQuality, weather }, DATE)
    expect(hours).toHaveLength(2)
    expect(hours[0]).toMatchObject({ hour: 0, usAqi: 40, verdict: 'recommended' })
    expect(hours[1]).toMatchObject({ hour: 1, usAqi: 120, verdict: 'not-recommended' })
  })

  it('keeps nulls for fields missing from one source', () => {
    const airQuality = makeAirQuality([aqPoint(3, 60)])
    const weather = makeWeather([wxPoint(4)])
    const hours = joinExerciseHours({ airQuality, weather }, DATE)
    expect(hours).toHaveLength(2)
    expect(hours[0]).toMatchObject({ hour: 3, usAqi: 60, windSpeed: null })
    expect(hours[1]).toMatchObject({ hour: 4, usAqi: null, windSpeed: 8 })
  })

  it('ignores hours belonging to other dates and returns [] without a date', () => {
    const airQuality = makeAirQuality([{ time: '2026-10-18T05:00', usAqi: 40 }])
    const weather = makeWeather([wxPoint(5)])
    expect(joinExerciseHours({ airQuality, weather }, DATE).map((h) => h.hour)).toEqual([5])
    expect(joinExerciseHours({ airQuality: {}, weather: {} })).toEqual([])
  })
})

describe('groupIntoWindows', () => {
  it('groups consecutive same-verdict hours in hour order', () => {
    const windows = groupIntoWindows([
      { hour: 7, verdict: 'recommended' },
      { hour: 6, verdict: 'recommended' },
      { hour: 9, verdict: 'caution' },
      { hour: 8, verdict: 'recommended' },
    ])
    expect(windows).toHaveLength(2)
    expect(windows[0]).toMatchObject({ startHour: 6, endHour: 8, verdict: 'recommended' })
    expect(windows[0].hours).toHaveLength(3)
    expect(windows[1]).toMatchObject({ startHour: 9, endHour: 9, verdict: 'caution' })
  })

  it('returns an empty array for no hours', () => {
    expect(groupIntoWindows([])).toEqual([])
  })
})

describe('buildExercisePlan', () => {
  it('reports unavailable when there is no usable data', () => {
    const plan = buildExercisePlan({ airQuality: { hourly: [] }, weather: { hourly: [] }, date: DATE })
    expect(plan.status).toBe('unavailable')
    expect(plan.bestWindow).toBeNull()
  })

  it('builds windows, counts and the longest recommended window', () => {
    const airQuality = makeAirQuality([aqPoint(6, 35), aqPoint(7, 35), aqPoint(8, 160)])
    const weather = makeWeather([wxPoint(6), wxPoint(7), wxPoint(8)])
    const plan = buildExercisePlan({ airQuality, weather, date: DATE })
    expect(plan.status).toBe('ok')
    expect(plan.date).toBe(DATE)
    expect(plan.counts.recommended).toBe(2)
    expect(plan.counts['not-recommended']).toBe(1)
    expect(plan.bestWindow).toMatchObject({ startHour: 6, endHour: 7, verdict: 'recommended' })
  })

  it('does not offer recommended windows shorter than the minimum length', () => {
    const airQuality = makeAirQuality([aqPoint(6, 35)])
    const weather = makeWeather([wxPoint(6)])
    const plan = buildExercisePlan({ airQuality, weather, date: DATE })
    expect(plan.windows[0].verdict).toBe('recommended')
    expect(plan.recommendedWindows).toHaveLength(0)
    expect(plan.bestWindow).toBeNull()
  })
})
