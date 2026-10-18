/**
 * Activity-priority rules engine (Member 2).
 *
 * Pure, UI-free business logic: given one hourly forecast point and the
 * derived heat-stress estimates, it reports a status per activity together
 * with the factor results that produced it, so every recommendation can be
 * explained. All numbers come from `src/config/*` — nothing is hard-coded
 * here, and no value is ever invented when an input is missing (the factor
 * is reported as `unknown` instead).
 *
 * Status precedence: avoid > caution > recommended.
 * `unknown` is only the final status when no factor produced a judgement.
 */

import { ACTIVITIES } from '../config/activities.js'
import { FACTOR_DEFS } from '../config/adaptiveThresholds.js'

export const LEVELS = Object.freeze({
  OK: 'ok',
  CAUTION: 'caution',
  AVOID: 'avoid',
  UNKNOWN: 'unknown',
})

const STATUS_BY_LEVEL_RANK = Object.freeze({
  3: 'not-recommended',
  2: 'caution',
  1: 'recommended',
})

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function resolveThresholds(factorId, activity) {
  const base = FACTOR_DEFS[factorId]?.thresholds
  const overrides = activity?.thresholdOverrides?.[factorId]
  return { ...base, ...overrides }
}

function baseResult(factorId, level, extra = {}) {
  return { factorId, level, value: null, unit: FACTOR_DEFS[factorId]?.unit ?? null, ...extra }
}

function compareThreshold(value, thresholds, direction) {
  if (direction === 'lowerIsWorse') {
    if (value <= thresholds.avoidAt) return LEVELS.AVOID
    if (value <= thresholds.cautionAt) return LEVELS.CAUTION
    return LEVELS.OK
  }
  if (value >= thresholds.avoidAt) return LEVELS.AVOID
  if (value >= thresholds.cautionAt) return LEVELS.CAUTION
  return LEVELS.OK
}

/**
 * Evaluate a single factor for one hourly point.
 *
 * @param {string} factorId key in FACTOR_DEFS
 * @param {object} point normalized hourly point
 * @param {{ heatIndex?: object }} context derived heat-stress results
 * @param {object} [activity] activity (for threshold overrides)
 */
export function evaluateFactor(factorId, point, context = {}, activity = null) {
  const def = FACTOR_DEFS[factorId]
  if (!def) return baseResult(factorId, LEVELS.UNKNOWN)

  switch (factorId) {
    case 'rain': {
      const value = point?.precipitationProbability
      if (!isFiniteNumber(value)) return baseResult(factorId, LEVELS.UNKNOWN)
      const level = compareThreshold(value, resolveThresholds(factorId, activity), def.direction)
      return baseResult(factorId, level, { value })
    }

    case 'wind': {
      const value = point?.windSpeed
      if (!isFiniteNumber(value)) return baseResult(factorId, LEVELS.UNKNOWN)
      const level = compareThreshold(value, resolveThresholds(factorId, activity), def.direction)
      return baseResult(factorId, level, { value })
    }

    case 'cold': {
      const value = point?.temperature
      if (!isFiniteNumber(value)) return baseResult(factorId, LEVELS.UNKNOWN)
      const level = compareThreshold(value, resolveThresholds(factorId, activity), def.direction)
      return baseResult(factorId, level, { value })
    }

    case 'heat': {
      const heatIndex = context.heatIndex
      if (heatIndex?.status === 'ok') {
        const value = heatIndex.valueC
        const level = compareThreshold(value, resolveThresholds(factorId, activity), def.direction)
        return baseResult(factorId, level, { value, source: 'heatIndex' })
      }
      // Fall back to the API's modelled apparent temperature, which is always
      // labelled as such — never presented as a heat-index measurement.
      const value = point?.apparentTemperature
      if (!isFiniteNumber(value)) return baseResult(factorId, LEVELS.UNKNOWN)
      const level = compareThreshold(value, resolveThresholds(factorId, activity), def.direction)
      return baseResult(factorId, level, { value, source: 'apparentTemperature' })
    }

    case 'thunder':
    case 'fog': {
      const group = point?.condition?.group
      if (!group || group === 'unknown') return baseResult(factorId, LEVELS.UNKNOWN, { group: group ?? null })
      const avoidGroups = def.avoidGroups ?? []
      const cautionGroups = def.cautionGroups ?? []
      let level = LEVELS.OK
      if (avoidGroups.includes(group)) level = LEVELS.AVOID
      else if (cautionGroups.includes(group)) level = LEVELS.CAUTION
      return baseResult(factorId, level, { group, groupLabel: point?.condition?.label ?? null })
    }

    case 'dark': {
      // The normalizer always produces a boolean (missing is_day reads as
      // false), so guard only for defensively-parsed payloads.
      if (typeof point?.isDay !== 'boolean') return baseResult(factorId, LEVELS.UNKNOWN)
      const level = !point.isDay ? LEVELS.CAUTION : LEVELS.OK
      return baseResult(factorId, level, { isDay: point.isDay })
    }

    default:
      return baseResult(factorId, LEVELS.UNKNOWN)
  }
}

