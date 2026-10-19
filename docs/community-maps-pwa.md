# Community, Maps & PWA — module reference (Member 3)

The third module turns the single-user weather app into a platform prototype:
a clearly-labelled demonstration map, simulated village and unified-service
records, a device-local rain-check reporting flow, a demo emergency banner,
and installable/offline behaviour via a service worker.

The governing rule of this module: **nothing simulated may look live**. Every
marker, village, service status and alert is demo data from one config file
and says so in the UI; rain reports never leave the device.

Same layering as Members 1 and 2:

```
src/config/communityDemo.js  ← every demo record + every label (nothing invented in components)
src/services/reportStore.js  ← pure JS: validate/create/list/save/clear local reports
src/hooks/                   ← useRainReports (report state) + reuse of Member 1's useOnlineStatus
src/components/              ← CommunitySection (wires everything) + CommunityMap, VillageCards,
                               ServiceCards, RainReportForm, EmergencyAlertBanner,
                               ConnectivityPill, PwaStatus
src/community.css            ← styles, reusing design tokens from src/index.css
vite.config.js               ← VitePWA plugin (manifest + Workbox service worker)
public/icons/                ← PWA icon set (SVG favicon, 192/512 PNG, maskable 512, apple-touch)
```

---

## 1. Demo data — `src/config/communityDemo.js`

Single source of truth for everything simulated. Components read from it and
can never be mistaken for API data (`NormalizedWeather` / `NormalizedLocation`).

| Export | Notes |
| --- | --- |
| `RAIN_STATUS` / `RAIN_STATUS_META` | `none` / `light` / `moderate` / `heavy` / `storm` / `unknown` → bilingual-safe label + badge tone. |
| `DEMO_MARKERS` | Six well-known city coordinates (Bengaluru, New Delhi, Mumbai, Chennai, Kolkata, Guwahati) with simulated rainfall mm, status, sample update label. |
| `DEMO_VILLAGES` | Four simulated village records (name, district, rainfall, status, sample services). |
| `DEMO_SERVICES` | Four simulated unified-service records; `availability` ∈ `available` / `unavailable` / `unknown`. |
| `AVAILABILITY_META` | Availability → label + tone. |
| `DEMO_ALERT` / `ALERT_SEVERITY_META` | The single demo banner payload; severity ∈ `info` / `warning` / `severe`. |
| `MAP_FALLBACK_VIEW` | Map centre `[22.9734, 78.6569]` (geographic centre of India), zoom 4 — used when no location is selected. |
| `DEMO_DATA_NOTICE` | Shared "demonstration data" phrasing. |

## 2. Rain-check report store — `src/services/reportStore.js`

Local-only persistence. **No backend exists and none is implied** — nothing
is transmitted to any server, authority, or agency. Pure functions with
explicit validation so the form can show inline errors before any write.

| Export | Notes |
| --- | --- |
| `REPORTS_STORAGE_KEY` | `'mausam.community.reports.v1'` (localStorage). |
| `MAX_STORED_REPORTS` | `20` — oldest entries are dropped past the cap. |
| `OBSERVATION_TYPES` | `rain-started`, `light-rain`, `heavy-rain`, `no-rain`, `thunderstorm`, `other`. |
| `validateReport(draft)` | → `{ valid, errors }`; required location + type, optional description ≤ `DESCRIPTION_MAX_LENGTH` (240). Never throws. |
| `createReport(draft, { now, id })` | Normalized record with `observedAt` ISO timestamp, `storedLocally: true`, `demo: true`. |
| `listReports()` | Newest first; filters malformed entries; never throws. |
| `saveReport(draft, options)` | → `{ ok, report, reports, truncated }` or `{ ok:false, error:'invalid'\|'storage', errors }`. Quota failures surface as a form failure state, not an exception. |
| `clearReports()` | → `boolean`. |

**Hook** — `src/hooks/useRainReports.js`:

```js
const { reports, submit, clear, clearFailed } = useRainReports()
```

`submit` returns the store result so the form owns success/failure UI.

## 3. Map — `src/components/CommunityMap.jsx`

