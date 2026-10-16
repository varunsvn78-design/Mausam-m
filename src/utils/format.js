/**
 * Display formatting helpers.
 *
 * IMPORTANT: Open-Meteo returns *local wall-clock* timestamps with no offset
 * (e.g. "2026-10-17T14:00", "2026-10-17") when `timezone=auto`. Converting them
 * with `new Date(...)` would re-interpret them in the browser's timezone and
 * shift/mislabel the date. These helpers therefore read the string parts
 * directly, and only use `Intl` with an explicit `timeZone: 'UTC'` when a real
 * Date object is needed for weekday/month names.
 */

/** Placeholder used everywhere a value is missing (never invent data). */
export const PLACEHOLDER = '—'

/** True for values the API did not provide (note: Number(null) is 0, so guard first). */
function isMissing(value) {
  return value === null || value === undefined || value === ''
}

export function formatTemperature(value) {
  if (isMissing(value)) return PLACEHOLDER
  const number = Number(value)
  return Number.isFinite(number) ? `${Math.round(number)}°` : PLACEHOLDER
}

export function formatNumber(value, { suffix = '', digits = 0 } = {}) {
  if (isMissing(value)) return PLACEHOLDER
  const number = Number(value)
  if (!Number.isFinite(number)) return PLACEHOLDER
  return `${number.toFixed(digits)}${suffix}`
}

/** "2026-10-17T14:00" -> "14:00" (wall-clock, no timezone math). */
export function formatClock(localDateTime) {
  if (typeof localDateTime !== 'string' || localDateTime.length < 16) return PLACEHOLDER
  return localDateTime.slice(11, 16)
}

/** "2026-10-17T14:00" -> "17 Oct 2026, 14:00" (wall-clock, no timezone math). */
export function formatObservationTime(localDateTime) {
  if (typeof localDateTime !== 'string' || localDateTime.length < 16) return PLACEHOLDER
  const [datePart, timePart] = localDateTime.split('T')
  return `${formatDateLabel(datePart)}, ${timePart.slice(0, 5)}`
}

/** "2026-10-17" -> "17 Oct" */
export function formatDateLabel(dateOnly, locale = undefined) {
  const parsed = parseDateOnly(dateOnly)
  if (!parsed) return PLACEHOLDER
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parsed)
}

/** "2026-10-17" -> "Sat" */
export function formatWeekday(dateOnly, locale = undefined) {
  const parsed = parseDateOnly(dateOnly)
  if (!parsed) return PLACEHOLDER
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(parsed)
}

/** "2026-10-17" -> "17 Oct 2026" */
export function formatFullDate(dateOnly, locale = undefined) {
  const parsed = parseDateOnly(dateOnly)
  if (!parsed) return PLACEHOLDER
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function parseDateOnly(dateOnly) {
  if (typeof dateOnly !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) return null
  const [year, month, day] = dateOnly.slice(0, 10).split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Today's calendar date in the given IANA timezone, as "YYYY-MM-DD". */
export function todayInTimeZone(timeZone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

/** Degrees -> compass point. Returns null for missing values. */
export function degreesToCompass(degrees) {
  if (isMissing(degrees)) return null
  const number = Number(degrees)
  if (!Number.isFinite(number)) return null
  const index = Math.round(((number % 360) + 360) % 360 / 45) % 8
  return COMPASS_POINTS[index]
}

/** Human readable "how long ago", used for cached/stale banners. */
export function formatRelativeAge(ageMs) {
  if (!Number.isFinite(ageMs)) return 'unknown time'
  const minutes = Math.round(ageMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} d ago`
}

/** Format an ISO timestamp (with offset, e.g. fetchedAt) in the user's locale. */
export function formatLocalTimestamp(isoString, locale = undefined) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return PLACEHOLDER
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
