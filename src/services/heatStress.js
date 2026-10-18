/**
 * Documented heat-stress calculations (Member 2).
 *
 * Both functions are pure, unit-explicit and conservative: they return
 * `{ status: 'unavailable', reasonKey, params }` instead of a number whenever
 * an input is missing, out of range, or outside the formula's validated
 * window. The UI resolves `reasonKey` into English/Hindi copy; no fabricated
 * value is ever displayed.
 *
 * Heat index — Rothfusz regression (US National Weather Service):
 *   HI(°F) = -42.379 + 2.04901523·T + 10.14333127·RH - 0.22475541·T·RH
 *            - 0.00683783·T² - 0.05481717·RH² + 0.00122874·T²·RH
 *            + 0.00085282·T·RH² - 0.00000199·T²·RH²
 *   Computed only inside HEAT_INDEX_VALIDITY (T ≥ 27°C and RH ≥ 40%), the
 *   range where the NWS documents acceptable accuracy.
 *
 * Wet-bulb temperature — Stull, R. (2011), "An Elegant Wet-Bulb Temperature
 *   Estimated from the Temperature and Relative Humidity", J. Appl. Meteor.
 *   Climatol. 50(11):2267–2269. Valid for -20…50°C, 5…99% RH at sea-level
 *   pressure; assumes shaded, calm air (no radiation or wind term).
 *
 * Both values are ESTIMATES derived from forecast inputs, not measurements,
 * and must be labelled as such wherever they are shown.
 */

import {
  HEAT_INDEX_CATEGORIES,
  HEAT_INDEX_VALIDITY,
  WET_BULB_BANDS,
  WET_BULB_VALIDITY,
} from '../config/adaptiveThresholds.js'

/** Broad physical sanity window used before any formula runs. */
const PLAUSIBLE_TEMPERATURE_C = Object.freeze({ min: -90, max: 70 })
const PLAUSIBLE_HUMIDITY = Object.freeze({ min: 0, max: 100 })

export const METHODS = Object.freeze({
  heatIndex: 'Rothfusz regression (US National Weather Service)',
  wetBulb: 'Stull (2011) wet-bulb approximation',
})

export function celsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32
}

