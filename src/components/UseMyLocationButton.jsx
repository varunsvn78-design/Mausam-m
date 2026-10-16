import { useState } from 'react'
import { useGeolocation } from '../hooks/useGeolocation.js'
import { createLocationFromCoordinates } from '../services/geocodingService.js'

/**
 * "Use my location" control.
 *
 * Requests the browser position only when clicked, converts it into the
 * app-wide NormalizedLocation contract (Open-Meteo has no reverse geocoding, so
 * the place is labelled "My location"), and calls `onSelect`.
 *
 * @param {{ onSelect: (location: object) => void, className?: string }} props
 */
export function UseMyLocationButton({ onSelect, className }) {
  const { supported, error, isLocating, locate } = useGeolocation()
  const [announcement, setAnnouncement] = useState('')

  const handleClick = async () => {
    setAnnouncement('')
    try {
      const coords = await locate()
      onSelect(createLocationFromCoordinates(coords))
      setAnnouncement('Using your current location.')
    } catch (err) {
      setAnnouncement(err?.message ?? 'Could not determine your location.')
    }
  }

  const busy = isLocating
  const disabled = busy || !supported

  return (
    <div className={['use-my-location', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="button button--ghost use-my-location__button"
        onClick={handleClick}
        disabled={disabled}
        aria-busy={busy}
        title={supported ? undefined : 'Geolocation is not supported by this browser'}
      >
        <svg className="use-my-location__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <circle cx="12" cy="12" r="8" />
        </svg>
        {busy ? 'Locating…' : 'Use my location'}
      </button>

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      {!supported && (
        <p className="use-my-location__note muted">
          Location is not available in this browser. Search for a city instead.
        </p>
      )}

      {supported && error && (
        <p className="use-my-location__note use-my-location__note--error" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}

export default UseMyLocationButton
