import { useMemo } from 'react'
import { describeWeatherFeel } from '../services/weatherFeel.js'

const SOURCE_LABELS = Object.freeze({
  'heat-index': 'Heat-index estimate (temperature + humidity)',
  'apparent-temperature': 'Apparent temperature from the forecast model',
  'air-temperature': 'Air temperature (humidity or wind unavailable)',
})

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

/**
 * Member 4 — Weather-Feel Intelligence.
 *
 * Describes how the selected hour is likely to feel, choosing the honest
 * source (heat index, the model's apparent temperature, or plain air
 * temperature) and always labelling the number as an estimate. When Member 2's
 * 24-hour scrubber is present, this follows the hour the user selected;
 * otherwise it describes the current observation.
 *
 * @param {{
 *   weather: object|null,
 *   selectedPoint: object|null,   // hourly point mirrored from the chrono scrubber
 *   selection: { date: string, hour: number }|null,
 * }} props
 */
export function WeatherFeelCard({ weather, selectedPoint, selection }) {
  const point = selectedPoint ?? weather?.current ?? null
  const fromTimeline = Boolean(selectedPoint && selection)

  const feel = useMemo(
    () =>
      point
        ? describeWeatherFeel({
            temperature: point.temperature,
            relativeHumidity: point.relativeHumidity,
            windSpeed: point.windSpeed,
            apparentTemperature: point.apparentTemperature,
          })
        : null,
    [point],
  )

  const whenLabel = fromTimeline
    ? `Selected hour — ${selection.date} at ${formatHour(selection.hour)}`
    : point?.time
      ? `Current observation — ${point.time.slice(11, 16) || point.time}`
      : 'Current conditions'

  return (
    <section className="insight-card card" aria-labelledby="feel-heading">
      <header className="feel__head">
        <h3 id="feel-heading" className="insight-card__title">
          How it feels
        </h3>
        <p className="feel__when">{whenLabel}</p>
      </header>

      {!feel ? (
        <p className="muted">No forecast values are available to describe how it feels.</p>
      ) : feel.status === 'unavailable' ? (
        <p className="muted">
          {feel.reasons[0]?.text ?? 'A temperature is needed to estimate how it feels.'}
        </p>
      ) : (
        <>
          <div className="feel__body">
            <div className="feel__value">
              <span className="feel__number">{feel.feelsLikeC}</span>
              <span className="feel__unit">{feel.unit}</span>
            </div>
            <div className="feel__text">
              <p className="feel__label">{feel.label}</p>
              <p className="feel__detail">{feel.detail}</p>
              <p className="feel__source">{SOURCE_LABELS[feel.feelsLikeSource] ?? 'Estimated from forecast inputs'}</p>
            </div>
          </div>

          <dl className="metric-grid">
            <div className="metric">
              <dt>Air temperature</dt>
              <dd>{point.temperature === null || point.temperature === undefined ? '—' : `${point.temperature}°C`}</dd>
            </div>
            <div className="metric">
              <dt>Humidity</dt>
              <dd>
                {point.relativeHumidity === null || point.relativeHumidity === undefined
                  ? '—'
                  : `${point.relativeHumidity}%`}
              </dd>
            </div>
            <div className="metric">
              <dt>Wind</dt>
              <dd>
                {point.windSpeed === null || point.windSpeed === undefined ? '—' : `${point.windSpeed} km/h`}
              </dd>
            </div>
          </dl>

          {feel.reasons.length > 0 && (
            <div className="feel__reasons">
              <h4 className="feel__reasons-title">Why</h4>
              <ul>
                {feel.reasons.map((reason) => (
                  <li key={reason.id}>{reason.text}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="feel__estimate">{feel.estimateLabel}</p>
        </>
      )}
    </section>
  )
}

export default WeatherFeelCard
