/**
 * Weather-Feel Intelligence (Member 4) — pure logic.
 *
 * Describes how conditions are likely to FEEL for the selected hour, using
 * only forecast inputs:
 *
 *   1. heat index (Rothfusz, via heatStress.js) when its validated window
 *      covers the inputs — temperature + humidity,
 *   2. else the model's apparent temperature (temperature + humidity + wind),
 *   3. else the air temperature itself.
 *
 * The chosen source is always reported (`feelsLikeSource`) so the UI can
 * label the number as an estimate and never present it as a measurement.
 * Heat index / wet-bulb calculations stay in heatStress.js — nothing is
 * duplicated here.
 *
 * Public API:
 *   describeWeatherFeel({ temperature, relativeHumidity, windSpeed, apparentTemperature })
 *     -> { status:'ok'|'unavailable', reasonKey?, categoryId?, label?, detail?,
 *          feelsLikeC, feelsLikeSource, unit, reasons:[{id,text}], estimateLabel }
 */

import {
  FEEL_BANDS,
  FEEL_CATEGORIES,
  FEEL_ESTIMATE_LABEL,
  FEEL_HUMIDITY,
  FEEL_REASON_TEXT,
  FEEL_VARIANTS,
  FEEL_WIND,
} from '../config/weatherFeel.js'
import { computeHeatIndex } from './heatStress.js'

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function reason(id) {
  return { id, text: FEEL_REASON_TEXT[id] ?? id }
}

/**
 * Resolve which estimate describes "feels like" for this hour.
 * @returns {{ valueC:number|null, source:'heat-index'|'apparent-temperature'|'air-temperature'|null, reasons:Array }}
 */
function resolveFeelsLike({ temperature, relativeHumidity, apparentTemperature }) {
  const reasons = []

  if (isFiniteNumber(temperature)) {
    const heatIndex = computeHeatIndex({ temperature, relativeHumidity })
    if (heatIndex.status === 'ok') {
      if (isFiniteNumber(apparentTemperature) && apparentTemperature > heatIndex.valueC) {
        // The model's apparent temperature accounts for wind too; only prefer
        // it when it reports a stronger effect than humidity alone. Report the
        // reason that actually matches the chosen source, so the "Why" list
        // never contradicts the provenance label.
        reasons.push(reason('apparentUsed'))
        return { valueC: apparentTemperature, source: 'apparent-temperature', reasons }
      }
      reasons.push(reason('heatIndexUsed'))
      return { valueC: heatIndex.valueC, source: 'heat-index', reasons }
    }
    if (heatIndex.reasonKey && heatIndex.reasonKey !== 'missingTemperature' && heatIndex.reasonKey !== 'missingHumidity') {
      // belowValidity / lowHumidity / invalidInput — expected outside the
      // Rothfusz window; fall through to apparent temperature.
      reasons.push(reason('heatIndexUnavailable'))
    }
  }

  if (isFiniteNumber(apparentTemperature)) {
    reasons.push(reason('apparentUsed'))
    return { valueC: apparentTemperature, source: 'apparent-temperature', reasons }
  }

  if (isFiniteNumber(temperature)) {
    reasons.push(reason('airTemperatureUsed'))
    return { valueC: temperature, source: 'air-temperature', reasons }
  }

  return { valueC: null, source: null, reasons }
}

/**
 * Classify a feels-like value into a category (+ humidity/wind variant).
 * Exported for tests.
 *
 * @param {number} feelsLikeC
 * @param {{ relativeHumidity?:number|null, windSpeed?:number|null }} conditions
 * @returns {{ categoryId:string, label:string, detail:string }}
 */
