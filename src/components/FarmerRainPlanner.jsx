import { useMemo } from 'react'
import { RAIN_MM_THRESHOLDS } from '../config/farmerPlanner.js'
import { buildFarmPlan } from '../services/farmerPlanner.js'

const RAIN_BAR_MAX_MM = RAIN_MM_THRESHOLDS.heavyAbove // full bar at the "heavy" line

function formatDay(date) {
  if (!date) return ''
  const parsed = new Date(`${date}T12:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function verdictClass(verdict) {
  return `farm-op farm-op--${verdict}`
}

/**
 * Member 4 — Farmer's Rain Planner.
 *
 * Per-day rain totals (summed from the hourly forecast) with planning windows
 * for irrigation, sowing/transplanting and harvest/threshing. Every verdict
 * shows the forecast facts behind it, and the section carries the scope
 * disclaimer at all times: forecast-based planning suggestions only.
 *
 * @param {{ weather: object|null }} props NormalizedWeather
 */
export function FarmerRainPlanner({ weather }) {
  const plan = useMemo(() => buildFarmPlan(weather), [weather])

  if (plan.status !== 'ok' || plan.days.length === 0) {
    return (
      <div className="card state-message">
        <h3>Rain plan not available</h3>
        <p>This plan needs the weather forecast loaded for a location.</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="farm-summary">
        Rain totals below are the <strong>sum of forecast hourly precipitation</strong> for each day. Operation
        windows weigh those totals, the day’s maximum rain chance and the expected heat — with the reasons shown next
        to every verdict.
      </p>

      <div className="farm-days">
        {plan.days.map((day) => {
          const barWidth = day.rainMm === null ? 0 : Math.min(100, Math.round((day.rainMm / RAIN_BAR_MAX_MM) * 100))
          const rainLabel = day.rainMm === null ? 'No hourly precipitation data' : `${day.rainMm} mm`
          return (
            <article className="farm-day card" key={day.date}>
              <header className="farm-day__head">
                <div>
                  <h3 className="farm-day__date">{formatDay(day.date)}</h3>
                  <p className="farm-day__condition">{day.condition?.label ?? 'Forecast'}</p>
                </div>
                <div className="farm-day__totals">
                  <span className="farm-day__rain">{rainLabel}</span>
                  <span className="farm-day__misc">
                    {day.rainProbabilityMax === null ? 'Rain chance n/a' : `${day.rainProbabilityMax}% rain chance`}
                    {day.temperatureMax === null ? '' : ` · max ${day.temperatureMax}°C`}
                  </span>
                  {!day.rainMmComplete && day.rainMm !== null && (
                    <span className="farm-day__partial">partial hourly data</span>
                  )}
                </div>
              </header>

              <div className="farm-day__bar" aria-hidden="true">
                <span className="farm-day__bar-fill" style={{ width: `${barWidth}%` }} />
              </div>

              <ul className="farm-ops">
                {plan.operations.map((op) => {
                  const entry = day.windows[op.id]
                  if (!entry) return null
                  const label = plan.verdictLabels[entry.verdict] ?? entry.verdict
                  return (
                    <li className={verdictClass(entry.verdict)} key={op.id}>
                      <div className="farm-op__head">
                        <span className="farm-op__label">{op.label}</span>
                        <span className="farm-op__verdict">{label}</span>
                      </div>
                      {entry.reasons.length > 0 && (
                        <ul className="farm-op__reasons">
                          {entry.reasons.map((reason) => (
                            <li key={`${reason.id}-${reason.text}`}>{reason.text}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </article>
          )
        })}
      </div>

      <p className="farm-disclaimer" role="note">
        {plan.disclaimer}
      </p>
    </div>
  )
}

export default FarmerRainPlanner
