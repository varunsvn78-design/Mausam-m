import { useMemo } from 'react'
import {
  EXERCISE_VERDICT_LABELS,
  POLLUTANT_METRICS,
} from '../config/airQuality.js'
import { buildExercisePlan, describeAirQuality } from '../services/airQualityAdvisor.js'

function formatHour(hour) {
  return `${String(hour).padStart(2, '0')}:00`
}

function formatDate(date) {
  if (!date) return ''
  const parsed = new Date(`${date}T12:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function riskLabel(risk) {
  switch (risk) {
    case 'good':
      return 'good'
    case 'moderate':
      return 'moderate'
    case 'unhealthy-sensitive':
      return 'sensitive'
    case 'unhealthy':
    case 'very-unhealthy':
    case 'hazardous':
      return 'bad'
    default:
      return 'unknown'
  }
}

/**
 * Member 4 — Air Quality & Outdoor Activity Advisor.
 *
 * Shows the current US AQI reading with precaution copy, then compares each
 * hour of the day using both the air-quality forecast and Member 1's weather
 * forecast to surface genuinely better outdoor windows. Every verdict lists
 * its reasons. Guidance only — not an official bulletin and not medical advice.
 *
 * @param {{
 *   airQuality: object|null,
 *   weather: object|null,
 *   status: 'idle'|'loading'|'ready'|'error',
 *   error: Error|null,
 *   onRetry: () => void,
 * }} props
 */
export function AirQualityAdvisor({ airQuality, weather, status, error, onRetry }) {
  const reading = useMemo(() => describeAirQuality(airQuality?.current ?? null), [airQuality])

  const plan = useMemo(
    () => (airQuality ? buildExercisePlan({ airQuality, weather }) : null),
    [airQuality, weather],
  )

  if (status === 'loading' && !airQuality) {
    return (
      <div className="card state-message">
        <h3>Loading air quality…</h3>
        <p>Fetching the air-quality forecast for this location.</p>
      </div>
    )
  }

  if (!airQuality) {
    return (
      <div className="card state-message">
        <h3>Air quality not available</h3>
        <p>
          {status === 'error'
            ? error?.message
              ? `The air-quality forecast could not be loaded: ${error.message}`
              : 'The air-quality forecast could not be loaded. Check your connection and try again.'
            : 'Air-quality data has not been loaded for this location yet.'}
        </p>
        {status === 'error' && (
          <button type="button" className="button button--ghost" onClick={onRetry}>
            Retry air quality
          </button>
        )}
      </div>
    )
  }

  const dayPlan = plan && plan.status === 'ok' ? plan : null

  return (
    <div className="stack">
      <section className="insight-card card" aria-labelledby="aq-current-heading">
        <h3 id="aq-current-heading" className="insight-card__title">
          Current air quality
        </h3>

        {reading ? (
          <>
            <div className="aq-current" data-risk={riskLabel(reading.risk)}>
              <div className="aq-current__value">
                <span className="aq-current__number">{reading.usAqi ?? '—'}</span>
                <span className="aq-current__scale">US AQI</span>
              </div>
              <div className="aq-current__meta">
                <p className="aq-current__label">
                  <span className="aq-dot" aria-hidden="true" />
                  {reading.label}
                </p>
                <p className="aq-current__summary">{reading.summary}</p>
                {reading.time && (
                  <p className="aq-current__time">
                    Reading {reading.time.slice(11, 16) || reading.time} · {airQuality.source?.name ?? 'Open-Meteo'}
                    {airQuality.timezone ? ` · ${airQuality.timezone}` : ''}
                  </p>
                )}
              </div>
            </div>

            {reading.advice && <p className="aq-advice">{reading.advice}</p>}

            {reading.precautions.length > 0 && (
              <div className="aq-precautions">
                <h4 className="aq-precautions__title">Precautions to consider</h4>
                <ul>
                  {reading.precautions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <dl className="metric-grid">
              {POLLUTANT_METRICS.map((metric) => {
                const valueKey = metric.id === 'pm25' ? 'pm25' : 'pm10'
                const value = reading[valueKey]
                return (
                  <div className="metric" key={metric.id}>
                    <dt>{metric.label}</dt>
                    <dd>
                      {value === null ? '—' : value} <span className="metric__hint">{metric.unit}</span>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </>
        ) : (
          <p className="muted">
            No index or pollutant values were returned for this location. Air quality is not estimated.
          </p>
        )}
      </section>

      <section className="insight-card card" aria-labelledby="aq-windows-heading">
        <h3 id="aq-windows-heading" className="insight-card__title">
          Best outdoor windows {dayPlan ? `— ${formatDate(dayPlan.date)}` : ''}
        </h3>

        {dayPlan ? (
          <>
            <p className="aq-windows__best">
              {dayPlan.bestWindow
                ? `Best stretch: ${formatHour(dayPlan.bestWindow.startHour)}–${formatHour(
                    dayPlan.bestWindow.endHour + 1,
                  )}`
                : 'No two-hour stretch today is clearly clear of every caution. Check the hour-by-hour strip below.'}
            </p>

            <ol className="aq-strip" aria-label="Hourly outdoor suitability for the day">
              {dayPlan.hours.map((hour) => {
                const reasons = hour.reasons.map((r) => r.text).join(' ')
                return (
                  <li
                    key={hour.hour}
                    className="aq-strip__hour"
                    data-verdict={hour.verdict}
                    title={`${formatHour(hour.hour)} — ${EXERCISE_VERDICT_LABELS[hour.verdict]}${reasons ? `. ${reasons}` : ''}`}
                  >
                    <span className="aq-strip__bar" aria-hidden="true" />
                    <span className="aq-strip__time">{hour.hour}</span>
                    <span className="visually-hidden">
                      {formatHour(hour.hour)}: {EXERCISE_VERDICT_LABELS[hour.verdict]}
                    </span>
                  </li>
                )
              })}
            </ol>

            <ul className="aq-legend">
              {['recommended', 'caution', 'not-recommended', 'unknown'].map((verdict) => (
                <li key={verdict} className="aq-legend__item" data-verdict={verdict}>
                  <span className="aq-legend__swatch" aria-hidden="true" />
                  {EXERCISE_VERDICT_LABELS[verdict]}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">
            Hourly air quality was not returned, so no outdoor windows can be compared for today.
          </p>
        )}
      </section>
    </div>
  )
}

export default AirQualityAdvisor
