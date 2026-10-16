# Weather Engine — module reference (Member 1)

The Weather Engine fetches, validates, normalizes and caches weather data from
[Open-Meteo](https://open-meteo.com/) and renders the current-weather card,
location search, and 7-day forecast.

It is intentionally split into three layers so other modules can depend on the
data layer without touching React:

```
src/services/   ← pure JS: URL building, fetch, validation, normalization, cache
src/hooks/      ← React state orchestration (UI state only)
src/components/ ← presentational React components
```

## Attribution

Weather data by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). This is a
prototype and is **not** an official IMD service. No API key is used or stored.

---

## 1. Services API

### `src/services/geocodingService.js`

```js
import { searchLocations, normalizeLocation, MIN_QUERY_LENGTH } from '../services/geocodingService.js'
```

| Export | Signature | Notes |
| --- | --- | --- |
| `searchLocations` | `(query, { signal, language='en', count=8, skipCache=false }) => Promise<NormalizedLocation[]>` | Throws `ApiError` on network/HTTP/parse failure. Returns `[]` for queries shorter than `MIN_QUERY_LENGTH` or with no matches. |
| `normalizeLocation` | `(raw) => NormalizedLocation \| null` | Returns `null` when the API entry has no usable coordinates. |
| `createLocationFromCoordinates` | `(coords, { name='My location', timezone=null }) => NormalizedLocation` | Builds a location from device GPS coordinates. Throws `TypeError` without finite coordinates. Open-Meteo has **no reverse geocoding**, so no place name is guessed. |
| `MIN_QUERY_LENGTH` | `2` | Search is skipped below this length. |
| `clearGeocodingCache` | `() => void` | Clears the in-memory query cache (tests/debug). |

**`NormalizedLocation`**

| Field | Type | Missing-value behaviour |
| --- | --- | --- |
| `id` | `string` | Falls back to `geo-<lat>,<lon>`; GPS locations use `gps-<lat>,<lon>`. |
| `name` | `string` | Falls back to `"Unknown place"`; GPS locations use `"My location"`. |
| `region` | `string \| null` | `admin1` (state), `null` when the API omits it. |
| `district` | `string \| null` | `admin2` (district), `null` when the API omits it — UI must show a fallback, never invent one. |
| `subdistrict` | `string \| null` | `admin3`, when available. |
| `country` | `string \| null` | `null` when omitted. |
| `countryCode` | `string \| null` | ISO 3166-1 alpha-2. |
| `latitude` | `number` | Required for a valid result. |
| `longitude` | `number` | Required for a valid result. |
| `timezone` | `string \| null` | IANA name reported by the API. |
| `elevation` | `number \| null` | Metres. |
| `source` | `'geocoding' \| 'coordinates'` | How the location was obtained. |

### `src/services/weatherService.js`

```js
import { fetchWeather, buildForecastUrl, normalizeForecast } from '../services/weatherService.js'
```

| Export | Signature | Notes |
| --- | --- | --- |
| `fetchWeather` | `(location, { signal, forecastDays=7 }) => Promise<NormalizedWeather>` | Uses `timezone=auto` unless `location.timezone` is set. Throws `ApiError`. |
| `buildForecastUrl` | `({ latitude, longitude, timezone, forecastDays }) => string` | Throws `ApiError{kind:'invalid'}` without valid coordinates. |
| `normalizeForecast` | `(raw, location) => NormalizedWeather` | Throws `ApiError{kind:'parse'}` for unusable payloads. |
| `normalizeHourly` / `normalizeDaily` | `(raw) => Array` | Exposed for tests. |
| `FORECAST_SOURCE`, `WEATHER_UNITS` | `object` | Attribution + unit metadata. |

---

## 2. `NormalizedWeather` data contract (for Member 2)

This is the object returned by `fetchWeather` and exposed by
`useWeatherEngine().weather`. All temperatures are **°C**, wind speed **km/h**,
precipitation **mm**, humidity and probability **%**.

```jsonc
{
  "location": { /* NormalizedLocation, see above */ },
  "timezone": "Asia/Kolkata",
  "timezoneAbbreviation": "GMT+5:30",
  "units": {
    "temperature": "°C", "apparentTemperature": "°C", "humidity": "%",
    "windSpeed": "km/h", "precipitation": "mm", "precipitationProbability": "%"
  },
  "current": {
    "time": "2026-10-17T14:00",      // LOCAL wall-clock time from the API (no offset)
    "isDay": true,
    "temperature": 31.4,             // °C
    "apparentTemperature": 36.0,     // °C
    "relativeHumidity": 62,          // %
    "windSpeed": 12.3,               // km/h at 10 m
    "windDirection": 225,            // degrees
    "precipitation": 0,              // mm in the last hour
    "precipitationProbability": 55,  // % for the current hour (from hourly block)
    "weatherCode": 95,               // WMO code
    "condition": { "code": 95, "label": "Thunderstorm", "group": "thunderstorm", "isDay": true }
  },
  "hourly": [                        // 168 points (7 days) when available, oldest first
    {
      "time": "2026-10-17T00:00", "isDay": false,
      "temperature": 24.1, "apparentTemperature": 25.8, "relativeHumidity": 70,
      "windSpeed": 5.2, "precipitation": 0, "precipitationProbability": 10,
      "weatherCode": 3, "condition": { "code": 3, "label": "Overcast", "group": "cloudy", "isDay": false }
    }
  ],
  "daily": [                         // exactly the days returned by the API (7 by default)
    {
      "date": "2026-10-17", "time": "2026-10-17",
      "weatherCode": 95, "condition": { "code": 95, "label": "Thunderstorm", "group": "thunderstorm", "isDay": true },
      "temperatureMax": 33.6, "temperatureMin": 22.5,
      "precipitationProbability": 55, // % daily max, may be null
      "windSpeedMax": 20.0,            // km/h, may be null
      "sunrise": "2026-10-17T06:28", "sunset": "2026-10-17T18:10" // local wall-clock, may be null
    }
  ],
  "fetchedAt": "2026-10-16T19:04:31.636Z", // UTC ISO timestamp of the successful fetch
  "source": { "name": "Open-Meteo", "url": "https://open-meteo.com/" }
}
```

