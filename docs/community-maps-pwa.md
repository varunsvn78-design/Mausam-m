# Community, Maps & PWA — module reference (Member 3)

The third module turns the single-user weather app into a platform prototype:
a clearly-labelled demonstration map, simulated village and unified-service
records, a device-local rain-check reporting flow, a demo emergency banner,
and installable/offline behaviour via a service worker.

The governing rule of this module: **nothing simulated may look live, and
nothing unshared may look shared**. Every marker, village, service status and
alert is demo data from one config file and says so in the UI. Rain reports
are either (a) submitted to the optional community API and labelled
*unverified community report*, or (b) stored device-locally and labelled as
not shared — never a silent upload, never a false claim of sharing.

Same layering as Members 1 and 2:

```
src/config/communityDemo.js  ← every demo record + every label (nothing invented in components)
src/services/reportStore.js  ← pure JS: validate/create/list/save/clear local reports
src/services/reportsClient.js ← fetch client for the optional /api backend (never fabricates success)
src/hooks/                   ← useRainReports (report state + API probe) + useInstallPrompt
                               + reuse of Member 1's useOnlineStatus
src/components/              ← CommunitySection (wires everything) + CommunityMap, VillageCards,
                               ServiceCards, RainReportForm, EmergencyAlertBanner,
                               ConnectivityPill, PwaStatus
server/                      ← optional Express reporting API (validation.js, store.js, app.js, index.js)
src/community.css            ← styles, reusing design tokens from src/index.css
vite.config.js               ← VitePWA plugin (manifest + Workbox SW) + dev proxy /api → :4000
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

## 2. Rain-check reporting — store, client, API & hook

Two persistence paths, chosen at submit time:

- **Shared** — `src/services/reportsClient.js` POSTs to the optional Express
  API (`/api/reports`). On success the report is marked `verificationStatus:
  'unverified'` and returned to the map. Validation failures (HTTP 400) are
  surfaced to the user; unreachable-server errors trigger the local fallback.
  The client **never fabricates a success** — `checkReportsApi()` reports
  availability honestly.
- **Local** — `src/services/reportStore.js` persists to this browser's
  `localStorage` only, clearly labelled as not shared. Old local demo records
  are never auto-uploaded.

### Store — `src/services/reportStore.js`

| Export | Notes |
| --- | --- |
| `REPORTS_STORAGE_KEY` | `'mausam.community.reports.v1'` (localStorage). |
| `MAX_STORED_REPORTS` | `20` — oldest entries are dropped past the cap. |
| `OBSERVATION_TYPES` | `rain-started`, `light-rain`, `heavy-rain`, `no-rain`, `thunderstorm`, `other`. |
| `validateReport(draft)` | → `{ valid, errors }`; required location + type, optional description ≤ `DESCRIPTION_MAX_LENGTH` (240). Never throws. |
| `createReport(draft, { now, id })` | Normalized record with `observedAt`/`submittedAt` ISO timestamps, `source: 'local-device'`, `verificationStatus: 'unverified'`, `demo: true`. |
| `listReports()` | Newest first; filters malformed entries; never throws. |
| `saveReport(draft, options)` | → `{ ok, report, reports, truncated }` or `{ ok:false, error:'invalid'\|'storage', errors }`. Quota failures surface as a form failure state, not an exception. |
| `clearReports()` | → `boolean`. |

### API — `server/`

Small Express app (exports the router so tests mount it without a port):

| Route | Behaviour |
| --- | --- |
| `GET /api/health` | `{ ok, storage, time }`. |
| `GET /api/reports?location=&limit=` | Newest-first list; every response carries `storage`. |
| `POST /api/reports` | Validates with `server/validation.js`; 400 with field errors on bad input, 201 on create, 200 + `duplicate: true` on a recent repeat. |
| `GET /api/reports/:id` | Single report or a clean 404. |

Storage (`server/store.js`) is MongoDB when `MONGODB_URI` is set (persistent,
shared) and in-memory otherwise (single process, resets on restart). The active
mode is returned in `getStorageMode()` and surfaced in **every** response so
in-memory data is never presented as persistent. A small in-process rate
limiter (20/min per IP) guards `POST`. No credentials are ever logged or
returned.

### Client — `src/services/reportsClient.js`

`checkReportsApi()`, `submitReport(payload)`, `fetchReports({ location })`, and
the `ReportsApiError` type (`kind`: `network` | `timeout` | `validation` |
`http`). Timeouts use an `AbortController` (10 s).

### Hook — `src/hooks/useRainReports.js`

```js
const { reports, sharedReports, submit, clear, clearFailed,
        loadShared, apiStatus, storageMode, apiAvailable } = useRainReports({ isOnline })
