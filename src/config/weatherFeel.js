/**
 * Weather-Feel configuration (Member 4): temperature bands, humidity/wind
 * modifiers and the copy for each feel category.
 *
 * All values are forecast inputs (°C, %, km/h — NormalizedWeather units).
 * "Feels like" outputs are ESTIMATES (heat index or the model's apparent
 * temperature), never measurements; the UI must label them as such.
 *
 * Components must not hard-code their own thresholds or copy.
 */

/**
 * Bands for the effective "feels like" temperature (°C), matched in order
 * against the estimate that weatherFeel.js resolves (heat index when valid,
 * else apparent temperature, else air temperature).
 */
export const FEEL_BANDS = Object.freeze([
  { min: 40, id: 'extreme-heat' },
  { min: 32, id: 'very-hot' },
  { min: 28, id: 'hot' },
  { min: 24, id: 'warm' },
  { min: 16, id: 'pleasant' },
  { min: 10, id: 'cool' },
  { min: 5, id: 'cold' },
  { min: -Infinity, id: 'freezing' },
])

/**
 * Humidity modifiers applied to the hot/warm bands to distinguish muggy
 * heat from dry heat. `relativeHumidity` in %.
 */
export const FEEL_HUMIDITY = Object.freeze({
  humidAt: 60, // % - at or above this, hot weather feels muggy
  dryAt: 40, // % - at or below this, hot weather feels dry
})

/** Wind modifiers (km/h). */
export const FEEL_WIND = Object.freeze({
  breezyAt: 15,
  windyAt: 25,
})

/** Copy per category id. */
export const FEEL_CATEGORIES = Object.freeze({
  'extreme-heat': {
    label: 'Dangerously hot',
    detail: 'Dangerous heat. Limit time outdoors, seek shade or air conditioning, and drink water regularly.',
  },
  'very-hot': {
    label: 'Very hot',
    detail: 'Very hot conditions. Outdoor effort will be stressful — take frequent breaks in the shade.',
  },
  hot: {
    label: 'Hot',
    detail: 'Hot conditions. Choose cooler parts of the day for outdoor activity.',
  },
  warm: {
    label: 'Warm',
    detail: 'Warm and generally comfortable; stay hydrated during prolonged activity.',
  },
  pleasant: {
    label: 'Pleasant',
    detail: 'Comfortable conditions for being outdoors.',
  },
  cool: {
    label: 'Cool',
    detail: 'Cool — a light layer will keep you comfortable at rest.',
  },
  cold: {
    label: 'Cold',
    detail: 'Cold — dress in warm layers, especially for stopped or low-output activity.',
  },
  freezing: {
    label: 'Freezing',
    detail: 'Freezing conditions. Cover exposed skin and limit time still outdoors.',
  },
})

/** Muggy/dry variants only apply where humidity actually changes the story. */
export const FEEL_VARIANTS = Object.freeze({
  humid: { suffix: ' and humid', detailSuffix: ' Humidity is high, so it will feel muggier than the air temperature suggests.' },
  dry: { suffix: ' and dry', detailSuffix: ' The air is dry, so sweat will evaporate quickly — keep drinking water.' },
  breezy: { suffix: ' and breezy', detailSuffix: ' A breeze will take the edge off heat, but adds wind chill when it is cold.' },
  windy: { suffix: ' and windy', detailSuffix: ' Windy — secure loose items and expect it to feel cooler than the thermometer in cold weather.' },
})

/** Reason ids returned by the service, with English text. */
export const FEEL_REASON_TEXT = Object.freeze({
  heatIndexUsed: 'Feels-like estimate uses the heat index (temperature + humidity).',
  apparentUsed: 'Feels-like estimate uses the model’s apparent temperature (temperature + humidity + wind).',
  airTemperatureUsed: 'No humidity or wind data available — the air temperature itself is shown.',
  heatIndexUnavailable: 'Heat index is outside its validated range for these conditions, so other inputs are used.',
  humidityMissing: 'Humidity is missing from the forecast for this hour.',
  windMissing: 'Wind speed is missing from the forecast for this hour.',
  highHumidity: 'High humidity makes the same temperature feel warmer.',
  lowHumidity: 'Low humidity makes the same temperature feel drier.',
  missingTemperature: 'No temperature is available for this time — a feel cannot be estimated.',
})

/** Label for estimates everywhere they appear. */
export const FEEL_ESTIMATE_LABEL = 'Estimated from forecast inputs — not a measured value.'
