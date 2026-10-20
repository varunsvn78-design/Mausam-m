/**
 * Air-quality + outdoor-activity advisor (Member 4) — pure logic.
 *
 * Combines the NormalizedAirQuality contract with the NormalizedWeather
 * forecast to judge hours for outdoor exercise. Every verdict comes with the
 * reasons that produced it, so the UI can always show "why".
 *
 * Public API:
 *   classifyAqi(usAqi)                        -> { id, risk, label, summary } | null
 *   describeAirQuality(sample)                -> display object for one reading
 *   evaluateExerciseHour(facts)               -> { verdict, reasons: [{id, text}] }
 *   joinExerciseHours({ airQuality, weather, date }) -> HourFact[]
 *   groupIntoWindows(hours)                   -> [{ startHour, endHour, verdict, hours }]
 *   buildExercisePlan({ airQuality, weather, date })  -> plan object
 *
 * Verdicts: 'recommended' | 'caution' | 'not-recommended' | 'unknown'.
 * Rules and thresholds live in src/config/airQuality.js (OUTDOOR_EXERCISE_RULES,
 * OUTDOOR_REASON_TEXT). Nothing here is medical advice.
 */

import {
  AQI_BANDS,
  AQI_ACTIVITY_ADVICE,
  AQI_LABELS,
  AQI_PRECAUTIONS,
  OUTDOOR_EXERCISE_RULES,
  OUTDOOR_REASON_TEXT,
} from '../config/airQuality.js'

/* --------------------------------------------------------------------- AQI */

/**
 * Classify a US AQI value into its EPA band.
 * @param {number|null|undefined} usAqi
 * @returns {{ id:string, risk:string, label:string, summary:string } | null}
 *          null when the value is missing/unusable — never guessed.
 */
export function classifyAqi(usAqi) {
  if (typeof usAqi !== 'number' || !Number.isFinite(usAqi) || usAqi < 0) return null
  const band = AQI_BANDS.find((entry) => usAqi >= entry.min)
  if (!band) return null
  return { id: band.id, risk: band.risk, label: AQI_LABELS[band.id].label, summary: AQI_LABELS[band.id].summary }
}

/**
 * Display object for one air-quality reading (current block or an hourly
 * point). Returns null when nothing measurable is present.
 *
 * @param {{ time?:string|null, usAqi?:number|null, pm25?:number|null, pm10?:number|null }} sample
 */
export function describeAirQuality(sample) {
  if (!sample || typeof sample !== 'object') return null

  const band = classifyAqi(sample.usAqi)
  const hasAny = band !== null || sample.pm25 !== null || sample.pm10 !== null
  if (!hasAny) return null

  return {
    time: sample.time ?? null,
    usAqi: typeof sample.usAqi === 'number' && Number.isFinite(sample.usAqi) ? sample.usAqi : null,
    pm25: typeof sample.pm25 === 'number' && Number.isFinite(sample.pm25) ? sample.pm25 : null,
    pm10: typeof sample.pm10 === 'number' && Number.isFinite(sample.pm10) ? sample.pm10 : null,
    bandId: band?.id ?? null,
    risk: band?.risk ?? null,
    label: band?.label ?? 'Air quality not available',
    summary: band?.summary ?? 'No index value was provided for this reading.',
    advice: band ? AQI_ACTIVITY_ADVICE[band.id] : null,
    precautions: (band && AQI_PRECAUTIONS[band.id]) || [],
  }
}

/* --------------------------------------------------------- exercise verdicts */

function reason(id) {
  return { id, text: OUTDOOR_REASON_TEXT[id] ?? id }
}

/**
 * Judge one hour for outdoor exercise from already-joined facts.
 *
 * @param {{
 *   usAqi?: number|null,
 *   rainProbability?: number|null,
 *   windSpeed?: number|null,
 *   conditionGroup?: string|null,
 *   isDay?: boolean|null,
 * }} facts
 * @returns {{ verdict:'recommended'|'caution'|'not-recommended'|'unknown', reasons:Array<{id:string,text:string}> }}
 */
