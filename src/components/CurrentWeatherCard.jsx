import WeatherIcon from './WeatherIcon.jsx'
import { CloudDrizzle, CloudRain, Droplets, Moon, Sun, Thermometer, Wind } from 'lucide-react'
import {
  PLACEHOLDER,
  degreesToCompass,
  formatNumber,
  formatObservationTime,
  formatTemperature,
} from '../utils/format.js'

/**
 * Current conditions for the selected location.
 * Every metric tolerates `null` and renders a neutral placeholder instead.
 *
 * @param {{ weather: object }} props NormalizedWeather (see weatherService.js)
 */
export function CurrentWeatherCard({ weather }) {
  const { current, location, units } = weather
  const windDirection = degreesToCompass(current.windDirection)
  const isDay = current.isDay
  const locationMeta = [location?.district, location?.region, location?.country].filter(Boolean).join(', ')

  return (
    <section
      className="card current-weather"
      aria-labelledby="current-weather-heading"
      style={{ '--hero-tint': isDay ? 'var(--hero-day)' : 'var(--hero-night)' }}
    >
      <header className="current-weather__header">
        <div>
          <p className="current-weather__eyebrow">Current weather</p>
          <h2 id="current-weather-heading" className="current-weather__place">
            {location?.name ?? 'Selected location'}
          </h2>
          {(locationMeta || location?.source === 'coordinates') && (
            <p className="current-weather__region">
              {locationMeta || 'Approximate location from device GPS'}
            </p>
          )}
        </div>
        <div className="current-weather__main">
          <WeatherIcon
            group={current.condition.group}
            isDay={isDay}
            size={72}
            title={current.condition.label}
            className={`weather-icon--${isDay ? 'day' : 'night'}`}
          />
          <div className="current-weather__temp-block">
            <p className="current-weather__temp">{formatTemperature(current.temperature)}</p>
            <p className="current-weather__condition">{current.condition.label}</p>
          </div>
        </div>
      </header>

      <dl className="metric-grid">
        <div className="metric">
          <dt>
            <Thermometer size={14} aria-hidden="true" /> Feels like
          </dt>
          <dd>{formatTemperature(current.apparentTemperature)}</dd>
        </div>
        <div className="metric">
          <dt>
            <Droplets size={14} aria-hidden="true" /> Humidity
          </dt>
          <dd>{formatNumber(current.relativeHumidity, { suffix: units.humidity })}</dd>
        </div>
        <div className="metric">
          <dt>
            <Wind size={14} aria-hidden="true" /> Wind
          </dt>
          <dd>
            {formatNumber(current.windSpeed, { suffix: ` ${units.windSpeed}` })}
            {windDirection ? <span className="metric__hint"> from {windDirection}</span> : null}
          </dd>
        </div>
        <div className="metric">
          <dt>
            <CloudDrizzle size={14} aria-hidden="true" /> Rain chance
          </dt>
          <dd title="Precipitation probability for the current hour">
            {formatNumber(current.precipitationProbability, { suffix: units.precipitationProbability })}
          </dd>
        </div>
        <div className="metric">
          <dt>
            <CloudRain size={14} aria-hidden="true" /> Precipitation (1 h)
          </dt>
          <dd>{formatNumber(current.precipitation, { suffix: ` ${units.precipitation}`, digits: 1 })}</dd>
        </div>
        <div className="metric">
          <dt>
            {isDay ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />} Daylight
          </dt>
          <dd>{isDay ? 'Day' : 'Night'}</dd>
        </div>
      </dl>

      <footer className="current-weather__footer">
        <span>Observation: {current.time ? formatObservationTime(current.time) : PLACEHOLDER}</span>
        {weather.timezone && <span className="current-weather__tz">{weather.timezone}</span>}
      </footer>
    </section>
  )
}

export default CurrentWeatherCard
