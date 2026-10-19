import { useState } from 'react'
import { DEMO_ALERT, ALERT_SEVERITY_META } from '../config/communityDemo.js'

/**
 * Clearly-labelled DEMO emergency banner (Member 3).
 * Simulated content only — never presented as an official notification.
 */
export function EmergencyAlertBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const severity = ALERT_SEVERITY_META[DEMO_ALERT.severity] ?? ALERT_SEVERITY_META.info

  return (
    <section
      className={`alert-banner alert-banner--${severity.tone}`}
      role="region"
      aria-label="Demonstration weather alert"
    >
      <div className="alert-banner__body">
        <div className="alert-banner__labels">
          <span className="badge badge--demo">DEMO ALERT — NOT AN OFFICIAL WARNING</span>
          <span className={`badge badge--${severity.tone}`}>{severity.label}</span>
        </div>
        <p className="alert-banner__headline">{DEMO_ALERT.headline}</p>
        <p className="alert-banner__detail">{DEMO_ALERT.detail}</p>
        <p className="alert-banner__meta">{DEMO_ALERT.sampleIssuedLabel}</p>
      </div>
      <button
        type="button"
        className="button button--ghost alert-banner__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss demo alert"
      >
        Dismiss
      </button>
    </section>
  )
}

export default EmergencyAlertBanner
