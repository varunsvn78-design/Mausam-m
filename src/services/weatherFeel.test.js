import { describe, expect, it } from 'vitest'
import { classifyFeel, describeWeatherFeel } from './weatherFeel.js'

function reasonIds(result) {
  return result.reasons.map((r) => r.id)
}

describe('classifyFeel', () => {
  it('maps effective temperature to the configured bands', () => {
    expect(classifyFeel(40).categoryId).toBe('extreme-heat')
    expect(classifyFeel(33).categoryId).toBe('very-hot')
    expect(classifyFeel(30).categoryId).toBe('hot')
    expect(classifyFeel(24).categoryId).toBe('warm')
    expect(classifyFeel(23.9).categoryId).toBe('pleasant')
    expect(classifyFeel(12).categoryId).toBe('cool')
    expect(classifyFeel(5).categoryId).toBe('cold')
    expect(classifyFeel(4.9).categoryId).toBe('freezing')
  })

  it('adds humid and dry variants only for warm/hot bands', () => {
    expect(classifyFeel(30, { relativeHumidity: 80 }).label).toContain('humid')
    expect(classifyFeel(30, { relativeHumidity: 25 }).label).toContain('dry')
    expect(classifyFeel(12, { relativeHumidity: 80 }).label).not.toContain('humid')
  })

  it('adds a windy variant to cool values and a breezy variant to warm ones', () => {
    expect(classifyFeel(8, { windSpeed: 30 }).categoryId).toContain('windy')
    expect(classifyFeel(26, { windSpeed: 18 }).label).toContain('breezy')
    expect(classifyFeel(8, { windSpeed: 5 }).label).not.toContain('breezy')
  })
})

describe('describeWeatherFeel', () => {
  it('uses the heat index for hot, humid hours and reports the source', () => {
    const result = describeWeatherFeel({ temperature: 34, relativeHumidity: 80, windSpeed: 5 })
    expect(result.status).toBe('ok')
    expect(result.feelsLikeSource).toBe('heat-index')
    expect(result.feelsLikeC).toBeGreaterThan(34)
    expect(result.label).toContain('humid')
    expect(reasonIds(result)).toContain('heatIndexUsed')
    expect(reasonIds(result)).toContain('highHumidity')
    expect(result.estimateLabel).toBeTruthy()
  })

  it('prefers the apparent temperature when it reports a stronger effect than the heat index', () => {
    const result = describeWeatherFeel({ temperature: 34, relativeHumidity: 80, apparentTemperature: 60, windSpeed: 10 })
    expect(result.feelsLikeSource).toBe('apparent-temperature')
    expect(result.feelsLikeC).toBe(60)
  })

  it('falls back to apparent temperature when the heat index is out of its valid range', () => {
    const result = describeWeatherFeel({ temperature: 20, relativeHumidity: 50, apparentTemperature: 21, windSpeed: 8 })
    expect(result.feelsLikeSource).toBe('apparent-temperature')
    expect(result.feelsLikeC).toBe(21)
    expect(reasonIds(result)).toContain('heatIndexUnavailable')
  })

  it('falls back to air temperature and flags wind when humidity is missing', () => {
    const result = describeWeatherFeel({ temperature: 8, windSpeed: 30 })
    expect(result.feelsLikeSource).toBe('air-temperature')
    expect(result.feelsLikeC).toBe(8)
    expect(result.label).toContain('windy')
    expect(reasonIds(result)).toContain('humidityMissing')
  })

  it('flags a dry variant when hot air has low humidity', () => {
    const result = describeWeatherFeel({ temperature: 33, relativeHumidity: 25 })
    expect(result.feelsLikeC).toBe(33)
    expect(result.label).toContain('dry')
    expect(reasonIds(result)).toContain('lowHumidity')
  })

  it('returns unavailable with a reason when temperature is missing', () => {
    const result = describeWeatherFeel({ relativeHumidity: 80, windSpeed: 5 })
    expect(result.status).toBe('unavailable')
    expect(result.reasonKey).toBe('missingTemperature')
    expect(result.feelsLikeC).toBeNull()
    expect(result.feelsLikeSource).toBeNull()
    expect(result.estimateLabel).toBeTruthy()
  })

  it('notes missing wind but still returns a feel based on air temperature', () => {
    const result = describeWeatherFeel({ temperature: 22, relativeHumidity: 55 })
    expect(result.status).toBe('ok')
    expect(reasonIds(result)).toContain('windMissing')
  })

  it('handles no arguments at all', () => {
    const result = describeWeatherFeel()
    expect(result.status).toBe('unavailable')
    expect(result.feelsLikeC).toBeNull()
  })
})
