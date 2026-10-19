/**
 * DEMONSTRATION DATA ONLY (Member 3 — Community, Maps & PWA).
 *
 * Everything in this file is simulated sample data for the prototype UI.
 * It is intentionally kept apart from real API data (`NormalizedWeather`,
 * `NormalizedLocation`) so demo markers/cards can never be mistaken for
 * live observations, official alerts, or verified service availability.
 *
 * Coordinates are well-known published city coordinates used only as
 * static demo anchor points.
 */

export const DEMO_DATA_NOTICE = Object.freeze({
  en: 'Demonstration data — not live observations.',
})

export const RAIN_STATUS = Object.freeze({
  NONE: 'none',
  LIGHT: 'light',
  MODERATE: 'moderate',
  HEAVY: 'heavy',
  STORM: 'storm',
  UNKNOWN: 'unknown',
})

/** Labels + palette for sample rainfall statuses (single language UI, like Member 1). */
export const RAIN_STATUS_META = Object.freeze({
  [RAIN_STATUS.NONE]: { label: 'No rain', tone: 'info' },
  [RAIN_STATUS.LIGHT]: { label: 'Light rain', tone: 'primary' },
  [RAIN_STATUS.MODERATE]: { label: 'Moderate rain', tone: 'warning' },
  [RAIN_STATUS.HEAVY]: { label: 'Heavy rain', tone: 'danger' },
  [RAIN_STATUS.STORM]: { label: 'Thunderstorm', tone: 'danger' },
  [RAIN_STATUS.UNKNOWN]: { label: 'Unknown (sample)', tone: 'muted' },
})

/**
 * Static map markers. Coordinates verified against widely published
 * city coordinates; every popup states that the data is simulated.
 */
export const DEMO_MARKERS = Object.freeze([
  {
    id: 'demo-bengaluru',
    name: 'Bengaluru (demo)',
    latitude: 12.9716,
    longitude: 77.5946,
    rainfallMm: 4.2,
    status: RAIN_STATUS.LIGHT,
    note: 'Sample station reading. Simulated for demonstration.',
    updatedLabel: 'Sample update: 09:30 IST',
  },
  {
    id: 'demo-delhi',
    name: 'New Delhi (demo)',
    latitude: 28.6139,
    longitude: 77.209,
    rainfallMm: 0,
    status: RAIN_STATUS.NONE,
    note: 'Sample station reading. Simulated for demonstration.',
    updatedLabel: 'Sample update: 09:00 IST',
  },
  {
    id: 'demo-mumbai',
    name: 'Mumbai (demo)',
    latitude: 19.076,
    longitude: 72.8777,
    rainfallMm: 61.5,
    status: RAIN_STATUS.HEAVY,
    note: 'Sample station reading. Simulated for demonstration.',
    updatedLabel: 'Sample update: 08:45 IST',
  },
  {
    id: 'demo-chennai',
    name: 'Chennai (demo)',
    latitude: 13.0827,
    longitude: 80.2707,
    rainfallMm: 18.0,
    status: RAIN_STATUS.STORM,
    note: 'Sample station reading. Simulated for demonstration.',
    updatedLabel: 'Sample update: 10:15 IST',
  },
  {
    id: 'demo-kolkata',
    name: 'Kolkata (demo)',
    latitude: 22.5726,
    longitude: 88.3639,
    rainfallMm: 7.6,
    status: RAIN_STATUS.MODERATE,
    note: 'Sample station reading. Simulated for demonstration.',
    updatedLabel: 'Sample update: 09:50 IST',
  },
  {
    id: 'demo-guwahati',
    name: 'Guwahati (demo)',
    latitude: 26.1445,
    longitude: 91.7362,
    rainfallMm: 12.3,
    status: RAIN_STATUS.MODERATE,
    note: 'Sample station reading. Simulated for demonstration.',
    updatedLabel: 'Sample update: 09:20 IST',
  },
])

