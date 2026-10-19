import { useMemo } from 'react'
import { useRainReports } from '../hooks/useRainReports.js'
import CommunityMap from './CommunityMap.jsx'
import VillageCards from './VillageCards.jsx'
import ServiceCards from './ServiceCards.jsx'
import RainReportForm from './RainReportForm.jsx'

/**
 * Member 3 — Community, Maps & PWA section.
 *
 * Composes the demonstration map, simulated village and service cards, and
 * the local rain-check report form. Every record in this section is
 * demo/sample data or device-local storage — no live community backend
 * exists and none is implied.
 *
 * @param {{ location?: object|null }} props selected Member 1 location (for prefill + map marker)
 */
export function CommunitySection({ location }) {
  const { reports, submit, clear, clearFailed } = useRainReports()

  const defaultLocation = useMemo(() => {
    if (!location) return ''
    const meta = [location.district, location.region].filter(Boolean).join(', ')
    return meta ? `${location.name}, ${meta}` : location.name
  }, [location])

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

      <CommunityMap location={location} />

      <VillageCards />
      <ServiceCards />

      <RainReportForm
        defaultLocation={defaultLocation}
        reports={reports}
        onSubmit={submit}
        onClear={clear}
        clearFailed={clearFailed}
      />
    </section>
  )
}

export default CommunitySection
