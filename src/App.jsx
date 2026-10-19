import { useRef } from 'react'
import { useWeatherEngine } from './hooks/useWeatherEngine.js'
import LocationSearch from './components/LocationSearch.jsx'
import CurrentWeatherCard from './components/CurrentWeatherCard.jsx'
import AdaptiveExperience from './components/AdaptiveExperience.jsx'
import DailyForecast from './components/DailyForecast.jsx'
import RecentLocations from './components/RecentLocations.jsx'
import EmergencyAlertBanner from './components/EmergencyAlertBanner.jsx'
import ConnectivityPill from './components/ConnectivityPill.jsx'
import CommunitySection from './components/CommunitySection.jsx'
import PwaStatus from './components/PwaStatus.jsx'
import {
  Attribution,
  CachedDataBanner,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  OfflineBanner,
} from './components/WeatherStates.jsx'
import './App.css'
import './community.css'

export default function App() {
  const searchInputRef = useRef(null)
  const {
    isOnline,
    location,
    weather,
    status,
    error,
    cacheInfo,
    isLoading,
    recentLocations,
    selectLocation,
    clearLocation,
    clearRecent,
    retry,
  } = useWeatherEngine()

  const focusSearch = () => searchInputRef.current?.focus()
  const hasWeather = Boolean(weather)
  const showInitialLoading = isLoading && !hasWeather
  const showEmpty = status === 'empty' && !hasWeather
  const showFatalError = status === 'error' && !hasWeather
  const locationMeta = location
    ? [location.district, location.region, location.country].filter(Boolean).join(', ')
    : ''

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <path
                d="M9 22h13a5 5 0 0 0 .4-10A7.5 7.5 0 0 0 8 13.6 4.8 4.8 0 0 0 9 22Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </span>
          <div>
            <h1 className="app__title">MAUSAM</h1>
            <p className="app__subtitle">Weather Engine</p>
          </div>
          <ConnectivityPill isOnline={isOnline} />
        </div>

        <div className="app__search">
          <LocationSearch onSelect={selectLocation} inputRef={searchInputRef} />
        </div>
      </header>

      <div className="app__status" aria-live="polite">
        <PwaStatus />
        <EmergencyAlertBanner />
        {!isOnline && <OfflineBanner />}
        {cacheInfo && (
          <CachedDataBanner
            savedAt={cacheInfo.savedAt}
            ageMs={cacheInfo.ageMs}
            isStale={cacheInfo.isStale}
            isOnline={isOnline}
            onRetry={retry}
          />
        )}
      </div>

      <main className="app__main">
        {recentLocations.length > 0 && (
          <RecentLocations
            locations={recentLocations}
            onSelect={selectLocation}
            onClear={clearRecent}
            activeId={location?.id ?? null}
          />
        )}

        {location && (
          <div className="selected-location">
            <div>
              <span className="selected-location__label">
                {location.source === 'coordinates' ? 'Current location (device GPS)' : 'Selected location'}
              </span>
              <span className="selected-location__name">
                {location.name}
                {locationMeta ? `, ${locationMeta}` : ''}
              </span>
              <span className="selected-location__coords">
                {Number(location.latitude).toFixed(3)}, {Number(location.longitude).toFixed(3)}
                {weather?.timezone ? ` · ${weather.timezone}` : ''}
              </span>
              {location.source !== 'coordinates' && !location.district && (
                <span className="selected-location__fallback">
                  District not reported by Open-Meteo for this place
                </span>
              )}
            </div>
            <div className="selected-location__actions">
              {hasWeather && !isLoading && (
                <button type="button" className="button button--ghost" onClick={retry}>
                  Refresh
                </button>
              )}
              <button type="button" className="button button--ghost" onClick={clearLocation}>
                Clear
              </button>
            </div>
          </div>
        )}

        {showEmpty && <EmptyState onFocusSearch={focusSearch} />}

        {showInitialLoading && <LoadingSkeleton />}

        {showFatalError && (
          <ErrorState error={error} onRetry={location ? retry : undefined} isOnline={isOnline} />
        )}

        {hasWeather && (
          <div className="stack">
            {status === 'error' && (
              <ErrorState error={error} onRetry={retry} hasCachedData={Boolean(cacheInfo)} isOnline={isOnline} />
            )}
            {isLoading && (
              <p className="refreshing" role="status">
                <span className="spinner" aria-hidden="true" /> Refreshing forecast…
              </p>
            )}
            <CurrentWeatherCard weather={weather} />
            <AdaptiveExperience weather={weather} />
            <DailyForecast weather={weather} />
            <p className="data-timestamp">
              Data fetched {weather.fetchedAt ? new Date(weather.fetchedAt).toLocaleString() : ''} · Source:{' '}
              {weather.source?.name ?? 'Open-Meteo'}
            </p>
          </div>
        )}

        <CommunitySection location={location} />
      </main>

      <Attribution />
    </div>
  )
}
