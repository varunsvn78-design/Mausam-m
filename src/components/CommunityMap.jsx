import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { WifiOff } from 'lucide-react'
import { DEMO_MARKERS, RAIN_STATUS_META, MAP_FALLBACK_VIEW } from '../config/communityDemo.js'
import { useOnlineStatus } from '../hooks/useOnlineStatus.js'

// Leaflet's attribution control sets its option via innerHTML, so this HTML
// string is correct THERE. It must never be rendered as a React child — React
// escapes it and the anchor markup shows as literal text (the original bug).
const OSM_ATTRIBUTION_HTML =
  'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

// Category labels for community report markers, keyed by observation id.
const REPORT_CATEGORY_META = Object.freeze({
  'rain-started': { label: 'Rain started', tone: 'primary' },
  'light-rain': { label: 'Light rain', tone: 'primary' },
  'heavy-rain': { label: 'Heavy rain', tone: 'danger' },
  'no-rain': { label: 'No rain yet', tone: 'info' },
  thunderstorm: { label: 'Thunderstorm', tone: 'danger' },
  other: { label: 'Other observation', tone: 'muted' },
})

function reportTone(type) {
  return REPORT_CATEGORY_META[type]?.tone ?? 'muted'
}

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

function reportMarkerHtml(tone) {
  return `<span class="report-marker report-marker--${tone}" aria-hidden="true"></span>`
}

function formatReportTime(iso) {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString()
  } catch {
    return null
  }
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
  const reportItems = [
    ['primary', 'Community report (light)'],
    ['danger', 'Community report (heavy)'],
    ['info', 'Community report (no rain)'],
  ]
    .map(
      ([tone, label]) =>
        `<p class="demo-map-legend__item"><span class="demo-map-legend__dot report-marker--${tone}"></span>${label}</p>`,
    )
    .join('')
  return `
    <p class="demo-map-legend__title">Legend</p>
    ${items}
    <p class="demo-map-legend__subtitle">Community reports (unverified)</p>
    ${reportItems}
    <p class="demo-map-legend__note">Demo markers are simulated. Community reports are user-submitted and unverified — not official observations.</p>`
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
 * @param {{
 *   location?: object|null,
 *   isActive?: boolean,
 *   reports?: Array<object>,
 *   onRefresh?: (options?: object) => void,
 *   apiAvailable?: boolean,
 *   storageMode?: string|null,
 * }} props selected Member 1 location; `isActive` re-syncs Leaflet's size when
 *   the parent tab is (re)shown after being hidden. `reports` are shared
 *   community submissions (already labelled unverified by the server).
 */
export function CommunityMap({
  location,
  isActive = true,
  reports = [],
  onRefresh,
  apiAvailable = false,
  storageMode = null,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const youMarkerRef = useRef(null)
  const reportsLayerRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [attempt, setAttempt] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
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
        attribution: OSM_ATTRIBUTION_HTML,
        maxZoom: 19,
      }).addTo(map)

      reportsLayerRef.current = L.layerGroup().addTo(map)

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
      reportsLayerRef.current = null
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

  // Shared community report markers (unverified user submissions with real
  // coordinates). Never invented — only reports the backend actually returned.
  useEffect(() => {
    const layer = reportsLayerRef.current
    if (!layer || status !== 'ready') return undefined

    layer.clearLayers()
    for (const report of Array.isArray(reports) ? reports : []) {
      if (!isValidCoord(report.latitude, report.longitude)) continue
      const tone = reportTone(report.type)
      const marker = L.marker([Number(report.latitude), Number(report.longitude)], {
        icon: L.divIcon({
          className: '',
          html: reportMarkerHtml(tone),
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        title: `${report.location} — community report (unverified)`,
        alt: `${report.location} — community-submitted report, unverified`,
        keyboard: true,
      })
      const submitted = formatReportTime(report.submittedAt ?? report.observedAt)
      marker.bindPopup(
        popupHtml({
          name: report.location,
          badgeTone: 'warning',
          badgeLabel: 'COMMUNITY · UNVERIFIED',
          rows: [
            `Observation: ${report.typeLabel ?? report.type}`,
            report.description ? `Note: ${report.description}` : null,
            submitted ? `Submitted: ${submitted}` : null,
            `Source: ${report.source ?? 'web'} · status: ${report.verificationStatus ?? 'unverified'}`,
          ],
          note: 'User-submitted community report. Not an official observation or warning and not verified.',
        }),
      )
      marker.addTo(layer)
    }

    return () => {
      try {
        layer.clearLayers()
      } catch {
        /* layer already removed */
      }
    }
  }, [reports, status])

  const refreshReports = async () => {
    if (!onRefresh) return
    setIsRefreshing(true)
    try {
      await Promise.resolve(onRefresh())
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="community-block community-map">
      <header className="block-toolbar">
        <div>
          <p className="community-block__eyebrow">Interactive map</p>
          <h3 className="community-block__title">Community rain map</h3>
          <p className="community-block__hint">
            Simulated demo markers for six cities plus <strong>community-submitted reports</strong> (unverified).
            Click or focus a marker for details.
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            className="button button--ghost"
            onClick={refreshReports}
            disabled={isRefreshing}
            aria-busy={isRefreshing ? 'true' : undefined}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh reports'}
          </button>
        )}
      </header>

      <div className="community-map__meta">
        <span className={`badge badge--${apiAvailable ? 'success' : 'muted'}`}>
          {apiAvailable ? 'Community server: online' : 'Community server: offline (demo markers only)'}
        </span>
        <span className="badge badge--muted">{reports.length} community report(s)</span>
        {apiAvailable && storageMode === 'memory' && (
          <span className="badge badge--warning">in-memory (resets on restart)</span>
        )}
      </div>

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

      {reports.length === 0 && (
        <p className="community-map__empty" role="status">
          No community reports submitted yet. Demo markers are shown for illustration; the rain-check form can add
          real community reports when the server is online.
        </p>
      )}

      <p className="community-map__caption">
        <span>
          Map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">
            OpenStreetMap
          </a>{' '}
          contributors · Demo markers are simulated; community reports are user-submitted and unverified.
        </span>
        <span className="badge badge--demo">Demo markers</span>
      </p>
    </div>
  )
}

export default CommunityMap
