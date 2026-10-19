/**
 * Air-quality configuration (Member 4): US AQI bands, outdoor-activity and
 * respiratory-precaution copy.
 *
 * Sources:
 *  - US AQI bands: US EPA Air Quality Index categories (0-50 Good,
 *    51-100 Moderate, 101-150 Unhealthy for Sensitive Groups, 151-200
 *    Unhealthy, 201-300 Very Unhealthy, 301+ Hazardous).
 *    https://www.airnow.gov/aqi/aqi-basics/
 *  - Data: Open-Meteo Air Quality API (CAMS model), index `us_aqi` — the
 *    global variant of the index (European AQI is Europe-only, so we do not
 *    depend on it).
 *
 * These are planning hints derived from a model forecast. They are NOT an
 * official air-quality bulletin and NOT medical advice. Sensitive groups
 * (asthma, heart/lung conditions, pregnancy, children, older adults) should
 * follow their clinician's guidance.
 *
 * Components must not hard-code their own thresholds or advice copy.
 */

/**
 * US AQI bands, matched in order (first entry with `value >= min` wins).
 * `risk` groups the bands for coarse styling: 'good' | 'moderate' |
 * 'unhealthy-sensitive' | 'unhealthy' | 'very-unhealthy' | 'hazardous'.
 */
export const AQI_BANDS = Object.freeze([
  { min: 301, id: 'hazardous', risk: 'hazardous' },
  { min: 201, id: 'very-unhealthy', risk: 'very-unhealthy' },
  { min: 151, id: 'unhealthy', risk: 'unhealthy' },
  { min: 101, id: 'unhealthy-sensitive', risk: 'unhealthy-sensitive' },
  { min: 51, id: 'moderate', risk: 'moderate' },
  { min: 0, id: 'good', risk: 'good' },
])

/** Labels + one-line summaries per band. */
export const AQI_LABELS = Object.freeze({
  good: {
    label: 'Good',
    summary: 'Air quality is satisfactory for most people.',
  },
  moderate: {
    label: 'Moderate',
    summary: 'Acceptable air quality; unusually sensitive people may feel mild effects.',
  },
  'unhealthy-sensitive': {
    label: 'Unhealthy for sensitive groups',
    summary: 'Sensitive groups may experience health effects; the general public is less likely to be affected.',
  },
  unhealthy: {
    label: 'Unhealthy',
    summary: 'Everyone may begin to experience health effects; sensitive groups may feel them sooner.',
  },
  'very-unhealthy': {
    label: 'Very unhealthy',
    summary: 'Health alert — the risk of health effects is increased for everyone.',
  },
  hazardous: {
    label: 'Hazardous',
    summary: 'Emergency conditions — everyone is more likely to be affected.',
  },
})

/** Outdoor-activity guidance per band (planning hint, not medical advice). */
export const AQI_ACTIVITY_ADVICE = Object.freeze({
  good: 'Good conditions for outdoor exercise. Normal outdoor plans are reasonable.',
  moderate: 'Fine for outdoor exercise for most people. Sensitive groups can reduce prolonged intense outdoor activity.',
  'unhealthy-sensitive': 'Sensitive groups should reduce prolonged or intense outdoor exercise. Others can continue with shorter sessions.',
  unhealthy: 'Consider moving intense outdoor exercise indoors or shortening it. Sensitive groups should avoid outdoor exertion.',
  'very-unhealthy': 'Avoid prolonged or intense outdoor exercise. Prefer indoor activity for everyone.',
  hazardous: 'Avoid outdoor exercise. Stay indoors with closed windows where possible.',
})

/**
 * Respiratory precautions per band. Copy only — no numbers are invented.
 * `null` means "no extra precaution beyond the normal summary".
 */
export const AQI_PRECAUTIONS = Object.freeze({
  good: null,
  moderate: ['If you notice irritation or unusual breathlessness, cut the session short and rest.'],
  'unhealthy-sensitive': [
    'Children, older adults, pregnant people, and anyone with asthma or heart/lung conditions should reduce prolonged outdoor exertion.',
    'Keep reliever medication handy if you have a respiratory condition (follow your doctor’s plan).',
  ],
  unhealthy: [
    'Sensitive groups should avoid prolonged outdoor exertion entirely.',
    'Everyone else should shorten and slow down intense outdoor activity.',
    'Close windows during peak pollution hours and use a well-fitting mask outdoors if you are in a sensitive group.',
  ],
  'very-unhealthy': [
    'Everyone should avoid prolonged or intense outdoor exertion.',
    'Keep indoor air as clean as possible — close windows and avoid indoor sources of smoke or fumes.',
  ],
  hazardous: [
    'Everyone should avoid outdoor exertion; sensitive groups should stay indoors.',
    'Follow official local advisories for your area.',
  ],
})

/** Pollutant metrics shown alongside the index (units are from the API). */
export const POLLUTANT_METRICS = Object.freeze([
  { id: 'pm25', label: 'PM2.5', unit: 'µg/m³', note: 'Fine particles — penetrate deep into the lungs.' },
  { id: 'pm10', label: 'PM10', unit: 'µg/m³', note: 'Coarser dust and particles.' },
])

/**
 * Rules that combine air quality with the weather forecast to judge an hour
 * for outdoor exercise. Kept here so the recommendation logic is auditable.
 * Probabilities in %, wind in km/h (NormalizedWeather units).
 */
export const OUTDOOR_EXERCISE_RULES = Object.freeze({
  /** AQI bands that can be "recommended" (others cap the verdict at caution). */
  recommendedBands: ['good', 'moderate'],
  /** AQI bands that force "not-recommended" for intense outdoor exercise. */
  blockedBands: ['unhealthy', 'very-unhealthy', 'hazardous'],
  rainProbabilityAvoidAt: 70, // %
  rainProbabilityCautionAt: 40, // %
  windAvoidAt: 35, // km/h
  windCautionAt: 20, // km/h
  /** Minimum length of a contiguous "recommended" run to be offered as a window. */
  minWindowHours: 2,
})

/** Human-readable verdict labels for the hourly exercise strip. */
export const EXERCISE_VERDICT_LABELS = Object.freeze({
  recommended: 'Recommended',
  caution: 'Caution',
  'not-recommended': 'Not recommended',
  unknown: 'Not enough data',
})

/** Human-readable reasons keyed by id (English; other modules own translations). */
export const OUTDOOR_REASON_TEXT = Object.freeze({
  aqiGood: 'Air quality is good.',
  aqiModerate: 'Air quality is moderate — acceptable for most people.',
  aqiSensitive: 'Air quality may affect sensitive groups during this hour.',
  aqiUnhealthy: 'Air quality is unhealthy for outdoor exertion this hour.',
  rainLikely: 'Rain is likely during this hour.',
  rainPossible: 'Rain is possible during this hour.',
  thunderstorm: 'Thunderstorms are forecast for this hour.',
  strongWind: 'Strong wind is forecast for this hour.',
  moderateWind: 'Breezy conditions may make intense exercise harder.',
  fog: 'Fog may reduce visibility during this hour.',
  night: 'It will be dark — choose a well-lit route.',
  missingAqi: 'No air-quality value is available for this hour.',
  missingWeather: 'Weather forecast values are missing for this hour.',
  todaySoFar: 'Today’s air quality so far (hourly forecast).',
})
