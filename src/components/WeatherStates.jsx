import { formatLocalTimestamp, formatRelativeAge } from '../utils/format.js'

/** Skeleton shown while the first forecast for a location is loading. */
export function LoadingSkeleton({ label = 'Loading weather…' }) {
  return (
    <div className="stack" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="card skeleton skeleton--current">
        <div className="skeleton__line skeleton__line--sm" />
        <div className="skeleton__line skeleton__line--lg" />
        <div className="skeleton__grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton__block" />
          ))}
        </div>
      </div>
      <div className="card skeleton">
        <div className="skeleton__line skeleton__line--sm" />
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="skeleton__line" />
        ))}
      </div>
    </div>
  )
}

/** Shown before any location is selected. */
export function EmptyState({ onFocusSearch }) {
  return (
    <div className="card state-message state-message--empty">
      <h2>Choose a location</h2>
      <p>
        Search for a city or town above, or use your current location, to see current conditions and a 7-day forecast.
      </p>
      <button type="button" className="button button--primary" onClick={onFocusSearch}>
        Search a location
      </button>
    </div>
  )
}

/**
 * Error message with a retry control.
 * When cached data is displayed underneath, the copy makes clear it is not live.
 */
export function ErrorState({ error, onRetry, hasCachedData = false, isOnline = true }) {
  const message =
    error?.message ??
    (isOnline
      ? 'Something went wrong while loading the weather.'
      : 'You appear to be offline. Showing the last saved forecast if available.')

  return (
    <div className="card state-message state-message--error" role="alert">
      <h2>{hasCachedData ? 'Could not refresh the forecast' : 'Weather unavailable'}</h2>
      <p>{message}</p>
      {hasCachedData && (
        <p className="muted">
          The forecast below is the last successfully saved copy and may be out of date. Retry to fetch current data.
        </p>
      )}
      {onRetry && (
        <button type="button" className="button button--primary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

/** Persistent banner while the browser reports no connection. */
export function OfflineBanner() {
  return (
    <div className="banner banner--offline" role="status" aria-live="polite">
      <span className="banner__dot" aria-hidden="true" />
      You are offline. Showing the last saved forecast where available; live updates are paused.
    </div>
  )
}

/**
 * Banner for data restored from localStorage.
 * Always states when it was fetched - cached data is never presented as current.
 */
export function CachedDataBanner({ savedAt, ageMs, isStale, onRetry, isOnline = true }) {
  return (
    <div className="banner banner--cached" role="status" aria-live="polite">
      <span className="banner__dot" aria-hidden="true" />
      <span>
        {isStale ? 'Stale cached data' : 'Saved forecast'} — fetched {formatRelativeAge(ageMs)} (
        {formatLocalTimestamp(savedAt)}). Not live data.
      </span>
      {onRetry && isOnline && (
        <button type="button" className="button button--ghost" onClick={onRetry}>
          Refresh
        </button>
      )}
    </div>
  )
}

/** Open-Meteo attribution - required by the provider's terms. */
export function Attribution() {
  return (
    <footer className="attribution">
      <p>
        Weather data by{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener">
          Open-Meteo
        </a>{' '}
        (CC BY 4.0). Map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
          OpenStreetMap
        </a>{' '}
        contributors. This is a prototype and is <strong>not</strong> an official India Meteorological Department (IMD)
        service. Do not use it for safety-critical decisions.
      </p>
    </footer>
  )
}
