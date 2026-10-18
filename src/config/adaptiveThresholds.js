/**
 * Central threshold configuration for the Adaptive Experience (Member 2).
 *
 * Every number used by the activity-priority rules, the heat-stress panel and
 * the voice advisory lives here so the rules stay transparent and reviewable.
 * Components must not hard-code their own thresholds.
 *
 * UNITS (matching the NormalizedWeather contract, see weatherService.js):
 *   temperature / heat index : °C
 *   wind speed               : km/h
 *   probabilities            : %
 *
 * None of these values are official warnings; they are planning guidance
 * derived from forecast data. Sources noted per entry.
 */

/** Hourly precipitation_probability (%). */
export const RAIN_THRESHOLDS = Object.freeze({ cautionAt: 40, avoidAt: 70 })

/** Hourly wind_speed_10m (km/h). */
export const WIND_THRESHOLDS = Object.freeze({ cautionAt: 20, avoidAt: 35 })

/**
 * Heat stress (°C). Boundaries are the US NWS heat-index chart categories:
 * "Extreme Caution" begins at 90°F (32.2°C) and "Danger" at 103°F (39.4°C).
 * Used as planning thresholds only — never presented as an official warning.
 */
export const HEAT_THRESHOLDS = Object.freeze({ cautionAt: 32.2, avoidAt: 39.4 })

/** Air temperature (°C) for cool/cold conditions. */
export const COLD_THRESHOLDS = Object.freeze({ cautionAt: 10, avoidAt: 5 })

/**
 * Which inputs each factor reads and how it is judged.
 * `direction` decides the comparison: 'higherIsWorse' uses >=, 'lowerIsWorse' uses <=.
 */
export const FACTOR_DEFS = Object.freeze({
  rain: {
    id: 'rain',
    input: 'hourly precipitation_probability',
    unit: '%',
    direction: 'higherIsWorse',
    thresholds: RAIN_THRESHOLDS,
  },
  thunder: {
    id: 'thunder',
    input: 'hourly condition group',
    avoidGroups: ['thunderstorm'],
    cautionGroups: ['drizzle', 'rain', 'showers', 'snow'],
  },
  wind: {
    id: 'wind',
    input: 'hourly wind_speed_10m',
    unit: 'km/h',
    direction: 'higherIsWorse',
    thresholds: WIND_THRESHOLDS,
  },
  heat: {
    id: 'heat',
    // Prefer the calculated heat index; fall back to the API's apparent
    // temperature when the heat index is outside its validated range.
    input: 'estimated heat index, else hourly apparent_temperature',
    unit: '°C',
    direction: 'higherIsWorse',
    thresholds: HEAT_THRESHOLDS,
  },
  cold: {
    id: 'cold',
    input: 'hourly temperature_2m',
    unit: '°C',
    direction: 'lowerIsWorse',
    thresholds: COLD_THRESHOLDS,
  },
  fog: {
    id: 'fog',
    input: 'hourly condition group',
    cautionGroups: ['fog'],
  },
  dark: {
    id: 'dark',
    input: 'hourly is_day',
    cautionWhen: 'night',
  },
})

/* --------------------------------------------------------- heat index ----- */

/**
 * Validity window for the Rothfusz regression. The NWS documents acceptable
 * accuracy for air temperatures of at least 80°F (26.7°C) and relative
 * humidity of at least 40%; outside it we return "not calculated" rather
 * than a number we cannot stand behind.
 */
export const HEAT_INDEX_VALIDITY = Object.freeze({
  minTemperatureC: 27,
  minHumidityPercent: 40,
  maxTemperatureC: 60,
  maxHumidityPercent: 100,
})

/**
 * US NWS heat-index categories, matched in order against °F.
 * https://www.weather.gov/ama/heatindex (chart categories)
 */
export const HEAT_INDEX_CATEGORIES = Object.freeze([
  { minF: 124, id: 'extreme-danger' },
  { minF: 103, id: 'danger' },
  { minF: 90, id: 'extreme-caution' },
  { minF: 80, id: 'caution' },
])

/* ----------------------------------------------------------- wet bulb ----- */

/** Validity window for the Stull (2011) wet-bulb approximation. */
export const WET_BULB_VALIDITY = Object.freeze({
  minTemperatureC: -20,
  maxTemperatureC: 50,
  minHumidityPercent: 5,
  maxHumidityPercent: 99,
})

/**
 * Interpretation bands for the wet-bulb estimate (°C), matched in order.
 * Approximate physiological strain bands for prolonged outdoor effort;
 * indicative only, not an official standard. 35°C is the widely cited
 * theoretical survivability limit for a healthy adult in shade.
 */
export const WET_BULB_BANDS = Object.freeze([
  { minC: 35, id: 'limit' },
  { minC: 30, id: 'severe' },
  { minC: 28, id: 'high' },
  { minC: 25, id: 'elevated' },
  { minC: -Infinity, id: 'low' },
])