Interactive [Leaflet](https://leafletjs.com/) map over OpenStreetMap tiles.

- Static demo markers from `DEMO_MARKERS` as `divIcon`s (no external marker
  images) with HTML popups (escaped) and a `DEMO DATA` badge on every popup.
- "Your location" marker for Member 1's selected location, added/updated/
  removed in a separate effect; its popup states that rainfall status on the
  map is still demonstration data. Falls back to `MAP_FALLBACK_VIEW` when no
  location is selected.
- Explicit states: loading spinner, error with a "Retry map" button, and an
  offline note (tiles need a connection; markers/legend stay visible).
- Legend control (built via `L.control`) with `disableClickPropagation`;
  OSM attribution on the tile layer and in the caption.
- Resize-safe: `ResizeObserver` → `map.invalidateSize()`; full teardown
  (`map.remove()`) on unmount, safe against double-teardown.

## 4. Other components

| Component | Role |
| --- | --- |
| `CommunitySection` | Owns the section; composes map, village/service cards and the report form; prefills the form's location from Member 1's selection. |
| `VillageCards` | Simulated village grid with a name/district filter that exercises the empty state. Every card carries a `Demo` badge. |
| `ServiceCards` | Simulated unified-service availability cards; availability badges are labelled "(sample)". |
| `RainReportForm` | Idle → inline-error → submitting → success/failure states; required-field errors, description counter, device-clock submission time, privacy note naming the exact localStorage key; success copy states the report was **not** sent to any authority; retry/dismiss on failure. |
| `EmergencyAlertBanner` | The single `DEMO_ALERT` banner, labelled "DEMO ALERT — NOT AN OFFICIAL WARNING", dismissible (session-local). |
| `ConnectivityPill` | Header online/offline pill built on Member 1's `useOnlineStatus`. |
| `PwaStatus` | Service-worker UI — see below. |

`CommunitySection` is rendered at the end of `<main>` in `src/App.jsx`; the
pill sits in the header and the PWA/alert banners in the status row.

## 5. PWA — `vite.config.js` + `src/components/PwaStatus.jsx`

Configured entirely through `vite-plugin-pwa` — **no hand-written service
worker exists in the repo** (nothing to duplicate or drift).

| Setting | Value | Why |
| --- | --- | --- |
| `registerType` | `'prompt'` | Updates are announced with a Reload action — never silently swapped mid-session. |
| `injectRegister` | `null` | Registration is done manually via `virtual:pwa-register/react` inside `PwaStatus`. |
| `manifest` | name/short_name/description, `display: 'standalone'`, theme/background colours, icons 192/512 + maskable 512 from `public/icons/` | Installability on Android/desktop; `index.html` links the SVG favicon, apple-touch-icon and `theme-color`. |
| `workbox.globPatterns` | `**/*.{js,css,html,svg,png,ico,webmanifest}` | Full app-shell precache (14 entries at last build). |
| `workbox.navigateFallback` | `/index.html` | SPA offline navigation. |
| `workbox.runtimeCaching` | OSM tiles only (`tile.openstreetmap.org`), `StaleWhileRevalidate`, 250 entries / 7 days | Map tiles cached; **Open-Meteo API responses are deliberately NOT cached by the SW** — offline weather stays Member 1's explicit, clearly-labelled localStorage cache. |

`PwaStatus` renders (production builds only — `import.meta.env.PROD`):

- **Offline ready** notice once the shell is cached — dismissable, dismissal
  persisted at `mausam.pwa.offlineReadyDismissed.v1`.
- **Update available** prompt with explicit Reload / Later buttons.

## 6. Styling — `src/community.css`

Reuses Member 1's tokens (`--color-*`, `--radius-*`, `--space-*`,
`--shadow-*`) and card/badge/button primitives. Adds the community blocks,
demo cards/chips, map frame + states, legend, popup, report form, alert
banner, connectivity pill, PWA banners and demo-marker/legend dots.

## 7. Verification

`npm run lint` and `npm run build` are clean; the production build emits
`dist/sw.js`, `dist/workbox-*.js` and `dist/manifest.webmanifest` with 14
precached entries. Map initialisation, marker popups, the report form's
validation → storage → success/failure path and the PWA prompt states were
exercised manually in the preview build. One Member 2 copy key
(`TIMELINE_COPY.now`, used by `ChronoTimeline`) was added during integration
so the bilingual "Now" pill never renders `undefined`.

---

*Community, Maps & PWA module — Member 3. All community content in this
module is demonstration data or device-local records; the prototype is not
connected to any official alerting, rural-directory or emergency service.
Weather data by [Open-Meteo](https://open-meteo.com/); map data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.*
