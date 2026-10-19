/**
 * Rain-check report store (Member 3 — Community, Maps & PWA).
 *
 * Reports are stored **only in this browser's localStorage**. There is no
 * backend: nothing is transmitted to any server, authority, or agency, and
 * the UI must always say so. Pure functions + explicit validation so the
 * form can show inline errors before anything is written.
 */

export const REPORTS_STORAGE_KEY = 'mausam.community.reports.v1'
export const MAX_STORED_REPORTS = 20
export const DESCRIPTION_MAX_LENGTH = 240
export const LOCATION_MAX_LENGTH = 120

export const OBSERVATION_TYPES = Object.freeze([
  { id: 'rain-started', label: 'Rain started' },
  { id: 'light-rain', label: 'Light rain' },
  { id: 'heavy-rain', label: 'Heavy rain' },
  { id: 'no-rain', label: 'No rain yet' },
  { id: 'thunderstorm', label: 'Thunderstorm' },
  { id: 'other', label: 'Other' },
])

const OBSERVATION_IDS = new Set(OBSERVATION_TYPES.map((type) => type.id))

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validate a report draft.
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateReport(draft) {
  const errors = {}
  const location = draft?.location ?? ''
  const type = draft?.type ?? ''
  const description = draft?.description ?? ''

  if (!isNonEmptyString(location)) {
    errors.location = 'Where did you observe this? Enter a place name.'
  } else if (location.trim().length > LOCATION_MAX_LENGTH) {
    errors.location = `Keep the location under ${LOCATION_MAX_LENGTH} characters.`
  }

  if (!OBSERVATION_IDS.has(type)) {
    errors.type = 'Choose what you observed.'
  }

  if (typeof description !== 'string') {
    errors.description = 'Description must be text.'
  } else if (description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX_LENGTH} characters (${description.length} used).`
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

/** Build a normalized report record from a valid draft (never called with invalid input by the form). */
export function createReport(draft, { now = Date.now(), id = null } = {}) {
  const observation = OBSERVATION_TYPES.find((type) => type.id === draft.type)
  return {
    id: id ?? `report-${now}-${Math.random().toString(36).slice(2, 8)}`,
    location: draft.location.trim(),
    type: draft.type,
    typeLabel: observation?.label ?? draft.type,
    description: (draft.description ?? '').trim(),
    observedAt: new Date(now).toISOString(),
    storedLocally: true,
    demo: true,
  }
}

/** Read stored reports (newest first). Never throws. */
export function listReports() {
  try {
    const raw = window.localStorage.getItem(REPORTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        typeof entry.location === 'string' &&
        typeof entry.type === 'string',
    )
  } catch {
    return []
  }
}

/**
 * Persist a report. Returns `{ ok, reports }` or `{ ok: false, error }`.
 * Never throws — quota/serialization failures surface as a form failure state.
 */
export function saveReport(draft, options = {}) {
  const validation = validateReport(draft)
  if (!validation.valid) {
    return { ok: false, error: 'invalid', errors: validation.errors }
  }

  try {
    const reports = listReports()
    const report = createReport(draft, options)
    const next = [report, ...reports].slice(0, MAX_STORED_REPORTS)
    window.localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(next))
    return { ok: true, report, reports: next, truncated: reports.length >= MAX_STORED_REPORTS }
  } catch {
    return { ok: false, error: 'storage' }
  }
}

/** Remove every locally stored report. Never throws. */
export function clearReports() {
  try {
    window.localStorage.removeItem(REPORTS_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