export function classifyFeel(feelsLikeC, { relativeHumidity, windSpeed } = {}) {
  const band = FEEL_BANDS.find((entry) => feelsLikeC >= entry.min) ?? FEEL_BANDS[FEEL_BANDS.length - 1]
  const base = FEEL_CATEGORIES[band.id]
  let categoryId = band.id
  let suffix = ''
  let detailSuffix = ''

  if (isFiniteNumber(relativeHumidity) && (band.id === 'hot' || band.id === 'very-hot' || band.id === 'extreme-heat' || band.id === 'warm')) {
    if (relativeHumidity >= FEEL_HUMIDITY.humidAt) {
      categoryId = `${band.id}-humid`
      suffix = FEEL_VARIANTS.humid.suffix
      detailSuffix = FEEL_VARIANTS.humid.detailSuffix
    } else if (relativeHumidity <= FEEL_HUMIDITY.dryAt) {
      categoryId = `${band.id}-dry`
      suffix = FEEL_VARIANTS.dry.suffix
      detailSuffix = FEEL_VARIANTS.dry.detailSuffix
    }
  }

  const COOLING_WIND_MAX_C = 24 // below the 'warm' band wind mainly adds chill
  if (isFiniteNumber(windSpeed) && windSpeed >= FEEL_WIND.windyAt && feelsLikeC < COOLING_WIND_MAX_C) {
    // Wind matters most for cool/cold comfort (wind-chill story).
    categoryId = `${categoryId}-windy`
    suffix = `${suffix}${FEEL_VARIANTS.windy.suffix}`
    detailSuffix = `${detailSuffix}${FEEL_VARIANTS.windy.detailSuffix}`
  } else if (isFiniteNumber(windSpeed) && windSpeed >= FEEL_WIND.breezyAt && feelsLikeC >= COOLING_WIND_MAX_C) {
    suffix = `${suffix}${FEEL_VARIANTS.breezy.suffix}`
    detailSuffix = `${detailSuffix}${FEEL_VARIANTS.breezy.detailSuffix}`
  }

  return {
    categoryId,
    label: `${base.label}${suffix}`,
    detail: `${base.detail}${detailSuffix}`,
  }
}

/**
 * Describe the weather feel for one hour.
 *
 * @param {{
 *   temperature?:number|null,        // °C
 *   relativeHumidity?:number|null,   // %
 *   windSpeed?:number|null,          // km/h
 *   apparentTemperature?:number|null // °C
 * }} inputs NormalizedWeather hourly values (any may be missing)
 */
export function describeWeatherFeel(inputs = {}) {
  const { temperature, relativeHumidity, windSpeed, apparentTemperature } = inputs

  const { valueC, source, reasons } = resolveFeelsLike({
    temperature: isFiniteNumber(temperature) ? temperature : null,
    relativeHumidity: isFiniteNumber(relativeHumidity) ? relativeHumidity : null,
    apparentTemperature: isFiniteNumber(apparentTemperature) ? apparentTemperature : null,
  })

  if (valueC === null) {
    return {
      status: 'unavailable',
      reasonKey: 'missingTemperature',
      reasons: [reason('missingTemperature'), ...reasons],
      feelsLikeC: null,
      feelsLikeSource: null,
      unit: '°C',
      estimateLabel: FEEL_ESTIMATE_LABEL,
    }
  }

  if (!isFiniteNumber(relativeHumidity)) reasons.push(reason('humidityMissing'))
  if (!isFiniteNumber(windSpeed)) reasons.push(reason('windMissing'))
  if (isFiniteNumber(relativeHumidity) && relativeHumidity >= FEEL_HUMIDITY.humidAt) reasons.push(reason('highHumidity'))
  if (isFiniteNumber(relativeHumidity) && relativeHumidity <= FEEL_HUMIDITY.dryAt) reasons.push(reason('lowHumidity'))

  const { categoryId, label, detail } = classifyFeel(valueC, { relativeHumidity, windSpeed })

  return {
    status: 'ok',
    categoryId,
    label,
    detail,
    feelsLikeC: Math.round(valueC * 10) / 10,
    feelsLikeSource: source,
    unit: '°C',
    reasons: dedupe(reasons),
    estimateLabel: FEEL_ESTIMATE_LABEL,
  }
}

function dedupe(reasons) {
  const seen = new Set()
  return reasons.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
}
