import { describe, expect, it } from 'vitest'
import { aggregateRainFromHourly, buildFarmPlan, evaluateOperation } from './farmerPlanner.js'

const D1 = '2026-10-19'
const D2 = '2026-10-20'

function pad(hour) {
  return String(hour).padStart(2, '0')
}

function wxHour(date, hour, { precipitation = 0, precipitationProbability = 5, temperature = 25 } = {}) {
  return {
    time: `${date}T${pad(hour)}:00`,
    isDay: true,
    temperature,
    apparentTemperature: temperature,
    relativeHumidity: 50,
    windSpeed: 8,
    precipitation,
    precipitationProbability,
    weatherCode: 0,
    condition: { group: 'clear' },
  }
}

function daily(date, { precipitationProbability = 10, temperatureMax = 30, temperatureMin = 20 } = {}) {
  return {
    date,
    time: date,
    weatherCode: 0,
    condition: { group: 'clear' },
    temperatureMax,
    temperatureMin,
    precipitationProbability,
    windSpeedMax: 10,
    sunrise: null,
    sunset: null,
  }
}

function weatherFor({ daily: dailyEntries = [], hourly = [] } = {}) {
  return {
    location: { id: 'farm', latitude: 20, longitude: 75 },
    timezone: 'Asia/Kolkata',
    fetchedAt: '2026-10-19T06:00:00.000Z',
    daily: dailyEntries,
    hourly,
    current: { time: `${D1}T06:00` },
  }
}

describe('aggregateRainFromHourly', () => {
  it('sums precipitation for the requested date and reports wet hours', () => {
    const hourly = Array.from({ length: 24 }, (_, hour) => wxHour(D1, hour))
    hourly[3].precipitation = 2
    hourly[4].precipitation = 3
    hourly[5].precipitation = 1.5

    const result = aggregateRainFromHourly(weatherFor({ hourly }), D1)
    expect(result.rainMm).toBe(6.5)
    expect(result.wetHours).toBe(3)
    expect(result.maxHourlyMm).toBe(3)
    expect(result.hoursWithData).toBe(24)
    expect(result.complete).toBe(true)
  })

  it('flags incomplete days when only some hours carry data', () => {
    const result = aggregateRainFromHourly(weatherFor({ hourly: [wxHour(D1, 0, { precipitation: 4 })] }), D1)
    expect(result.rainMm).toBe(4)
    expect(result.hoursWithData).toBe(1)
    expect(result.complete).toBe(false)
  })

  it('returns null totals when nothing usable is present', () => {
    const allNull = Array.from({ length: 24 }, (_, hour) => {
      const point = wxHour(D1, hour)
      point.precipitation = null
      return point
    })
    expect(aggregateRainFromHourly(weatherFor({ hourly: allNull }), D1).rainMm).toBeNull()
    expect(aggregateRainFromHourly(weatherFor({ hourly: [] }), D1).rainMm).toBeNull()
    expect(aggregateRainFromHourly(null, D1).rainMm).toBeNull()
  })

  it('ignores hours from other dates', () => {
    const hourly = [wxHour(D1, 0, { precipitation: 5 }), wxHour(D2, 0, { precipitation: 9 })]
    expect(aggregateRainFromHourly(weatherFor({ hourly }), D1).rainMm).toBe(5)
  })
})

