import { useId, useRef, useState } from 'react'
import AirQualityAdvisor from './AirQualityAdvisor.jsx'
import FarmerRainPlanner from './FarmerRainPlanner.jsx'
import WeatherFeelCard from './WeatherFeelCard.jsx'
import '../insights.css'

const TABS = [
  { id: 'air', label: 'Air & outdoors' },
  { id: 'farm', label: 'Farm planner' },
  { id: 'feel', label: 'Weather feel' },
]

/**
 * Member 4 — Insights section.
 *
 * Groups the three decision-support modules behind an accessible tab set so
 * the main weather journey stays uncluttered:
 *   - Air & outdoors: current air quality + best exercise windows today
 *   - Farm planner:   per-day rain totals and operation windows
 *   - Weather feel:   how the chrono-selected hour is likely to feel
 *
 * All three are forecast-based planning guidance (never official warnings,
 * medical advice or agronomic advice), and each states its own scope.
 *
 * @param {{
 *   weather: object|null,
 *   airQuality: object|null,
 *   airQualityStatus: string,
 *   airQualityError: Error|null,
 *   onRetryAirQuality: () => void,
 *   selectedPoint: object|null,
 *   selection: { date: string, hour: number }|null,
 * }} props
 */
export function InsightsSection({
  weather,
  airQuality,
  airQualityStatus,
  airQualityError,
  airQualitySavedAt = null,
  airQualityRefreshFailed = false,
  onRetryAirQuality,
  selectedPoint,
  selection,
}) {
  const [activeTab, setActiveTab] = useState('air')
  const tablistId = useId()
  const tabRefs = useRef([])

  const onTabKeyDown = (event, index) => {
    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = TABS.length - 1
    if (next === null) return
    event.preventDefault()
    setActiveTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="insights" aria-labelledby="insights-heading">
      <header className="section-head">
        <p className="section-head__eyebrow">Decision support</p>
        <h2 id="insights-heading" className="section-head__title">
          Air, farming &amp; how it feels
        </h2>
        <p className="section-head__intro">
          Planning guidance built from the forecast: air-quality-aware outdoor windows, a rain-aware field plan, and a
          plain-language feel for the hour you select. These are estimates and suggestions — not official warnings,
          medical advice or agronomic advice.
        </p>
      </header>

      <div className="insights-tabs">
        <div className="insights-tabs__list" role="tablist" aria-label="Insight tools" id={tablistId}>
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`${tablistId}-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`${tablistId}-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`insights-tabs__tab${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${tablistId}-panel-air`}
          aria-labelledby={`${tablistId}-tab-air`}
          hidden={activeTab !== 'air'}
          tabIndex={0}
          className="insights-tabs__panel"
        >
          <AirQualityAdvisor
            airQuality={airQuality}
            weather={weather}
            status={airQualityStatus}
            error={airQualityError}
            savedAt={airQualitySavedAt}
            refreshFailed={airQualityRefreshFailed}
            onRetry={onRetryAirQuality}
          />
        </div>

        <div
          role="tabpanel"
          id={`${tablistId}-panel-farm`}
          aria-labelledby={`${tablistId}-tab-farm`}
          hidden={activeTab !== 'farm'}
          tabIndex={0}
          className="insights-tabs__panel"
        >
          <FarmerRainPlanner weather={weather} />
        </div>

        <div
          role="tabpanel"
          id={`${tablistId}-panel-feel`}
          aria-labelledby={`${tablistId}-tab-feel`}
          hidden={activeTab !== 'feel'}
          tabIndex={0}
          className="insights-tabs__panel"
        >
          <WeatherFeelCard weather={weather} selectedPoint={selectedPoint} selection={selection} />
        </div>
      </div>
    </section>
  )
}

export default InsightsSection