export function evaluateExerciseHour(facts = {}) {
  const rules = OUTDOOR_EXERCISE_RULES
  const reasons = []
  const band = classifyAqi(facts.usAqi)

  const hasRainProbability = typeof facts.rainProbability === 'number' && Number.isFinite(facts.rainProbability)
  const hasWind = typeof facts.windSpeed === 'number' && Number.isFinite(facts.windSpeed)
  const hasCondition = typeof facts.conditionGroup === 'string' && facts.conditionGroup.length > 0
  // A trustworthy outdoor verdict needs all three weather inputs. If any is
  // missing we must not present "recommended" for that hour; we downgrade to
  // caution with an explicit "weather data incomplete" reason.
  const weatherComplete = hasRainProbability && hasWind && hasCondition

  // --- hard blockers (weather first: a thunderstorm is bad regardless of AQ) --
  if (hasCondition && facts.conditionGroup === 'thunderstorm') reasons.push(reason('thunderstorm'))
  if (hasRainProbability && facts.rainProbability >= rules.rainProbabilityAvoidAt) reasons.push(reason('rainLikely'))
  if (hasWind && facts.windSpeed >= rules.windAvoidAt) reasons.push(reason('strongWind'))
  if (band && rules.blockedBands.includes(band.id)) reasons.push(reason('aqiUnhealthy'))
  if (reasons.length > 0) return { verdict: 'not-recommended', reasons }

  // --- nothing measurable at all ---------------------------------------------
  if (!band && !weatherComplete) {
    return { verdict: 'unknown', reasons: [reason('missingAqi'), reason('missingWeather')] }
  }

  // --- missing pieces downgrade to caution, never to recommended --------------
  const cautions = []
  if (!band) cautions.push(reason('missingAqi'))
  else if (band.id === 'good') cautions.push(reason('aqiGood'))
  else if (band.id === 'moderate') cautions.push(reason('aqiModerate'))
  else cautions.push(reason('aqiSensitive')) // 'unhealthy-sensitive' or worse-not-blocked

  if (!weatherComplete) cautions.push(reason('missingWeather'))
  else {
    if (hasRainProbability && facts.rainProbability >= rules.rainProbabilityCautionAt) cautions.push(reason('rainPossible'))
    if (hasWind && facts.windSpeed >= rules.windCautionAt) cautions.push(reason('moderateWind'))
    if (hasCondition && facts.conditionGroup === 'fog') cautions.push(reason('fog'))
    if (facts.isDay === false) cautions.push(reason('night'))
  }

  // Positive-only reasons (good AQ, no weather cautions) => recommended.
  const informative = cautions.filter((r) => r.id !== 'aqiGood' && r.id !== 'aqiModerate')
  if (informative.length > 0) return { verdict: 'caution', reasons: dedupe(cautions) }

  return { verdict: 'recommended', reasons: dedupe(cautions) }
}

function dedupe(reasons) {
  const seen = new Set()
  return reasons.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
}

/* --------------------------------------------------------------- join hours */

/**
 * Join AQI hourly data with the weather forecast for one local date.
 * Hours present in either source are kept; missing values stay null.
 *
 * @param {{ hourly:Array }} airQuality NormalizedAirQuality
 * @param {{ hourly:Array, current?:object }} weather NormalizedWeather
 * @param {string} date 'YYYY-MM-DD' (defaults to the weather current date)
 * @returns {Array<{ time, hour, usAqi, bandId, pm25, rainProbability, temperature, windSpeed, conditionGroup, isDay, verdict, reasons }>}
 */