### Missing-value rules (read before consuming)

- Every numeric field is `number | null`. `null` means **the API did not
  provide it**. Nothing is defaulted to `0` or invented.
- `hourly` / `daily` are always arrays; entries with unparseable timestamps are
  dropped rather than mislabelled.
- `condition` is always present. Unknown codes become
  `{ group: 'unknown', label: 'Unknown conditions' }`.
- `current.precipitationProbability` comes from the matching hourly point
  because Open-Meteo has no dedicated "current probability" variable; it is
  `null` when there is no matching hour.
- `time`/`date`/`sunrise` strings are **local wall-clock** values without an
  offset. Use `src/utils/format.js` helpers to display them; do not pass them
  to `new Date()` or the date can shift.

### Condition groups (for icons / logic)

`clear`, `partly-cloudy`, `cloudy`, `fog`, `drizzle`, `rain`, `showers`,
`snow`, `thunderstorm`, `unknown` — exported as `WEATHER_GROUPS` and
`describeWeatherCode(code, isDay)` from `src/services/weatherCodes.js`.

---

## 3. React integration

### `useWeatherEngine()`

```js
const {
  isOnline,        // boolean — browser connectivity
  location,        // NormalizedLocation | null
  weather,         // NormalizedWeather | null  ← Member 2 consumes this
  status,          // 'empty' | 'loading' | 'ready' | 'error'
  error,           // Error | null (ApiError with .kind: network|timeout|http|parse|aborted|invalid)
  cacheInfo,       // { savedAt, ageMs, isStale } | null — set when showing cached data
  isLoading,       // boolean
  hasWeather,      // boolean
  recentLocations, // NormalizedLocation[] — most recent first (max 5)
  selectLocation,  // (location) => void
  clearLocation,   // () => void
  clearRecent,     // () => void
  retry,           // () => void
} = useWeatherEngine()
```

UI state (`status`, `error`, `cacheInfo`, `isLoading`) is kept separate from the
normalized data (`weather`), which is exactly what Member 2 needs.

### Location selection

- **City / town search** — `LocationSearch` + `useLocationSearch` wrap the
  Open-Meteo Geocoding API (debounced + cancellable).
- **Cascading region → district filters** — built from the `admin1` / `admin2`
  values present in the search results. Open-Meteo has no "list all districts"
  endpoint, so the cascade never invents data; when no result reports a district
  the UI shows "District details are not provided by Open-Meteo".
- **Use my location** — `UseMyLocationButton` + `useGeolocation()` request the
  browser position only on click. Because Open-Meteo has no reverse geocoding,
  the coordinate location is labelled `"My location"` (`source: 'coordinates'`)
  and weather is fetched directly from the coordinates. Permission-denied,
  unsupported and timeout cases surface a readable message.
- **Recent locations** — up to 5 previously selected locations are remembered in
  `localStorage` (`mausam.weather-engine.recent.v1`) and shown as quick-pick
  chips.

### Other reusable pieces

- `useLocationSearch({ debounceMs, limit })` — debounced, cancellable geocoding search.
- `useGeolocation()` — `{ supported, status, coords, error, isLocating, locate, reset }`;
  `locate()` returns a Promise. `status` is `idle | locating | success | denied | unavailable | timeout`.
- `useOnlineStatus()` — online/offline state.
- `src/services/weatherCache.js` — `saveWeatherCache`, `loadWeatherCache`,
  `clearWeatherCache`, `saveSelectedLocation`, `loadSelectedLocation`,
  `clearSelectedLocation`, `saveRecentLocation`, `loadRecentLocations`,
  `clearRecentLocations`, `CACHE_STALE_AFTER_MS` (1 hour).
- `src/components/ErrorBoundary.jsx` — top-level render-error boundary.
- `src/utils/format.js` — timezone-safe formatters (`formatTemperature`,
  `formatNumber`, `formatDayName`… via `formatWeekday`, `todayInTimeZone`,
  `degreesToCompass`, `formatRelativeAge`).

### Cached / offline behaviour

- The last successful fetch is stored in `localStorage` under
  `mausam.weather-engine.cache.v1` with its `savedAt` timestamp.
- Cached data is structurally validated before use and is always labelled
  "Saved forecast" / "Stale cached data" with the fetch time — never presented
  as live data.
- When offline, the last saved forecast stays visible behind an offline banner;
  when the browser reconnects, a refresh is attempted automatically.