/** Simulated village records — NOT a live rural directory. */
export const DEMO_VILLAGES = Object.freeze([
  {
    id: 'demo-village-1',
    name: 'Rampur (demo village)',
    district: 'Sample District, State A',
    rainfallMm: 6.4,
    status: RAIN_STATUS.LIGHT,
    services: ['Anganwadi', 'Primary health sub-centre'],
    lastUpdatedLabel: 'Sample record updated: 15 Oct 2026, 10:00 IST',
  },
  {
    id: 'demo-village-2',
    name: 'Chandipur (demo village)',
    district: 'Sample District, State B',
    rainfallMm: 32.1,
    status: RAIN_STATUS.HEAVY,
    services: ['Farm pond', 'Krishi Vigyan Kendra helpdesk'],
    lastUpdatedLabel: 'Sample record updated: 15 Oct 2026, 08:30 IST',
  },
  {
    id: 'demo-village-3',
    name: 'Nilgaon (demo village)',
    district: 'Sample District, State C',
    rainfallMm: 0,
    status: RAIN_STATUS.NONE,
    services: ['Community radio relay'],
    lastUpdatedLabel: 'Sample record updated: 14 Oct 2026, 18:15 IST',
  },
  {
    id: 'demo-village-4',
    name: 'Barwani Khas (demo village)',
    district: 'Sample District, State D',
    rainfallMm: 15.8,
    status: RAIN_STATUS.MODERATE,
    services: ['Ambulance depot (sample)', 'Check-dam'],
    lastUpdatedLabel: 'Sample record updated: 15 Oct 2026, 07:45 IST',
  },
])

/** Simulated unified-service cards — availability is NOT verified. */
export const DEMO_SERVICES = Object.freeze([
  {
    id: 'demo-service-1',
    name: 'Weather observation station',
    category: 'Observation',
    availability: 'available',
    detail: 'Sample record: reporting normally.',
    lastUpdatedLabel: 'Sample status: 15 Oct 2026, 09:00 IST',
  },
  {
    id: 'demo-service-2',
    name: 'District control room',
    category: 'Emergency coordination',
    availability: 'available',
    detail: 'Sample record: helpline staffed (simulated).',
    lastUpdatedLabel: 'Sample status: 15 Oct 2026, 09:00 IST',
  },
  {
    id: 'demo-service-3',
    name: 'Village loudspeaker network',
    category: 'Alerting',
    availability: 'unavailable',
    detail: 'Sample record: maintenance (simulated).',
    lastUpdatedLabel: 'Sample status: 14 Oct 2026, 17:30 IST',
  },
  {
    id: 'demo-service-4',
    name: 'Road underpass camera feed',
    category: 'Transport',
    availability: 'unknown',
    detail: 'Sample record: status not reported.',
    lastUpdatedLabel: 'Sample status: not available',
  },
])

export const AVAILABILITY_META = Object.freeze({
  available: { label: 'Available (sample)', tone: 'success' },
  unavailable: { label: 'Unavailable (sample)', tone: 'danger' },
  unknown: { label: 'Unknown (sample)', tone: 'muted' },
})

/**
 * The single demo alert banner payload.
 * Simulated content only — never an official warning.
 */
export const DEMO_ALERT = Object.freeze({
  id: 'demo-alert-1',
  severity: 'warning',
  headline: 'Heavy rain possible over parts of the region (simulated)',
  detail:
    'A demonstration alert showing how an emergency banner would look. This content is simulated for the prototype and is not an official warning from any agency.',
  sampleIssuedLabel: 'Sample issue time: 15 Oct 2026, 06:00 IST',
})

export const ALERT_SEVERITY_META = Object.freeze({
  info: { label: 'Advisory (demo)', tone: 'info' },
  warning: { label: 'Warning (demo)', tone: 'warning' },
  severe: { label: 'Severe (demo)', tone: 'danger' },
})

/** Map fallback centre when no coordinates are available (geographic centre of India). */
export const MAP_FALLBACK_VIEW = Object.freeze({
  center: [22.9734, 78.6569],
  zoom: 4,
})