```

Probes `/api/health` on mount (and when connectivity returns); `submit` tries
the shared backend first and falls back to local storage when it is
unreachable. `loadShared` refreshes `sharedReports` for the map.

## 3. Map — `src/components/CommunityMap.jsx`

Interactive [Leaflet](https://leafletjs.com/) map over OpenStreetMap tiles.

- Static demo markers from `DEMO_MARKERS` as circle `divIcon`s (no external
  marker images) with HTML popups (escaped) and a `DEMO DATA` badge on every
  popup.
- **Real community report markers** from the `reports` prop as square
  `divIcon`s, colour-coded by observation type; each popup carries a
  `COMMUNITY · UNVERIFIED` badge, the submit time, source and verification
  status. Only reports the backend actually returned are plotted.
- "Your location" marker for Member 1's selected location, added/updated/
  removed in a separate effect; its popup states that rainfall status on the
  map is still demonstration data. Falls back to `MAP_FALLBACK_VIEW` when no
  location is selected.
- Explicit states: loading spinner, error with a "Retry map" button, an
  offline note (tiles need a connection; markers/legend stay visible), a
  "Refresh reports" action and an empty state when no community reports exist.
- A meta row showing server availability, report count and an in-memory
  warning when the backend has no database.
- Legend control (built via `L.control`) with `disableClickPropagation`,
  covering both demo markers and community reports; OSM attribution rendered
  as a real anchor in the caption (the attribution string is HTML only for
  Leaflet's own control, never as a React child).
- Resize-safe: `ResizeObserver` → `map.invalidateSize()`; full teardown
  (`map.remove()`) on unmount, safe against double-teardown.

## 4. Other components

| Component | Role |
| --- | --- |
| `CommunitySection` | Owns the section; composes map, village/service cards and the report form; prefills the form's location from Member 1's selection; refreshes shared reports when the map/report tab opens. |
| `VillageCards` | Simulated village grid with a name/district filter that exercises the empty state. Every card carries a `Demo` badge. |
| `ServiceCards` | Simulated unified-service availability cards; availability badges are labelled "(sample)". |
| `RainReportForm` | Idle → inline-error → submitting → success/failure states; required-field errors, description counter, device-clock submission time, and mode-aware copy: shared success says the server confirmed the *unverified* report; local success says it was **not** sent anywhere. Retry/dismiss on failure; notes when the server is running in-memory. |
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
- **Install app** prompt driven by the browser's real `beforeinstallprompt`
  event (`src/hooks/useInstallPrompt.js`). It only appears when the app is
  genuinely installable and not already installed; dismissal persists at
  `mausam.pwa.installDismissed.v1`.

## 6. Styling — `src/community.css`

Reuses Member 1's tokens (`--color-*`, `--radius-*`, `--space-*`,
`--shadow-*`) and card/badge/button primitives. Adds the community blocks,
demo cards/chips, map frame + states, legend, popup, report form, alert
banner, connectivity pill, PWA banners and demo-marker/legend dots.

## 7. Verification

`npm run lint` and `npm run build` are clean; the production build emits
`dist/sw.js`, `dist/workbox-*.js` and `dist/manifest.webmanifest` with 14
precached entries. The reporting API has its own Node test suite
(`npm run test:api`, 23 tests across validation/store/app); the frontend
Vitest suite (`npm test`, 129 tests) includes `reportsClient.test.js`. Together
with the other modules this is 129 frontend + 23 server tests passing.
Map initialisation, community-report markers, the report form's validation →
submit/fallback → success/failure path and the PWA prompt states were
exercised manually in the preview build. One Member 2 copy key
(`TIMELINE_COPY.now`, used by `ChronoTimeline`) was added during integration
so the bilingual "Now" pill never renders `undefined`.

---

*Community, Maps & PWA module — Member 3. Community content in this module is
either clearly-labelled demonstration data, device-local records, or
user-submitted unverified community reports; the prototype is not connected to
any official alerting, rural-directory or emergency service. The optional
reporting API stores no personal data and marks every submission unverified.
Weather data by [Open-Meteo](https://open-meteo.com/); map data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.*
