import { describe, expect, it } from 'vitest'
import {
  celsiusToFahrenheit,
  computeHeatIndex,
  computeWetBulb,
  fahrenheitToCelsius,
} from './heatStress.js'
import {
  HEAT_INDEX_VALIDITY,
  WET_BULB_VALIDITY,
} from '../config/adaptiveThresholds.js'

describe('temperature conversions', () => {
  it('round-trips Celsius <-> Fahrenheit', () => {
    expect(celsiusToFahrenheit(0)).toBeCloseTo(32, 5)
    expect(celsiusToFahrenheit(100)).toBeCloseTo(212, 5)
    expect(fahrenheitToCelsius(32)).toBeCloseTo(0, 5)
    expect(fahrenheitToCelsius(celsiusToFahrenheit(27))).toBeCloseTo(27, 5)
  })
})

describe('computeHeatIndex (Rothfusz)', () => {
  it('returns unavailable when an input is missing', () => {
    expect(computeHeatIndex({ temperature: null, relativeHumidity: 55 }).reasonKey).toBe('missingTemperature')
    expect(computeHeatIndex({ temperature: 30, relativeHumidity: null }).reasonKey).toBe('missingHumidity')
  })

  it('returns unavailable below the documented validity window', () => {
    expect(computeHeatIndex({ temperature: 20, relativeHumidity: 60 }).reasonKey).toBe('belowValidity')
    expect(computeHeatIndex({ temperature: 30, relativeHumidity: 20 }).reasonKey).toBe('lowHumidity')
  })

  it('rejects physically implausible inputs', () => {
    expect(computeHeatIndex({ temperature: 200, relativeHumidity: 50 }).reasonKey).toBe('invalidInput')
    expect(computeHeatIndex({ temperature: 30, relativeHumidity: 150 }).reasonKey).toBe('invalidInput')
  })

  it('computes a value inside the validity window and never below air temperature', () => {
    const result = computeHeatIndex({ temperature: 32, relativeHumidity: 70 })
    expect(result.status).toBe('ok')
    expect(result.valueC).toBeGreaterThanOrEqual(32)
    expect(result.method).toContain('Rothfusz')
    expect(result.inputs).toEqual({ temperatureC: 32, humidityPercent: 70 })
  })

  it('rises with humidity at a fixed temperature', () => {
    const humid = computeHeatIndex({ temperature: 33, relativeHumidity: 85 })
    const drier = computeHeatIndex({ temperature: 33, relativeHumidity: 50 })
    expect(humid.status).toBe('ok')
    expect(drier.status).toBe('ok')
    expect(humid.valueC).toBeGreaterThan(drier.valueC)
  })

  it('maps high heat index values into an NWS category', () => {
    const result = computeHeatIndex({ temperature: 40, relativeHumidity: 80 })
    expect(result.status).toBe('ok')
    expect(result.categoryId).not.toBeNull()
  })

  it('accepts the exact lower validity boundaries', () => {
    const result = computeHeatIndex({
      temperature: HEAT_INDEX_VALIDITY.minTemperatureC,
      relativeHumidity: HEAT_INDEX_VALIDITY.minHumidityPercent,
    })
    expect(result.status).toBe('ok')
  })
})

describe('computeWetBulb (Stull 2011)', () => {
  it('returns unavailable when an input is missing', () => {
    expect(computeWetBulb({ temperature: null, relativeHumidity: 55 }).reasonKey).toBe('missingTemperature')
    expect(computeWetBulb({ temperature: 25, relativeHumidity: null }).reasonKey).toBe('missingHumidity')
  })

  it('enforces its own validity window', () => {
    expect(computeWetBulb({ temperature: 60, relativeHumidity: 50 }).reasonKey).toBe('temperatureAboveRange')
    expect(computeWetBulb({ temperature: -30, relativeHumidity: 50 }).reasonKey).toBe('temperatureBelowRange')
    expect(computeWetBulb({ temperature: 25, relativeHumidity: 1 }).reasonKey).toBe('humidityBelowRange')
    expect(computeWetBulb({ temperature: 25, relativeHumidity: 100 }).reasonKey).toBe('humidityAboveRange')
  })

  it('is always at or below dry-bulb temperature', () => {
    const result = computeWetBulb({ temperature: 30, relativeHumidity: 60 })
    expect(result.status).toBe('ok')
    expect(result.valueC).toBeLessThanOrEqual(30)
    expect(result.method).toContain('Stull')
  })

  it('approaches the dry-bulb temperature at saturation', () => {
    const result = computeWetBulb({ temperature: 30, relativeHumidity: WET_BULB_VALIDITY.maxHumidityPercent })
    expect(result.status).toBe('ok')
    expect(result.valueC).toBeGreaterThan(28)
  })

  it('assigns a band id based on the estimate', () => {
    // Stull(36°C, 80%) ≈ 32.9°C, which falls in the 'severe' band (≥30, <35).
    const result = computeWetBulb({ temperature: 36, relativeHumidity: 80 })
    expect(result.status).toBe('ok')
    expect(result.valueC).toBeCloseTo(32.9, 0)
    expect(result.bandId).toBe('severe')
  })

  it('accepts the exact upper validity boundaries', () => {
    const result = computeWetBulb({
      temperature: WET_BULB_VALIDITY.maxTemperatureC,
      relativeHumidity: WET_BULB_VALIDITY.maxHumidityPercent,
    })
    expect(result.status).toBe('ok')
  })
})
