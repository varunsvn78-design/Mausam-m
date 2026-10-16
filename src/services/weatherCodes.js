/**
 * WMO weather-code interpretation (Open-Meteo documented codes).
 * https://open-meteo.com/en/docs#weathervariables
 *
 * Codes are grouped into a small set of visual `group` values so the UI can
 * render one icon per group (with day/night variants where the data supports it).
 */

export const WEATHER_GROUPS = Object.freeze({
  CLEAR: 'clear',
  PARTLY_CLOUDY: 'partly-cloudy',
  CLOUDY: 'cloudy',
  FOG: 'fog',
  DRIZZLE: 'drizzle',
  RAIN: 'rain',
  SHOWERS: 'showers',
  SNOW: 'snow',
  THUNDERSTORM: 'thunderstorm',
  UNKNOWN: 'unknown',
})

const CODE_TABLE = {
  0: { group: WEATHER_GROUPS.CLEAR, day: 'Clear sky', night: 'Clear sky' },
  1: { group: WEATHER_GROUPS.CLEAR, day: 'Mainly clear', night: 'Mainly clear' },
  2: { group: WEATHER_GROUPS.PARTLY_CLOUDY, day: 'Partly cloudy', night: 'Partly cloudy' },
  3: { group: WEATHER_GROUPS.CLOUDY, day: 'Overcast', night: 'Overcast' },
  45: { group: WEATHER_GROUPS.FOG, day: 'Fog', night: 'Fog' },
  48: { group: WEATHER_GROUPS.FOG, day: 'Depositing rime fog', night: 'Depositing rime fog' },
  51: { group: WEATHER_GROUPS.DRIZZLE, day: 'Light drizzle', night: 'Light drizzle' },
  53: { group: WEATHER_GROUPS.DRIZZLE, day: 'Moderate drizzle', night: 'Moderate drizzle' },
  55: { group: WEATHER_GROUPS.DRIZZLE, day: 'Dense drizzle', night: 'Dense drizzle' },
  56: { group: WEATHER_GROUPS.DRIZZLE, day: 'Light freezing drizzle', night: 'Light freezing drizzle' },
  57: { group: WEATHER_GROUPS.DRIZZLE, day: 'Dense freezing drizzle', night: 'Dense freezing drizzle' },
  61: { group: WEATHER_GROUPS.RAIN, day: 'Slight rain', night: 'Slight rain' },
  63: { group: WEATHER_GROUPS.RAIN, day: 'Moderate rain', night: 'Moderate rain' },
  65: { group: WEATHER_GROUPS.RAIN, day: 'Heavy rain', night: 'Heavy rain' },
  66: { group: WEATHER_GROUPS.RAIN, day: 'Light freezing rain', night: 'Light freezing rain' },
  67: { group: WEATHER_GROUPS.RAIN, day: 'Heavy freezing rain', night: 'Heavy freezing rain' },
  71: { group: WEATHER_GROUPS.SNOW, day: 'Slight snowfall', night: 'Slight snowfall' },
  73: { group: WEATHER_GROUPS.SNOW, day: 'Moderate snowfall', night: 'Moderate snowfall' },
  75: { group: WEATHER_GROUPS.SNOW, day: 'Heavy snowfall', night: 'Heavy snowfall' },
  77: { group: WEATHER_GROUPS.SNOW, day: 'Snow grains', night: 'Snow grains' },
  80: { group: WEATHER_GROUPS.SHOWERS, day: 'Slight rain showers', night: 'Slight rain showers' },
  81: { group: WEATHER_GROUPS.SHOWERS, day: 'Moderate rain showers', night: 'Moderate rain showers' },
  82: { group: WEATHER_GROUPS.SHOWERS, day: 'Violent rain showers', night: 'Violent rain showers' },
  85: { group: WEATHER_GROUPS.SNOW, day: 'Slight snow showers', night: 'Slight snow showers' },
  86: { group: WEATHER_GROUPS.SNOW, day: 'Heavy snow showers', night: 'Heavy snow showers' },
  95: { group: WEATHER_GROUPS.THUNDERSTORM, day: 'Thunderstorm', night: 'Thunderstorm' },
  96: {
    group: WEATHER_GROUPS.THUNDERSTORM,
    day: 'Thunderstorm with slight hail',
    night: 'Thunderstorm with slight hail',
  },
  99: { group: WEATHER_GROUPS.THUNDERSTORM, day: 'Thunderstorm with heavy hail', night: 'Thunderstorm with heavy hail' },
}

/**
 * Convert a WMO weather code into a readable condition.
 *
 * @param {number|null|undefined} code
 * @param {boolean} [isDay=true] use daylight wording when the API provides `is_day`
 * @returns {{ code: number|null, label: string, group: string, isDay: boolean }}
 */
export function describeWeatherCode(code, isDay = true) {
  const missing = code === null || code === undefined || code === ''
  const numericCode = missing ? null : Number(code)
  const entry = numericCode === null ? undefined : CODE_TABLE[numericCode]

  if (!entry) {
    return {
      code: Number.isFinite(numericCode) ? numericCode : null,
      label: 'Unknown conditions',
      group: WEATHER_GROUPS.UNKNOWN,
      isDay: Boolean(isDay),
    }
  }

  return {
    code: numericCode,
    label: isDay ? entry.day : entry.night,
    group: entry.group,
    isDay: Boolean(isDay),
  }
}
