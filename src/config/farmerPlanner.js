/**
 * Farmer's Rain Planner configuration (Member 4): rain thresholds, planning
 * verdicts and the explainable copy behind them.
 *
 * IMPORTANT SCOPE NOTE — this module provides FORECAST-BASED PLANNING
 * SUGGESTIONS ONLY. It is not agronomic advice, not a crop-protection
 * recommendation, and not an official meteorological warning. Users must
 * cross-check official advisories (e.g. IMD district warnings) before acting.
 * The UI must keep this disclaimer visible.
 *
 * Units (NormalizedWeather contract): precipitation mm, probabilities %,
 * temperature °C.
 */

/**
 * 24-hour rain totals (mm), judged from the sum of forecast hourly
 * precipitation for the day. Boundaries are descriptive, not official:
 * trace = "measurable rain unlikely", light/moderate/heavy follow common
 * WMO-style usage for daily accumulation.
 */
export const RAIN_MM_THRESHOLDS = Object.freeze({
  traceAt: 0.2, // < 0.2 mm treated as effectively dry
  lightAbove: 2,
  moderateAbove: 10,
  heavyAbove: 20,
})

/** Daily maximum rain probability (%). Aligns with Member 2's rain bands. */
export const RAIN_PROBABILITY_THRESHOLDS = Object.freeze({
  cautionAt: 40,
  avoidAt: 70,
})

/** Heat that matters for field operations / evaporation notes (°C). */
export const FARM_HEAT_THRESHOLD = Object.freeze({ evaporationAt: 35 })

/**
 * Verdicts used by every planning window.
 *  - suitable: conditions look fine for this operation
 *  - caution:  possible, but watch the listed reasons
 *  - pause:     better to postpone today (rain likely to interfere)
 *  - unsuitable: conditions look wrong for this operation today
 *  - unknown:   too little forecast data to judge
 */
export const VERDICTS = Object.freeze(['suitable', 'caution', 'pause', 'unsuitable', 'unknown'])

export const VERDICT_LABELS = Object.freeze({
  suitable: 'Suitable',
  caution: 'Caution',
  pause: 'Postpone',
  unsuitable: 'Unsuitable',
  unknown: 'Not enough data',
})

/**
 * Operations and the forecast facts each one weighs. Exposed so the UI can
 * show "why" without re-implementing any rule.
 */
export const FARM_OPERATIONS = Object.freeze([
  {
    id: 'irrigation',
    label: 'Irrigation',
    blurb: 'Avoid irrigating just before good rain; water early in the day on hot, dry days.',
  },
  {
    id: 'sowing',
    label: 'Sowing / transplanting',
    blurb: 'Field work wants trafficable soil — not waterlogged after heavy rain, not dusty dry on sowing days.',
  },
  {
    id: 'harvest',
    label: 'Harvest / threshing',
    blurb: 'Ripe crop needs a dry window — even light rain or a high chance of rain can spoil cutting and drying.',
  },
])

/** Explainable reason texts keyed by id (English copy). */
export const FARM_REASON_TEXT = Object.freeze({
  dryDay: 'The day is forecast to stay dry (under {trace} mm).',
  lightRain: 'Light rain is forecast (about {mm} mm).',
  moderateRain: 'Moderate rain is forecast (about {mm} mm).',
  heavyRain: 'Heavy rain is forecast (about {mm} mm).',
  irrigationPauseRain: 'Rain is likely ({prob}%) — irrigating now would mostly be wasted water.',
  rainPossible: 'A chance of rain exists ({prob}% as the day’s maximum).',
  heavyRainRisk: 'Rain chance is high ({prob}%) — working with the crop or soil today is risky.',
  soilWet: 'Soil may be wet or waterlogged after forecast rain.',
  cropWet: 'Rain or a high chance of it would wet the crop — cutting and drying are risky.',
  highEvaporation: 'Temperatures up to {maxC}°C mean high midday evaporation — water early or late if you can.',
  wetHours: 'About {count} hours of the day have forecast rain.',
  noDailyData: 'No daily forecast is available for this day.',
  noHourlyData: 'Hourly forecast detail is missing — only daily values were judged.',
})

/** Disclaimer shown with every plan (copy only). */
export const FARM_DISCLAIMER =
  'Forecast-based planning suggestions only — not agronomic advice and not an official warning. Check official advisories for your district before acting.'
