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
        <header className="section-head">
          <p className="section-head__eyebrow">Outlook</p>
          <h2 id="forecast-heading" className="section-head__title">
            7-day forecast
          </h2>
        </header>
        <p className="muted">Daily forecast is not available for this location right now.</p>
      </section>
    )
  }

  const today = todayInTimeZone(timezone)

  const temps = daily.flatMap((day) => [day.temperatureMin, day.temperatureMax]).filter((t) => t !== null)
  const rangeMin = temps.length > 0 ? Math.min(...temps) : 0
  const rangeMax = temps.length > 0 ? Math.max(...temps) : 1
  const rangeSpan = Math.max(rangeMax - rangeMin, 1)

  return (
    <section className="card forecast" aria-labelledby="forecast-heading">
      <header className="section-head">
        <p className="section-head__eyebrow">Outlook</p>
        <h2 id="forecast-heading" className="section-head__title">
          7-day forecast
        </h2>
      </header>

      <ul className="forecast-list">
        {daily.map((day) => {
          const isToday = day.date === today
          const hasRange = day.temperatureMin !== null && day.temperatureMax !== null
          const left = hasRange ? ((day.temperatureMin - rangeMin) / rangeSpan) * 100 : 0
          const width = hasRange ? ((day.temperatureMax - day.temperatureMin) / rangeSpan) * 100 : 100
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

              <div
                className="forecast-item__range"
                role="img"
                aria-label={`Low ${formatTemperature(day.temperatureMin)}, high ${formatTemperature(
                  day.temperatureMax,
                )}`}
              >
                <span className="forecast-item__range-track" aria-hidden="true">
                  <span
                    className="forecast-item__range-fill"
                    style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }}
                  />
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
