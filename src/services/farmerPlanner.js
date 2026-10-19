/**
 * Farmer's Rain Planner (Member 4) — pure logic.
 *
 * Turns the NormalizedWeather contract into per-day planning windows for
 * three common field operations (irrigation, sowing/transplanting,
 * harvest/threshing). Every verdict carries the forecast facts that produced
 * it as structured reasons ({ id, text, values }), so the UI can show exactly
 * why a day was rated.
 *
 * SCOPE: forecast-based planning suggestions only — NOT agronomic advice and
 * NOT an official warning (see FARM_DISCLAIMER in config/farmerPlanner.js).
 *
 * Public API:
 *   aggregateRainFromHourly(weather, date)   -> { rainMm, wetHours, maxHourlyMm, hoursWithData }
 *   evaluateOperation(opId, dayFacts)        -> { verdict, reasons: [...] }
 *   buildFarmPlan(weather)                   -> plan object
 *
 * Daily rain totals are the SUM of forecast hourly precipitation for that
 * local day (the forecast API's daily block carries no precipitation sum).
 * When some hours lack data the total is flagged `complete: false` and the
 * plan still shows only what the model actually returned — never a guess.
 */

import {
  FARM_DISCLAIMER,
  FARM_HEAT_THRESHOLD,
  FARM_OPERATIONS,
  FARM_REASON_TEXT,
  RAIN_MM_THRESHOLDS,
  RAIN_PROBABILITY_THRESHOLDS,
  VERDICT_LABELS,
} from '../config/farmerPlanner.js'

const OPERATION_IDS = Object.freeze(FARM_OPERATIONS.map((op) => op.id))

/* ------------------------------------------------------------------ helpers */

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function format(text, values = {}) {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match))
}

function reason(id, values = {}) {
  const template = FARM_REASON_TEXT[id] ?? id
  return { id, values, text: format(template, values) }
}

function round1(value) {
  return Math.round(value * 10) / 10
}

/* ------------------------------------------------------------- rain by day */

/**
 * Sum forecast hourly precipitation for one local date.
 *
 * @param {object} weather NormalizedWeather
 * @param {string} date 'YYYY-MM-DD'
 * @returns {{ rainMm:number|null, wetHours:number, maxHourlyMm:number|null, hoursWithData:number, complete:boolean }}
 */
export function aggregateRainFromHourly(weather, date) {
  const hours = Array.isArray(weather?.hourly)
    ? weather.hourly.filter((p) => typeof p?.time === 'string' && p.time.slice(0, 10) === date)
    : []

  let total = 0
  let hoursWithData = 0
  let wetHours = 0
  let maxHourlyMm = null

  for (const point of hours) {
    const mm = point.precipitation
    if (!isFiniteNumber(mm)) continue
    hoursWithData += 1
    total += mm
    if (mm > 0) wetHours += 1
    if (maxHourlyMm === null || mm > maxHourlyMm) maxHourlyMm = mm
  }

  if (hoursWithData === 0) {
    return { rainMm: null, wetHours: 0, maxHourlyMm: null, hoursWithData: 0, complete: false }
  }

  return {
    rainMm: round1(total),
    wetHours,
    maxHourlyMm: maxHourlyMm === null ? null : round1(maxHourlyMm),
    hoursWithData,
    complete: hoursWithData >= 24,
  }
}

/* ------------------------------------------------------------ op evaluations */

function dayClass(rainMm) {
  if (!isFiniteNumber(rainMm)) return 'unknown'
  if (rainMm >= RAIN_MM_THRESHOLDS.heavyAbove) return 'heavy'
  if (rainMm >= RAIN_MM_THRESHOLDS.moderateAbove) return 'moderate'
  if (rainMm >= RAIN_MM_THRESHOLDS.traceAt) return 'light'
  return 'dry'
}

function rainReason(classification, rainMm) {
  if (classification === 'heavy') return reason('heavyRain', { mm: round1(rainMm) })
  if (classification === 'moderate') return reason('moderateRain', { mm: round1(rainMm) })
  if (classification === 'light') return reason('lightRain', { mm: round1(rainMm) })
  if (classification === 'dry') return reason('dryDay', { trace: RAIN_MM_THRESHOLDS.traceAt })
  return reason('noDailyData')
}

function probBand(prob) {
  if (!isFiniteNumber(prob)) return 'unknown'
  if (prob >= RAIN_PROBABILITY_THRESHOLDS.avoidAt) return 'high'
  if (prob >= RAIN_PROBABILITY_THRESHOLDS.cautionAt) return 'possible'
  return 'low'
}

/**
 * Judge one operation for one day.
 *
 * @param {'irrigation'|'sowing'|'harvest'} opId
 * @param {{
 *   rainMm:number|null, rainProbabilityMax:number|null,
 *   temperatureMax:number|null, hasHourlyDetail:boolean
 * }} dayFacts
 * @returns {{ verdict:string, reasons:Array<{id:string,values:object,text:string}> }}
 */
