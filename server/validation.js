/**
 * Server-side report validation (Phase 5).
 *
 * Deliberately mirrors the client rules in src/services/reportStore.js so the
 * API rejects anything the form would, and never trusts the client. Kept
 * dependency-free so it is trivially unit-testable.
 */

export const DESCRIPTION_MAX_LENGTH = 240
export const LOCATION_MAX_LENGTH = 120

/** Observation categories accepted by the shared reporting API. */
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

/** Coordinates must be finite and within valid lat/lon ranges. */
export function isValidCoordinatePair(latitude, longitude) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return true // optional
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

/**
 * Validate an incoming report payload.
 * @returns {{ valid: boolean, errors: Record<string,string>, value?: object }}
 */
export function validateReportPayload(payload) {
  const errors = {}
  const body = payload && typeof payload === 'object' ? payload : {}

  const location = body.location ?? ''
  const type = body.type ?? ''
  const description = body.description ?? ''
  const { latitude, longitude } = body

  if (!isNonEmptyString(location)) {
    errors.location = 'A location name is required.'
  } else if (location.trim().length > LOCATION_MAX_LENGTH) {
    errors.location = `Keep the location under ${LOCATION_MAX_LENGTH} characters.`
  }

  if (!OBSERVATION_IDS.has(type)) {
    errors.type = 'Choose a valid observation category.'
  }

  if (typeof description !== 'string') {
    errors.description = 'Description must be text.'
  } else if (description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX_LENGTH} characters.`
  }

  if (!isValidCoordinatePair(latitude, longitude)) {
    errors.coordinates = 'Coordinates must be valid latitude/longitude values.'
  }

  if (!errors.coordinates) {
    const hasLat = latitude !== null && latitude !== undefined && latitude !== ''
    const hasLon = longitude !== null && longitude !== undefined && longitude !== ''
    if (hasLat !== hasLon) {
      errors.coordinates = 'Provide both latitude and longitude, or neither.'
    }
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors }

  const hasCoords =
    latitude !== null && latitude !== undefined && latitude !== '' &&
    longitude !== null && longitude !== undefined && longitude !== ''

  return {
    valid: true,
    errors: {},
    value: {
      location: location.trim(),
      type,
      description: description.trim(),
      latitude: hasCoords ? Number(latitude) : null,
      longitude: hasCoords ? Number(longitude) : null,
    },
  }
}

/** Resolve a stable human label for an observation id. */
export function observationLabel(type) {
  return OBSERVATION_TYPES.find((entry) => entry.id === type)?.label ?? type
}