export function joinExerciseHours({ airQuality, weather } = {}, date) {
  const targetDate = date ?? weather?.current?.time?.slice(0, 10) ?? airQuality?.hourly?.[0]?.time?.slice(0, 10) ?? null
  if (!targetDate) return []

  const aqByHour = indexByHour(airQuality?.hourly, targetDate, (point) => ({
    usAqi: point.usAqi,
    bandId: classifyAqi(point.usAqi)?.id ?? null,
    pm25: point.pm25,
  }))

  const wxByHour = indexByHour(weather?.hourly, targetDate, (point) => ({
    rainProbability: point.precipitationProbability,
    temperature: point.temperature,
    windSpeed: point.windSpeed,
    conditionGroup: point.condition?.group ?? null,
    isDay: point.isDay,
  }))

  const hourNumbers = [...new Set([...aqByHour.keys(), ...wxByHour.keys()])].sort((a, b) => a - b)

  return hourNumbers.map((hour) => {
    const aq = aqByHour.get(hour) ?? {}
    const wx = wxByHour.get(hour) ?? {}
    const facts = {
      usAqi: aq.usAqi ?? null,
      rainProbability: wx.rainProbability ?? null,
      windSpeed: wx.windSpeed ?? null,
      conditionGroup: wx.conditionGroup ?? null,
      isDay: wx.isDay ?? null,
    }
    const { verdict, reasons } = evaluateExerciseHour(facts)
    return {
      time: `${targetDate}T${String(hour).padStart(2, '0')}:00`,
      hour,
      usAqi: facts.usAqi,
      bandId: aq.bandId ?? null,
      pm25: aq.pm25 ?? null,
      rainProbability: facts.rainProbability,
      temperature: wx.temperature ?? null,
      windSpeed: facts.windSpeed,
      conditionGroup: facts.conditionGroup,
      isDay: facts.isDay,
      verdict,
      reasons,
    }
  })
}

function indexByHour(hourly, date, pick) {
  const map = new Map()
  if (!Array.isArray(hourly)) return map
  for (const point of hourly) {
    if (!point || typeof point.time !== 'string' || point.time.slice(0, 10) !== date) continue
    const hour = Number(point.time.slice(11, 13))
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue
    map.set(hour, pick(point))
  }
  return map
}

/* ------------------------------------------------------------------ windows */

/**
 * Group consecutive same-verdict hours into windows.
 * @param {Array<{hour:number, verdict:string}>} hours
 * @returns {Array<{ startHour:number, endHour:number, verdict:string, hours:Array }>}
 */
export function groupIntoWindows(hours) {
  if (!Array.isArray(hours) || hours.length === 0) return []

  const sorted = [...hours].sort((a, b) => a.hour - b.hour)
  const windows = []
  let current = null

  for (const entry of sorted) {
    if (current && current.verdict === entry.verdict && entry.hour === current.endHour + 1) {
      current.endHour = entry.hour
      current.hours.push(entry)
    } else {
      current = { startHour: entry.hour, endHour: entry.hour, verdict: entry.verdict, hours: [entry] }
      windows.push(current)
    }
  }
  return windows
}

/**
 * Build the day's exercise plan.
 *
 * @param {{ airQuality:object, weather:object, date?:string }} params
 * @returns {{
 *   status:'ok'|'unavailable', date:string|null, hours:Array, windows:Array,
 *   recommendedWindows:Array, counts:object, bestWindow:object|null
 * }}
 */
export function buildExercisePlan({ airQuality, weather, date } = {}) {
  const hours = joinExerciseHours({ airQuality, weather }, date)
  if (hours.length === 0) {
    return { status: 'unavailable', date: date ?? null, hours: [], windows: [], recommendedWindows: [], counts: {}, bestWindow: null }
  }

  const windows = groupIntoWindows(hours)
  const recommendedWindows = windows.filter(
    (w) => w.verdict === 'recommended' && w.hours.length >= OUTDOOR_EXERCISE_RULES.minWindowHours,
  )

  const counts = hours.reduce((acc, h) => {
    acc[h.verdict] = (acc[h.verdict] ?? 0) + 1
    return acc
  }, {})

  const bestWindow =
    recommendedWindows.reduce((best, w) => (!best || w.hours.length > best.hours.length ? w : best), null) ?? null

  const planDate = hours[0]?.time?.slice(0, 10) ?? date ?? null

  return { status: 'ok', date: planDate, hours, windows, recommendedWindows, counts, bestWindow }
}
