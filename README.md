# Mausam-m
Adaptive Weather Intelligence and Daily Planning Platform-React, Vite and Open-Meteo

## Getting started

```bash
npm install
npm run dev      # start the Vite dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build
npm run lint     # ESLint
npm test         # Vitest (pure service-layer tests)
```

No API key or environment variable is required. Weather data comes from the
public [Open-Meteo](https://open-meteo.com/) APIs.

## Modules

| Module | Owner | Status |
| --- | --- | --- |
| Weather Engine | Member 1 | implemented — see [`docs/weather-engine.md`](docs/weather-engine.md) |
| Adaptive experience | Member 2 | implemented — see [`docs/adaptive-experience.md`](docs/adaptive-experience.md) |
| Community, maps, PWA | Member 3 | implemented — see [`docs/community-maps-pwa.md`](docs/community-maps-pwa.md) |
| Insights (air, farm, feel) | Member 4 | implemented — see [`docs/insights-modules.md`](docs/insights-modules.md) |

## Weather Engine (Member 1)

- Location search by city/town (Open-Meteo Geocoding) with cascading
  region → district filters derived from the returned results.
- "Use my location" via the browser geolocation API (Open-Meteo has no reverse
  geocoding, so coordinate results are labelled "My location" and weather is
  fetched from the coordinates directly).
- Recent locations remembered locally for one-tap switching.
- Current conditions (temperature, apparent temperature, humidity, wind,
  precipitation probability, condition + icon, observation time).
- Timezone-aware 7-day forecast.
- Loading skeletons, empty/error/no-results states, retry controls, offline
  detection and clearly-labelled cached data.
- Stable normalized data contract for Member 2's warnings/recommendations (see
  [`docs/weather-engine.md`](docs/weather-engine.md)).

The Weather Engine exposes normalized weather data only; warning and
recommendation logic is owned by Member 2.

## Adaptive Experience (Member 2)

- 24-hour chrono-UI scrubber: today/tomorrow tabs, hour-by-hour timeline with
  past/current/future states, click or keyboard selection.
- Heat-stress estimates: heat index (NWS Rothfusz, ≥27°C and ≥40% RH only) and
  wet-bulb (Stull 2011), each with conditions/limits and a disclaimer.
- Activity-priority cards (walking, running, cycling, sports, picnic,
  sightseeing) with recommended / caution / not-recommended / unknown statuses
  and bilingual precautions.
- Personalized advisory text plus EN/HI speech synthesis (user-initiated only,
  never autoplayed); language choice persists locally.
- All thresholds and bilingual copy live in `src/config/adaptiveThresholds.js`
  and `src/config/adaptiveCopy.js`; pure logic is in `src/services/` (see
  [`docs/adaptive-experience.md`](docs/adaptive-experience.md)).

## Community, Maps & PWA (Member 3)

- Interactive Leaflet map with OpenStreetMap tiles: clearly-labelled
  demonstration markers for six cities, a "your location" marker from the
  selected weather location, legend, loading/error/retry and offline states.
- Simulated village records and unified-service availability cards, each
  labelled as demo/sample data (filter + empty state included).
- Device-local rain-check reporting form: validation, inline errors,
  success/failure/retry states; reports are stored **only** in this browser's
  `localStorage` (capped at 20) and are never uploaded.
- Dismissible demo emergency-alert banner — never presented as an official
  warning.
- Online/offline connectivity pill in the header.
- Installable PWA via `vite-plugin-pwa`: app-shell precache, OSM tile
  runtime cache (Open-Meteo responses are deliberately not SW-cached —
  offline weather remains Member 1's labelled local cache), offline-ready
  notice and an explicit update-prompt (no silent swaps).

All community content is clearly-labelled demonstration data or device-local
records; see [`docs/community-maps-pwa.md`](docs/community-maps-pwa.md).

## Insights — air, farm & feel (Member 4)

- **Air Quality & Outdoor Activity Advisor**: current US AQI
  (Open-Meteo Air Quality / CAMS) with band, summary, sensitive-group
  precautions and PM2.5/PM10, plus an hour-by-hour comparison of air quality
  **and** weather to surface genuinely better outdoor windows for the day.
- **Farmer's Rain Planner**: per-day rain totals (sum of forecast hourly
  precipitation) with planning windows for irrigation, sowing/transplanting
  and harvest/threshing — each verdict explained by the forecast facts behind
  it, and a permanent scope disclaimer.
- **Weather-Feel Intelligence**: describes how the hour selected on Member 2's
  scrubber is likely to feel, choosing the heat index, the model's apparent
  temperature or air temperature, and always labelling the value as an
  estimate.
- All three live behind accessible tabs in a new "Insights" section; every
  number is forecast-derived (never fabricated), and guidance is explicitly
  **not** an official warning, medical advice or agronomic advice.
- Thresholds and copy are in `src/config/airQuality.js`,
  `src/config/weatherFeel.js` and `src/config/farmerPlanner.js`; pure logic is
  tested with Vitest — see [`docs/insights-modules.md`](docs/insights-modules.md).

Weather data by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Map data
© [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. This
is a prototype and is **not** an official IMD service.