const LEVEL_RANK = Object.freeze({ [LEVELS.AVOID]: 3, [LEVELS.CAUTION]: 2, [LEVELS.OK]: 1, [LEVELS.UNKNOWN]: 0 })

/**
 * Evaluate every configured activity for one hourly point.
 *
 * @param {object|null} point normalized hourly point (may be null)
 * @param {{ heatIndex?: object }} context
 * @returns {Array<object>} one entry per activity in ACTIVITIES order
 */
export function evaluateActivities(point, context = {}) {
  return ACTIVITIES.map((activity) => evaluateActivity(activity, point, context))
}

/** Evaluate one activity. */
export function evaluateActivity(activity, point, context = {}) {
  if (!point) {
    return {
      activity,
      status: 'unknown',
      results: [],
      deciding: [],
      values: null,
    }
  }

  const results = activity.factors.map((factorId) => evaluateFactor(factorId, point, context, activity))
  const known = results.filter((result) => result.level !== LEVELS.UNKNOWN)

  let status
  if (known.length === 0) {
    status = 'unknown'
  } else {
    const worstRank = known.reduce((max, result) => Math.max(max, LEVEL_RANK[result.level]), 0)
    status = STATUS_BY_LEVEL_RANK[worstRank]
  }

  const deciding = results
    .filter((result) => result.level !== LEVELS.OK)
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])

  return {
    activity,
    status,
    results,
    deciding,
    values: {
      temperature: point.temperature ?? null,
      apparentTemperature: point.apparentTemperature ?? null,
      precipitationProbability: point.precipitationProbability ?? null,
      windSpeed: point.windSpeed ?? null,
      relativeHumidity: point.relativeHumidity ?? null,
      isDay: typeof point.isDay === 'boolean' ? point.isDay : null,
      conditionLabel: point.condition?.label ?? null,
      conditionGroup: point.condition?.group ?? null,
      heatIndexC: context.heatIndex?.status === 'ok' ? context.heatIndex.valueC : null,
      heatIndexSource: context.heatIndex?.status === 'ok' ? 'heatIndex' : null,
    },
  }
}

/**
 * Group evaluations into the three buckets the advisory speaks aloud.
 * @param {Array<object>} evaluations
 * @param {'en'|'hi'} language
 * @param {(id:string, language:'en'|'hi')=>string} labelFor
 */
export function groupEvaluationsByStatus(evaluations, language, labelFor) {
  const groups = { recommended: [], caution: [], avoid: [], unknown: [] }
  for (const evaluation of evaluations) {
    const label = labelFor(evaluation.activity.id, language)
    if (evaluation.status === 'recommended') groups.recommended.push(label)
    else if (evaluation.status === 'caution') groups.caution.push(label)
    else if (evaluation.status === 'not-recommended') groups.avoid.push(label)
    else groups.unknown.push(label)
  }
  return groups
}
