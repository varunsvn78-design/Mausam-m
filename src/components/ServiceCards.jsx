import { DEMO_SERVICES, AVAILABILITY_META } from '../config/communityDemo.js'

/**
 * Simulated unified-service cards (Member 3).
 * Availability values are sample records — never verified availability.
 */
export function ServiceCards() {
  if (DEMO_SERVICES.length === 0) {
    return (
      <div className="card state-message state-message--empty">
        <h4>No service records</h4>
        <p>No simulated service records are loaded for this demo.</p>
      </div>
    )
  }

  return (
    <div className="community-block">
      <header>
        <p className="community-block__eyebrow">Unified services</p>
        <h3 className="community-block__title">Simulated service availability</h3>
        <p className="community-block__hint">
          How unified-service cards would look in the platform. Statuses below are sample records, not verified
          availability of any real service.
        </p>
      </header>

      <ul className="card-grid demo-card-grid">
        {DEMO_SERVICES.map((service) => {
          const availability = AVAILABILITY_META[service.availability] ?? AVAILABILITY_META.unknown
          return (
            <li key={service.id} className="demo-card">
              <div className="demo-card__header">
                <div>
                  <h4 className="demo-card__name">{service.name}</h4>
                  <p className="demo-card__sub">{service.category}</p>
                </div>
                <span className="badge badge--demo">Demo</span>
              </div>

              <div>
                <span className={`badge badge--${availability.tone}`}>{availability.label}</span>
              </div>

              <p className="demo-card__detail">{service.detail}</p>

              <p className="demo-card__footer">{service.lastUpdatedLabel}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ServiceCards
