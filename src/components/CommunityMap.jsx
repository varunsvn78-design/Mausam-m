import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { WifiOff } from 'lucide-react'
import { DEMO_MARKERS, RAIN_STATUS_META, MAP_FALLBACK_VIEW } from '../config/communityDemo.js'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'

const OSM_ATTRIBUTION =
  'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function isValidCoord(latitude, longitude) {
  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180
  )
}

function markerHtml(tone, extraClass = '') {
  return `<span class="demo-marker demo-marker--${tone} ${extraClass}" aria-hidden="true"></span>`
}

function popupHtml({ name, badgeTone, badgeLabel, rows, note }) {
  const rowHtml = rows
    .filter(Boolean)
    .map((row) => `<p class="demo-map-popup__row">${escapeHtml(row)}</p>`)
    .join('')
  return `
    <div class="demo-map-popup">
      <p class="demo-map-popup__name">${escapeHtml(name)}</p>
      <span class="badge badge--${badgeTone} demo-map-popup__badge">${escapeHtml(badgeLabel)}</span>
      ${rowHtml}
      <p class="demo-map-popup__note">${escapeHtml(note)}</p>
    </div>`
}

function buildLegendHtml() {
  const items = [
    ['info', 'No rain (demo)'],
    ['primary', 'Light rain (demo)'],
    ['warning', 'Moderate rain (demo)'],
    ['danger', 'Heavy rain / storm (demo)'],
    ['you', 'Your selected location'],
  ]
    .map(
      ([tone, label]) =>
        `<p class="demo-map-legend__item"><span class="demo-map-legend__dot demo-marker--${tone}"></span>${label}</p>`,
    )
    .join('')
  return `
    <p class="demo-map-legend__title">Legend</p>
    ${items}
    <p class="demo-map-legend__note">Markers show demonstration data only — not live observations.</p>`
}

/**
 * Interactive Leaflet map (Member 3) with static, clearly-labelled
 * demonstration markers.
 *
 * - Verified city coordinates as static demo anchor points (config only).
 * - divIcon markers (no external marker images) + legend + OSM attribution.
 * - Loading, error (with retry), and offline-tile states.
 * - Resizes with its container (ResizeObserver → invalidateSize) and on
 *   window resize (Leaflet handles window resize itself).
 *
 * @param {{ location?: object|null, isActive?: boolean }} props selected Member 1
 *        location; `isActive` re-syncs Leaflet's size when the parent tab is
 *        (re)shown after being hidden.
 */
