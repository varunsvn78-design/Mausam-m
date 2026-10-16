import WeatherIcon from './WeatherIcon.jsx'
import {
  PLACEHOLDER,
  formatDateLabel,
  formatFullDate,
  formatNumber,
  formatTemperature,
  formatWeekday,
  todayInTimeZone,
} from '../utils/format.js'

/**
 * Seven-day daily forecast. Dates come straight from the API and are labelled
 * using the location's timezone, so they are never shifted or mislabelled.
 *
 * @param {{ weather: object }} props NormalizedWeather (see weatherService.js)
 */
export function DailyForecast({ weather }) {
  const { daily, units, timezone } = weather

  if (!Array.isArray(daily) || daily.length === 0) {
    return (
      <section className="card forecast" aria-labelledby="forecast-heading">
        <h2 id="forecast-heading" className="section-heading">
          7-day forecast
        </h2>
        <p className="muted">Daily forecast is not available for this location right now.</p>
      </section>
    )
  }

  const today = todayInTimeZone(timezone)

  return (
    <section className="card forecast" aria-labelledby="forecast-heading">
      <h2 id="forecast-heading" className="section-heading">
        7-day forecast
      </h2>

      <ul className="forecast-list">
        {daily.map((day) => {
          const isToday = day.date === today
          return (
            <li key={day.date} className="forecast-item">
              <div className="forecast-item__date">
                <span className="forecast-item__weekday">
                  {isToday ? 'Today' : formatWeekday(day.date)}
                  <span className="sr-only"> {formatFullDate(day.date)}</span>
                </span>
                <span className="forecast-item__date-label" aria-hidden="true">
                  {formatDateLabel(day.date)}
                </span>
              </div>

              <WeatherIcon
                group={day.condition.group}
                isDay
                size={40}
                title={day.condition.label}
                className="forecast-item__icon"
              />

              <div className="forecast-item__condition">
                <span>{day.condition.label}</span>
                <span className="forecast-item__precip" title="Chance of precipitation">
                  {day.precipitationProbability === null || day.precipitationProbability === undefined
                    ? `${PLACEHOLDER} rain`
                    : `${formatNumber(day.precipitationProbability, { suffix: units.precipitationProbability })} rain`}
                </span>
              </div>

              <div className="forecast-item__temps">
                <span className="forecast-item__temp-max">{formatTemperature(day.temperatureMax)}</span>
                <span className="forecast-item__temp-min">{formatTemperature(day.temperatureMin)}</span>
              </div>

              <div className="forecast-item__wind" title="Maximum wind speed">
                {formatNumber(day.windSpeedMax, { suffix: ` ${units.windSpeed}` })}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default DailyForecast
