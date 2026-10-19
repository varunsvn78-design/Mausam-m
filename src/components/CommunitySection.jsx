import { useId, useMemo, useRef, useState } from 'react'
import { useRainReports } from '../hooks/useRainReports.js'
import CommunityMap from './CommunityMap.jsx'
import VillageCards from './VillageCards.jsx'
import ServiceCards from './ServiceCards.jsx'
import RainReportForm from './RainReportForm.jsx'

const TABS = [
  { id: 'map', label: 'Rain map' },
  { id: 'records', label: 'Village & services' },
  { id: 'reports', label: 'Rain check' },
]

/**
 * Member 3 — Community, Maps & PWA section.
 *
 * Composes the demonstration map, simulated village and service cards, and
 * the local rain-check report form behind an accessible tab set so the
 * secondary features never stack up on the main weather journey. Every
 * record in this section is demo/sample data or device-local storage — no
 * live community backend exists and none is implied.
 *
 * @param {{ location?: object|null }} props selected Member 1 location (for prefill + map marker)
 */
export function CommunitySection({ location }) {
  const { reports, submit, clear, clearFailed } = useRainReports()
  const [activeTab, setActiveTab] = useState('map')
  const tablistId = useId()
  const tabRefs = useRef([])

  const defaultLocation = useMemo(() => {
    if (!location) return ''
    const meta = [location.district, location.region].filter(Boolean).join(', ')
    return meta ? `${location.name}, ${meta}` : location.name
  }, [location])

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
    <section className="community" aria-labelledby="community-heading">
      <header>
        <p className="community__eyebrow">Community &amp; maps</p>
        <h2 id="community-heading" className="community__title">
          Rain reports, demo map &amp; services
        </h2>
        <p className="community__intro">
          This section demonstrates community reporting, mapping and service cards for the prototype. All markers,
          village records and service statuses here are <strong>clearly-labelled demonstration data</strong>, and
          reports stay on this device.
        </p>
      </header>

      <div className="community-tabs">
        <div className="community-tabs__list" role="tablist" aria-label="Community tools" id={tablistId}>
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
              className={`community-tabs__tab${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${tablistId}-panel-map`}
          aria-labelledby={`${tablistId}-tab-map`}
          hidden={activeTab !== 'map'}
          tabIndex={0}
          className="community-tabs__panel"
        >
          <CommunityMap location={location} isActive={activeTab === 'map'} />
        </div>

        <div
          role="tabpanel"
          id={`${tablistId}-panel-records`}
          aria-labelledby={`${tablistId}-tab-records`}
          hidden={activeTab !== 'records'}
          tabIndex={0}
          className="community-tabs__panel"
        >
          <VillageCards />
          <ServiceCards />
        </div>

        <div
          role="tabpanel"
          id={`${tablistId}-panel-reports`}
          aria-labelledby={`${tablistId}-tab-reports`}
          hidden={activeTab !== 'reports'}
          tabIndex={0}
          className="community-tabs__panel"
        >
          <RainReportForm
            defaultLocation={defaultLocation}
            reports={reports}
            onSubmit={submit}
            onClear={clear}
            clearFailed={clearFailed}
          />
        </div>
      </div>
    </section>
  )
}

export default CommunitySection