export function CommunityMap({ location, isActive = true }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const youMarkerRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [attempt, setAttempt] = useState(0)
  const isOnline = useOnlineStatus()

  // Leaflet mis-measures a container that was display:none (hidden tab);
  // re-validate the size whenever the tab becomes visible again.
  useEffect(() => {
    if (!isActive || !mapRef.current) return undefined
    const frame = window.requestAnimationFrame(() => {
      try {
        mapRef.current?.invalidateSize()
      } catch {
        /* map already torn down */
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isActive])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    let map = null
    let resizeObserver = null
    setStatus('loading')

    try {
      map = L.map(container, {
        center: MAP_FALLBACK_VIEW.center,
        zoom: MAP_FALLBACK_VIEW.zoom,
        keyboard: true,
        ariaLabel: 'Demonstration rain map of India with sample markers',
      })
      mapRef.current = map

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map)

      const validMarkers = []
      for (const marker of DEMO_MARKERS) {
        if (!isValidCoord(marker.latitude, marker.longitude)) continue
        const meta = RAIN_STATUS_META[marker.status] ?? RAIN_STATUS_META.unknown
        const leafletMarker = L.marker([marker.latitude, marker.longitude], {
          icon: L.divIcon({
            className: '',
            html: markerHtml(meta.tone),
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
          title: `${marker.name} — demo marker`,
          alt: `${marker.name} — demonstration marker with simulated rainfall status`,
          keyboard: true,
        })
        leafletMarker.bindPopup(
          popupHtml({
            name: marker.name,
            badgeTone: 'demo',
            badgeLabel: 'DEMO DATA',
            rows: [
              `Sample rainfall status: ${meta.label} (${marker.rainfallMm.toFixed(1)} mm)`,
              marker.updatedLabel,
            ],
            note: marker.note,
          }),
        )
        leafletMarker.addTo(map)
        validMarkers.push([marker.latitude, marker.longitude])
      }

      if (validMarkers.length > 1) {
        map.fitBounds(L.latLngBounds(validMarkers), { padding: [40, 40], maxZoom: 6 })
      }

      const legend = L.control({ position: 'topright' })
      legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'demo-map-legend')
        div.innerHTML = buildLegendHtml()
        L.DomEvent.disableClickPropagation(div)
        return div
      }
      legend.addTo(map)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          try {
            map.invalidateSize()
          } catch {
            /* map already torn down */
          }
        })
        resizeObserver.observe(container)
      }

      setStatus('ready')
    } catch (error) {
      console.error('Map initialisation failed:', error)
      setStatus('error')
      try {
        map?.remove()
      } catch {
        /* nothing else to clean up */
      }
      mapRef.current = null
      return undefined
    }

    return () => {
      resizeObserver?.disconnect()
      try {
        youMarkerRef.current?.remove()
      } catch {
        /* marker already gone */
      }
      youMarkerRef.current = null
      try {
        map.remove()
      } catch {
        /* already removed */
      }
      mapRef.current = null
    }
  }, [attempt])

  // Selected-location marker (Member 1 session) — added/updated/removed separately.
  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return undefined

    try {
      youMarkerRef.current?.remove()
    } catch {
      /* ignore */
    }
    youMarkerRef.current = null

    if (!location || !isValidCoord(location.latitude, location.longitude)) return undefined

    const marker = L.marker([Number(location.latitude), Number(location.longitude)], {
      icon: L.divIcon({
        className: '',
        html: markerHtml('you'),
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      title: `${location.name} — your selected location`,
      alt: `${location.name} — your selected location from the weather session`,
      keyboard: true,
    })
    marker.bindPopup(
      popupHtml({
        name: location.name,
        badgeTone: 'success',
        badgeLabel: 'YOUR LOCATION',
        rows: [
          `${Number(location.latitude).toFixed(3)}, ${Number(location.longitude).toFixed(3)}`,
          'From your selected weather location.',
        ],
        note: 'Live coordinates from your session — rainfall status on this map is still demonstration data.',
      }),
    )
    marker.addTo(map)
    youMarkerRef.current = marker

    return () => {
      try {
        marker.remove()
      } catch {
        /* ignore */
      }
      if (youMarkerRef.current === marker) youMarkerRef.current = null
    }
  }, [location, status])

  return (
    <div className="community-block community-map">
      <header>
        <p className="community-block__eyebrow">Interactive map</p>
        <h3 className="community-block__title">Rain check map (demonstration markers)</h3>
        <p className="community-block__hint">
          Static sample markers for six cities with simulated rainfall status. Click or focus a marker for details;
          tiles © OpenStreetMap contributors.
        </p>
      </header>

      <div className="community-map__frame">
        <div className="community-map__canvas" ref={containerRef} />

        {status === 'loading' && (
          <div className="community-map__state" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            Loading map…
          </div>
        )}

        {status === 'error' && (
          <div className="community-map__state" role="alert">
            <p>The interactive map could not be loaded in this session.</p>
            <button type="button" className="button button--primary" onClick={() => setAttempt((a) => a + 1)}>
              Retry map
            </button>
          </div>
        )}
      </div>

      {status === 'ready' && !isOnline && (
        <p className="community-map__offline-note" role="status">
          <WifiOff size={15} aria-hidden="true" /> You are offline — map tiles need a connection. Markers and legend
          remain visible from the loaded app.
        </p>
      )}

      <p className="community-map__caption">
        <span>
          {OSM_ATTRIBUTION} · Popups show <strong>demonstration data</strong>, not live observations.
        </span>
        <span className="badge badge--demo">Demo markers</span>
      </p>
    </div>
  )
}

export default CommunityMap