describe('evaluateOperation', () => {
  const base = { rainMm: 0, rainProbabilityMax: 10, temperatureMax: 28, hasHourlyDetail: true }

  it('pauses irrigation ahead of heavy rain or a high rain chance', () => {
    const heavy = evaluateOperation('irrigation', { ...base, rainMm: 25 })
    expect(heavy.verdict).toBe('pause')
    expect(heavy.reasons.map((r) => r.id)).toContain('heavyRain')

    const likely = evaluateOperation('irrigation', { ...base, rainProbabilityMax: 80 })
    expect(likely.verdict).toBe('pause')
    expect(likely.reasons.map((r) => r.id)).toContain('irrigationPauseRain')
  })

  it('flags irrigation as caution on light rain and suitable when dry', () => {
    expect(evaluateOperation('irrigation', { ...base, rainMm: 1 }).verdict).toBe('caution')
    expect(evaluateOperation('irrigation', base).verdict).toBe('suitable')
  })

  it('adds an evaporation note to suitable irrigation on hot days', () => {
    const result = evaluateOperation('irrigation', { ...base, temperatureMax: 37 })
    expect(result.verdict).toBe('suitable')
    expect(result.reasons.map((r) => r.id)).toContain('highEvaporation')
  })

  it('rates sowing unsuitable after moderate rain and cautious on light rain', () => {
    const wet = evaluateOperation('sowing', { ...base, rainMm: 15 })
    expect(wet.verdict).toBe('unsuitable')
    expect(wet.reasons.map((r) => r.id)).toContain('soilWet')

    const light = evaluateOperation('sowing', { ...base, rainMm: 1 })
    expect(light.verdict).toBe('caution')
    expect(light.reasons.map((r) => r.id)).toContain('soilWet')

    expect(evaluateOperation('sowing', base).verdict).toBe('suitable')
  })

  it('protects harvest from any rain and high rain chance', () => {
    expect(evaluateOperation('harvest', { ...base, rainMm: 15 }).verdict).toBe('unsuitable')
    expect(evaluateOperation('harvest', { ...base, rainMm: 15 }).reasons.map((r) => r.id)).toContain('cropWet')
    expect(evaluateOperation('harvest', { ...base, rainMm: 1 }).verdict).toBe('pause')
    expect(evaluateOperation('harvest', { ...base, rainProbabilityMax: 75 }).verdict).toBe('pause')
    expect(evaluateOperation('harvest', { ...base, rainProbabilityMax: 50 }).verdict).toBe('caution')
    expect(evaluateOperation('harvest', base).verdict).toBe('suitable')
  })

  it('returns unknown when no facts are available and explains which data is missing', () => {
    const noHourly = evaluateOperation('harvest', { rainMm: null, rainProbabilityMax: null, temperatureMax: null, hasHourlyDetail: false })
    expect(noHourly.verdict).toBe('unknown')
    expect(noHourly.reasons.map((r) => r.id)).toContain('noHourlyData')

    const withHourly = evaluateOperation('harvest', { rainMm: null, rainProbabilityMax: null, temperatureMax: null, hasHourlyDetail: true })
    expect(withHourly.reasons.map((r) => r.id)).toContain('noDailyData')
  })

  it('throws for an unknown operation id', () => {
    expect(() => evaluateOperation('fishing', base)).toThrowError(/Unknown farm operation/)
  })

  it('never leaves unreplaced placeholders in reason text', () => {
    const cases = [
      { ...base, rainMm: 25 },
      { ...base, rainMm: 15 },
      { ...base, rainMm: 1 },
      { ...base, rainProbabilityMax: 80 },
      { ...base, rainProbabilityMax: 50 },
      { ...base, temperatureMax: 37 },
    ]
    for (const facts of cases) {
      for (const op of ['irrigation', 'sowing', 'harvest']) {
        for (const r of evaluateOperation(op, facts).reasons) {
          expect(r.text).not.toMatch(/\{\w+\}/)
        }
      }
    }
  })
})

describe('buildFarmPlan', () => {
  it('returns an unavailable plan without weather and keeps the disclaimer', () => {
    const plan = buildFarmPlan(null)
    expect(plan.status).toBe('unavailable')
    expect(plan.days).toEqual([])
    expect(plan.disclaimer).toMatch(/not agronomic advice/i)
    expect(plan.operations.map((op) => op.id)).toEqual(['irrigation', 'sowing', 'harvest'])
  })

  it('builds one entry per forecast day with all three operation windows', () => {
    const hourly = [
      ...Array.from({ length: 24 }, (_, h) => wxHour(D1, h)),
      ...Array.from({ length: 24 }, (_, h) => wxHour(D2, h, { precipitation: h < 4 ? 2 : 0 })),
    ]
    const plan = buildFarmPlan(weatherFor({ daily: [daily(D1), daily(D2, { precipitationProbability: 65 })], hourly }))

    expect(plan.status).toBe('ok')
    expect(plan.days).toHaveLength(2)
    expect(plan.days[0].rainMm).toBe(0)
    expect(plan.days[1].rainMm).toBe(8)
    expect(plan.days[1].wetHours).toBe(4)
    for (const day of plan.days) {
      expect(Object.keys(day.windows).sort()).toEqual(['harvest', 'irrigation', 'sowing'])
      expect(day.windows.irrigation.verdict).toBeTruthy()
    }
    expect(plan.verdictLabels.suitable).toBe('Suitable')
    expect(plan.fetchedAt).toBe('2026-10-19T06:00:00.000Z')
  })

  it('falls back to hourly dates when the daily block is empty', () => {
    const hourly = Array.from({ length: 6 }, (_, h) => wxHour(D1, h, { precipitation: 1 }))
    const plan = buildFarmPlan(weatherFor({ daily: [], hourly }))
    expect(plan.status).toBe('ok')
    expect(plan.days).toHaveLength(1)
    expect(plan.days[0].rainMm).toBe(6)
    expect(plan.days[0].rainProbabilityMax).toBeNull()
    expect(plan.days[0].temperatureMax).toBeNull()
  })

  it('is unavailable when neither daily nor hourly data exists', () => {
    expect(buildFarmPlan(weatherFor({ daily: [], hourly: [] })).status).toBe('unavailable')
  })
})
