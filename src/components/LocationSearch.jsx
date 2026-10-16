import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocationSearch } from '../hooks/useLocationSearch.js'
import UseMyLocationButton from './UseMyLocationButton.jsx'

const RESULT_LIMIT = 15

/**
 * Reusable city / town picker.
 *
 * - searches Open-Meteo Geocoding (debounced + cancellable)
 * - cascading Region -> District filters, populated from the returned results
 *   (Open-Meteo has no "list all districts" endpoint, so the cascade is derived
 *   from real API results only - nothing is hardcoded or invented)
 * - shows region + district + country when the API provides them, with a clear
 *   fallback when a district is not reported
 * - "Use my location" via the browser geolocation API
 * - keyboard accessible (ArrowUp/Down, Enter, Escape)
 *
 * @param {{ onSelect: (location: object) => void, autoFocus?: boolean, placeholder?: string, inputRef?: object }} props
 */
export function LocationSearch({ onSelect, autoFocus = false, placeholder = 'Search a city or town…', inputRef }) {
  const { query, setQuery, results, status, error, clear, retry, minQueryLength } = useLocationSearch({
    limit: RESULT_LIMIT,
  })
  const [highlighted, setHighlighted] = useState(-1)
  const [open, setOpen] = useState(false)
  const [regionFilter, setRegionFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const listboxId = useId()
  const rootRef = useRef(null)

  const isLoading = status === 'loading'
  const isError = status === 'error'
  const isEmpty = status === 'empty'
  const showPanel = open && query.trim().length >= minQueryLength

  const regionOptions = useMemo(
    () => Array.from(new Set(results.map((item) => item.region).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [results],
  )

  const districtOptions = useMemo(() => {
    const source = regionFilter ? results.filter((item) => item.region === regionFilter) : results
    return Array.from(new Set(source.map((item) => item.district).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [results, regionFilter])

  const visibleResults = useMemo(() => {
    return results.filter((item) => {
      if (regionFilter && item.region !== regionFilter) return false
      if (districtFilter && item.district !== districtFilter) return false
      return true
    })
  }, [results, regionFilter, districtFilter])

  const hasAnyDistrict = useMemo(() => results.some((item) => Boolean(item.district)), [results])
  const showCascade = regionOptions.length > 1 || districtOptions.length > 0

  // Reset highlight + filters whenever the result set changes.
  useEffect(() => {
    setHighlighted(-1)
    setOpen(results.length > 0 || isLoading || isError || isEmpty)
    setRegionFilter('')
    setDistrictFilter('')
  }, [results, isLoading, isError, isEmpty])

  // Close the result panel when clicking outside.
  useEffect(() => {
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [])

  const commit = (location) => {
    if (!location) return
    onSelect(location)
    clear()
    setOpen(false)
  }

  const onKeyDown = (event) => {
    if (!showPanel) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((current) => (visibleResults.length === 0 ? -1 : (current + 1) % visibleResults.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((current) =>
        visibleResults.length === 0 ? -1 : (current - 1 + visibleResults.length) % visibleResults.length,
      )
    } else if (event.key === 'Enter') {
      if (highlighted >= 0 && visibleResults[highlighted]) {
        event.preventDefault()
        commit(visibleResults[highlighted])
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
      setHighlighted(-1)
    }
  }

  const locationMeta = (location) =>
    [location.district, location.region, location.country].filter(Boolean).join(', ') || '—'

  return (
    <div className="location-search" ref={rootRef}>
      <label className="sr-only" htmlFor={`${listboxId}-input`}>
        Search for a city or town
      </label>
      <div className="location-search__field">
        <svg className="location-search__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          id={`${listboxId}-input`}
          ref={inputRef}
          className="location-search__input"
          type="search"
          value={query}
          autoFocus={autoFocus}
          autoComplete="off"
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-activedescendant={highlighted >= 0 ? `${listboxId}-option-${highlighted}` : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button type="button" className="location-search__clear" onClick={clear} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      <div className="location-search__actions">
        <UseMyLocationButton onSelect={commit} />
      </div>

      {showPanel && (
        <div className="location-search__panel">
          {isLoading && (
            <div className="location-search__message" role="status">
              <span className="spinner" aria-hidden="true" /> Searching…
            </div>
          )}

          {isError && (
            <div className="location-search__message location-search__message--error" role="alert">
              <span>{error?.message ?? 'Search failed.'}</span>
              <button type="button" className="button button--ghost" onClick={retry}>
                Retry
              </button>
            </div>
          )}

          {isEmpty && !isLoading && (
            <div className="location-search__message" role="status">
              No places found. Try a different spelling or a nearby larger town.
            </div>
          )}

          {status === 'success' && (
            <>
              {showCascade && (
                <div className="location-search__cascade">
                  <label className="location-search__cascade-field">
                    <span>Region / State</span>
                    <select
                      value={regionFilter}
                      onChange={(event) => {
                        setRegionFilter(event.target.value)
                        setDistrictFilter('')
                        setHighlighted(-1)
                      }}
                    >
                      <option value="">All regions</option>
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="location-search__cascade-field">
                    <span>District</span>
                    <select
                      value={districtFilter}
                      onChange={(event) => {
                        setDistrictFilter(event.target.value)
                        setHighlighted(-1)
                      }}
                      disabled={districtOptions.length === 0}
                    >
                      <option value="">
                        {districtOptions.length === 0 ? 'No district data' : 'All districts'}
                      </option>
                      {districtOptions.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {!hasAnyDistrict && (
                <p className="location-search__fallback">
                  District details are not provided by Open-Meteo for these results; showing the places that match.
                </p>
              )}

              {visibleResults.length > 0 ? (
                <ul className="location-search__results" role="listbox" id={listboxId} aria-label="Location results">
                  {visibleResults.map((location, index) => (
                    <li key={location.id}>
                      <button
                        type="button"
                        id={`${listboxId}-option-${index}`}
                        role="option"
                        aria-selected={index === highlighted}
                        className={
                          index === highlighted ? 'location-search__result is-highlighted' : 'location-search__result'
                        }
                        onMouseEnter={() => setHighlighted(index)}
                        onClick={() => commit(location)}
                      >
                        <span className="location-search__result-name">{location.name}</span>
                        <span className="location-search__result-meta">{locationMeta(location)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="location-search__message" role="status">
                  No places match the selected region and district. Adjust the filters or search again.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default LocationSearch