export function fahrenheitToCelsius(fahrenheit) {
  return ((fahrenheit - 32) * 5) / 9
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Returns 'invalid' | 'missing' | 'ok' for one input value. */
function classifyInput(value, { min, max }) {
  if (value === null || value === undefined || !isFiniteNumber(value)) return 'missing'
  if (value < min || value > max) return 'invalid'
  return 'ok'
}

function unavailable(reasonKey, params = undefined) {
  return { status: 'unavailable', reasonKey, params }
}

/* ------------------------------------------------------------- heat index -- */

/**
 * Estimate the heat index (°C) from air temperature and relative humidity.
 *
 * @param {{ temperature:number|null, relativeHumidity:number|null }} inputs  °C and %
 * @returns {{ status:'ok', valueC:number, valueF:number, categoryId:string|null,
 *             method:string, inputs:{ temperatureC:number, humidityPercent:number } }
 *           | { status:'unavailable', reasonKey:string, params?:object }}
 */
export function computeHeatIndex({ temperature, relativeHumidity }) {
  const tempCheck = classifyInput(temperature, PLAUSIBLE_TEMPERATURE_C)
  const humidityCheck = classifyInput(relativeHumidity, PLAUSIBLE_HUMIDITY)

  if (tempCheck === 'missing') return unavailable('missingTemperature')
  if (humidityCheck === 'missing') return unavailable('missingHumidity')
  if (tempCheck === 'invalid' || humidityCheck === 'invalid') return unavailable('invalidInput')

  if (temperature < HEAT_INDEX_VALIDITY.minTemperatureC) {
    return unavailable('belowValidity', {
      min: HEAT_INDEX_VALIDITY.minTemperatureC,
      value: Math.round(temperature),
    })
  }
  if (relativeHumidity < HEAT_INDEX_VALIDITY.minHumidityPercent) {
    return unavailable('lowHumidity', { value: Math.round(relativeHumidity) })
  }
  if (temperature > HEAT_INDEX_VALIDITY.maxTemperatureC || relativeHumidity > HEAT_INDEX_VALIDITY.maxHumidityPercent) {
    return unavailable('invalidInput')
  }

  const tF = celsiusToFahrenheit(temperature)
  const rh = relativeHumidity
  const heatIndexF =
    -42.379 +
    2.04901523 * tF +
    10.14333127 * rh -
    0.22475541 * tF * rh -
    0.00683783 * tF * tF -
    0.05481717 * rh * rh +
    0.00122874 * tF * tF * rh +
    0.00085282 * tF * rh * rh -
    0.00000199 * tF * tF * rh * rh

  if (!Number.isFinite(heatIndexF)) return unavailable('invalidInput')

  const valueF = Math.round(heatIndexF * 10) / 10
  const valueC = Math.round(fahrenheitToCelsius(heatIndexF) * 10) / 10
  const category = HEAT_INDEX_CATEGORIES.find((entry) => valueF >= entry.minF) ?? null

  return {
    status: 'ok',
    valueC,
    valueF,
    categoryId: category ? category.id : null,
    method: METHODS.heatIndex,
    inputs: { temperatureC: temperature, humidityPercent: relativeHumidity },
  }
}

/* -------------------------------------------------------------- wet bulb -- */

/**
 * Estimate the wet-bulb temperature (°C) from air temperature and humidity.
 *
 * @param {{ temperature:number|null, relativeHumidity:number|null }} inputs °C and %
 * @returns {{ status:'ok', valueC:number, bandId:string, method:string,
 *             inputs:{ temperatureC:number, humidityPercent:number } }
 *           | { status:'unavailable', reasonKey:string, params?:object }}
 */
export function computeWetBulb({ temperature, relativeHumidity }) {
  const tempCheck = classifyInput(temperature, PLAUSIBLE_TEMPERATURE_C)
  const humidityCheck = classifyInput(relativeHumidity, PLAUSIBLE_HUMIDITY)

  if (tempCheck === 'missing') return unavailable('missingTemperature')
  if (humidityCheck === 'missing') return unavailable('missingHumidity')
  if (tempCheck === 'invalid' || humidityCheck === 'invalid') return unavailable('invalidInput')

  if (temperature < WET_BULB_VALIDITY.minTemperatureC) {
    return unavailable('temperatureBelowRange', {
      min: WET_BULB_VALIDITY.minTemperatureC,
      value: Math.round(temperature),
    })
  }
  if (temperature > WET_BULB_VALIDITY.maxTemperatureC) {
    return unavailable('temperatureAboveRange', {
      max: WET_BULB_VALIDITY.maxTemperatureC,
      value: Math.round(temperature),
    })
  }
  if (relativeHumidity < WET_BULB_VALIDITY.minHumidityPercent) {
    return unavailable('humidityBelowRange', {
      min: WET_BULB_VALIDITY.minHumidityPercent,
      value: Math.round(relativeHumidity),
    })
  }
  if (relativeHumidity > WET_BULB_VALIDITY.maxHumidityPercent) {
    return unavailable('humidityAboveRange', {
      max: WET_BULB_VALIDITY.maxHumidityPercent,
      value: Math.round(relativeHumidity),
    })
  }

  const t = temperature
  const rh = relativeHumidity
  const wetBulbC =
    t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035

  if (!Number.isFinite(wetBulbC)) return unavailable('invalidInput')

  const valueC = Math.round(wetBulbC * 10) / 10
  const band = WET_BULB_BANDS.find((entry) => valueC >= entry.minC) ?? WET_BULB_BANDS[WET_BULB_BANDS.length - 1]

  return {
    status: 'ok',
    valueC,
    bandId: band.id,
    method: METHODS.wetBulb,
    inputs: { temperatureC: temperature, humidityPercent: relativeHumidity },
  }
}
