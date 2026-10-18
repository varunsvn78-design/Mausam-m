/**
 * Pure timeline helpers for the 24-hour chrono-UI (Member 2).
 *
 * All timestamps from the NormalizedWeather contract are *local wall-clock*
 * strings without an offset ("YYYY-MM-DDTHH:00"), so everything here compares
 * string prefixes — never `new Date()` — to avoid timezone shifts.
 */

/** "2026-10-17T14:00" -> "2026-10-17" */
export function datePart(localDateTime) {
  return typeof localDateTime === 'string' && localDateTime.length >= 10
    ? localDateTime.slice(0, 10)
    : null
}

/** "2026-10-17T14:00" -> 14 */
export function hourPart(localDateTime) {
  if (typeof localDateTime !== 'string' || localDateTime.length < 13) return null
  const hour = Number(localDateTime.slice(11, 13))
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null
}

/**
 * Index hourly points by local date.
 *
 * @param {Array<{time:string}>} hourly normalized hourly points
 * @returns {{ days: string[], byDay: Record<string, Array<object|null>> }}
 *   `days` is unique dates in forecast order; `byDay[date]` is a sparse array
 *   of 24 slots (index = hour, `null` when the model returned no value).
 */
export function indexHourlyByDay(hourly) {
  const days = []
  const byDay = {}

  for (const point of Array.isArray(hourly) ? hourly : []) {
    const date = datePart(point?.time)
    const hour = hourPart(point?.time)
    if (!date || hour === null) continue

    if (!byDay[date]) {
      byDay[date] = new Array(24).fill(null)
      days.push(date)
    }
    byDay[date][hour] = point
  }

  return { days, byDay }
}

/**
 * Classify an hourly point against the current observation time.
 *
 * @param {{time:string}} point
 * @param {string|null} currentTime local wall-clock current time from the API
 * @returns {'past'|'current'|'future'|'unknown'}
 */
export function classifyHour(point, currentTime) {
  if (!point?.time) return 'unknown'
  if (typeof currentTime !== 'string' || currentTime.length < 13) return 'unknown'

  const pointHourKey = point.time.slice(0, 13)
  const currentHourKey = currentTime.slice(0, 13)

  if (pointHourKey === currentHourKey) return 'current'
  return pointHourKey < currentHourKey ? 'past' : 'future'
}

/** The `{ date, hour }` slot the "current" observation falls into, or null. */
export function getCurrentSelection(weather) {
  const currentTime = weather?.current?.time
  const date = datePart(currentTime)
  const hour = hourPart(currentTime)
  if (date && hour !== null) return { date, hour }

  // Current block missing — fall back to the first available forecast hour so
  // the timeline still opens on real data rather than an empty slot.
  const { days } = indexHourlyByDay(weather?.hourly)
  if (days.length > 0) return { date: days[0], hour: 0 }
  return null
}

/** True when the given date/hour exists in the hourly data. */
export function hasHourForSelection(hourly, selection) {
  if (!selection) return false
  const { byDay } = indexHourlyByDay(hourly)
  return Boolean(byDay[selection.date]?.[selection.hour])
}

/** Resolve the point for a selection; `null` when that hour is not forecast. */
export function resolveSelection(byDay, selection) {
  if (!selection) return null
  return byDay[selection.date]?.[selection.hour] ?? null
}

/**
 * Min/max of the day's temperatures for sparkline scaling (ignores nulls).
 * @returns {{min:number,max:number}|null}
 */
export function dayTemperatureRange(slots) {
  let min = Infinity
  let max = -Infinity
  for (const point of slots ?? []) {
    const value = point?.temperature
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  if (min === max) return { min: min - 1, max: max + 1 }
  return { min, max }
}

/**
 * Nearest hour that actually has forecast data, used when switching days so
 * the scrubber does not land in a hole in the model output.
 * @returns {number} 0…23 (the preferred hour when the whole day is empty)
 */
export function nearestAvailableHour(slots, preferred) {
  const hour = Number.isInteger(preferred) ? preferred : 0
  if (slots?.[hour]) return hour
  for (let delta = 1; delta <= 23; delta += 1) {
    if (slots?.[hour - delta]) return hour - delta
    if (slots?.[hour + delta]) return hour + delta
  }
  return hour
}
