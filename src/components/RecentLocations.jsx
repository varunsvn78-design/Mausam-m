/**
 * Quick-pick list of recently selected locations (most recent first).
 * Rendered only when there is at least one entry.
 *
 * @param {{ locations: object[], onSelect: (location: object) => void, onClear: () => void, activeId?: string|null }} props
 */
export function RecentLocations({ locations, onSelect, onClear, activeId = null }) {
  if (!Array.isArray(locations) || locations.length === 0) return null

  return (
    <section className="recent-locations" aria-label="Recent locations">
      <div className="recent-locations__header">
        <span className="recent-locations__label">Recent locations</span>
        <button type="button" className="button button--ghost recent-locations__clear" onClick={onClear}>
          Clear
        </button>
      </div>
      <ul className="recent-locations__list">
        {locations.map((location) => {
          const meta = [location.district, location.region, location.country].filter(Boolean).join(', ')
          const isActive = activeId && location.id === activeId
          return (
            <li key={location.id}>
              <button
                type="button"
                className={isActive ? 'recent-locations__item is-active' : 'recent-locations__item'}
                onClick={() => onSelect(location)}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="recent-locations__name">{location.name}</span>
                {meta && <span className="recent-locations__meta">{meta}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default RecentLocations
