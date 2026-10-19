import { useMemo, useState } from 'react'
import { DEMO_VILLAGES, RAIN_STATUS_META } from '../config/communityDemo.js'

/**
 * Simulated village cards (Member 3). Every record is demo data and each
 * card says so; a filter exercises the empty state.
 */
export function VillageCards() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return DEMO_VILLAGES
    return DEMO_VILLAGES.filter(
      (village) =>
        village.name.toLowerCase().includes(needle) ||
        village.district.toLowerCase().includes(needle),
    )
  }, [query])

  return (
    <div className="community-block">
      <header>
        <p className="community-block__eyebrow">Village information</p>
        <h3 className="community-block__title">Simulated village records</h3>
        <p className="community-block__hint">
          Sample village cards for the prototype — rainfall figures and service lists are simulated, not a live
          rural directory.
        </p>
      </header>

      <div className="block-toolbar">
        <label className="field" style={{ flex: '1 1 240px', maxWidth: 360 }}>
          <span className="field__label">Filter villages</span>
          <input
            className="field__input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or district…"
          />
        </label>
        <span className="block-toolbar__count">
          {filtered.length} of {DEMO_VILLAGES.length} demo records
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card state-message state-message--empty">
          <h4>No demo villages match</h4>
          <p>Nothing matches “{query.trim()}”. Clear the filter to see all simulated village records.</p>
          <button type="button" className="button button--ghost" onClick={() => setQuery('')}>
            Clear filter
          </button>
        </div>
      ) : (
        <ul className="card-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {filtered.map((village) => {
            const status = RAIN_STATUS_META[village.status] ?? RAIN_STATUS_META.unknown
            return (
              <li key={village.id} className="demo-card">
                <div className="demo-card__header">
                  <div>
                    <h4 className="demo-card__name">{village.name}</h4>
                    <p className="demo-card__sub">{village.district}</p>
                  </div>
                  <span className="badge badge--demo">Demo</span>
                </div>

                <div className="demo-card__stat">
                  <span className="demo-card__stat-value">{village.rainfallMm.toFixed(1)}</span>
                  <span className="demo-card__stat-unit">mm sample rainfall</span>
                  <span className={`badge badge--${status.tone}`}>{status.label}</span>
                </div>

                <div>
                  <p className="demo-card__chips-label">Available services (sample)</p>
                  <div className="demo-card__chips">
                    {village.services.map((service) => (
                      <span key={service} className="badge badge--muted">
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="demo-card__footer">{village.lastUpdatedLabel}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default VillageCards