export function evaluateOperation(opId, { rainMm, rainProbabilityMax, temperatureMax, hasHourlyDetail } = {}) {
  if (!OPERATION_IDS.includes(opId)) {
    throw new Error(`Unknown farm operation: ${opId}`)
  }

  const rainClass = dayClass(rainMm)
  const prob = probBand(rainProbabilityMax)
  const reasons = []

  // No forecast facts at all -> honest "unknown".
  if (rainClass === 'unknown' && prob === 'unknown') {
    reasons.push(reason(hasHourlyDetail ? 'noDailyData' : 'noHourlyData'))
    return { verdict: 'unknown', reasons }
  }

  if (rainClass !== 'unknown') reasons.push(rainReason(rainClass, rainMm))
  if (prob === 'high') reasons.push(reason('heavyRainRisk', { prob: rainProbabilityMax }))
  else if (prob === 'possible') reasons.push(reason('rainPossible', { prob: rainProbabilityMax }))

  const hotDay = isFiniteNumber(temperatureMax) && temperatureMax >= FARM_HEAT_THRESHOLD.evaporationAt
  if (hotDay) reasons.push(reason('highEvaporation', { maxC: round1(temperatureMax) }))

  const wetField = rainClass === 'heavy' || rainClass === 'moderate'

  if (opId === 'irrigation') {
    if (wetField || prob === 'high') {
      if (prob === 'high') reasons.push(reason('irrigationPauseRain', { prob: rainProbabilityMax }))
      return { verdict: 'pause', reasons }
    }
    if (rainClass === 'light' || prob === 'possible') return { verdict: 'caution', reasons }
    return { verdict: 'suitable', reasons }
  }

  if (opId === 'sowing') {
    if (wetField) return { verdict: 'unsuitable', reasons: [...reasons, reason('soilWet')] }
    if (prob === 'high' || rainClass === 'light') {
      return { verdict: 'caution', reasons: rainClass === 'light' ? [...reasons, reason('soilWet')] : reasons }
    }
    return { verdict: 'suitable', reasons }
  }

  // harvest
  if (wetField) return { verdict: 'unsuitable', reasons: [...reasons, reason('cropWet')] }
  if (rainClass === 'light' || prob === 'high') return { verdict: 'pause', reasons: [...reasons, reason('cropWet')] }
  if (prob === 'possible') return { verdict: 'caution', reasons: [...reasons, reason('cropWet')] }
  return { verdict: 'suitable', reasons }
}

/* ------------------------------------------------------------------ plan */

function buildDay(weather, dailyEntry, date) {
  const { rainMm, wetHours, maxHourlyMm, hoursWithData, complete } = aggregateRainFromHourly(weather, date)
  const hasHourlyDetail = hoursWithData > 0

  const facts = {
    rainMm,
    rainProbabilityMax: isFiniteNumber(dailyEntry?.precipitationProbability) ? dailyEntry.precipitationProbability : null,
    temperatureMax: isFiniteNumber(dailyEntry?.temperatureMax) ? dailyEntry.temperatureMax : null,
    hasHourlyDetail,
  }

  const windows = {}
  for (const opId of OPERATION_IDS) {
    windows[opId] = evaluateOperation(opId, facts)
  }

  return {
    date,
    condition: dailyEntry?.condition ?? null,
    weatherCode: dailyEntry?.weatherCode ?? null,
    rainMm,
    rainMmComplete: complete,
    wetHours,
    maxHourlyMm,
    rainProbabilityMax: facts.rainProbabilityMax,
    temperatureMax: facts.temperatureMax,
    temperatureMin: isFiniteNumber(dailyEntry?.temperatureMin) ? dailyEntry.temperatureMin : null,
    windows,
  }
}

/**
 * Build the full planning view from a NormalizedWeather payload.
 *
 * @param {object} weather NormalizedWeather (may be null)
 * @returns {{
 *   status:'ok'|'unavailable', location:object|null, fetchedAt:string|null,
 *   timezone:string|null, days:Array, operations:Array, disclaimer:string,
 *   verdictLabels:object
 * }}
 */
export function buildFarmPlan(weather) {
  const empty = {
    status: 'unavailable',
    location: null,
    fetchedAt: null,
    timezone: null,
    days: [],
    operations: FARM_OPERATIONS.map((op) => ({ ...op })),
    disclaimer: FARM_DISCLAIMER,
    verdictLabels: { ...VERDICT_LABELS },
  }

  if (!weather || typeof weather !== 'object') return empty

  const daily = Array.isArray(weather.daily) ? weather.daily : []
  const hourlyDates = Array.isArray(weather.hourly)
    ? [...new Set(weather.hourly.filter((p) => typeof p?.time === 'string').map((p) => p.time.slice(0, 10)))]
    : []

  // Primary source: the daily block; fall back to dates present in hourly so
  // a daily-only outage still yields a usable plan.
  const dates = daily.length > 0 ? daily.map((d) => d.date) : hourlyDates
  if (dates.length === 0) return empty

  const dailyByDate = new Map(daily.map((entry) => [entry.date, entry]))

  const days = dates.map((date) => buildDay(weather, dailyByDate.get(date) ?? null, date))

  return {
    status: 'ok',
    location: weather.location ?? null,
    fetchedAt: weather.fetchedAt ?? null,
    timezone: weather.timezone ?? null,
    days,
    operations: FARM_OPERATIONS.map((op) => ({ ...op })),
    disclaimer: FARM_DISCLAIMER,
    verdictLabels: { ...VERDICT_LABELS },
  }
}
