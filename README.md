# Mausam-m
Adaptive Weather Intelligence and Daily Planning Platform-React, Vite and Open-Meteo

## Getting started

```bash
npm install
npm run dev      # start the Vite dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # preview the production build
npm run lint     # ESLint
```

No API key or environment variable is required. Weather data comes from the
public [Open-Meteo](https://open-meteo.com/) APIs.

## Modules

| Module | Owner | Status |
| --- | --- | --- |
| Weather Engine | Member 1 | implemented — see [`docs/weather-engine.md`](docs/weather-engine.md) |
| Adaptive experience | Member 2 | pending |
| Community, maps, PWA | Member 3 | pending |

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

Weather data by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). This is a
prototype and is **not** an official IMD service.
