# Insights — module reference (Member 4)

Three decision-support modules built on Member 1's `NormalizedWeather` and the
Open-Meteo Air Quality API:

1. **Air Quality & Outdoor Activity Advisor** — current US AQI, precautions,
   and the day's genuinely better outdoor windows.
2. **Farmer's Rain Planner** — per-day rain totals and planning windows for
   irrigation, sowing/transplanting and harvest/threshing.
3. **Weather-Feel Intelligence** — how the selected hour is likely to feel,
   with the estimate's source stated.

Governing rules of this module:

- **Forecast-based planning guidance only.** Nothing here is an official
  warning, medical advice, or agronomic advice, and each panel says so.
- **No fabricated values.** Missing inputs produce `null`/`unknown` with an
  explanation — never a guess. Every verdict/recommendation carries the
  reasons (`{ id, text }`) that produced it.
- **Calculations are pure and separate from presentation.** React components
  only render service output; thresholds and copy live in `src/config/`.

Same layering as Members 1–3:

```
src/config/airQuality.js       ← AQI bands, exercise rules, precaution copy
src/config/weatherFeel.js      ← feel bands, humidity/wind modifiers, copy
src/config/farmerPlanner.js    ← rain thresholds, verdicts, reason copy
src/services/airQualityService.js  ← URL build + fetch + normalize (reuses httpClient)
src/services/airQualityAdvisor.js  ← pure AQI classification + window rules
src/services/weatherFeel.js        ← pure feel resolution (reuses heatStress.js)
src/services/farmerPlanner.js      ← pure rain aggregation + operation rules
src/hooks/useAirQuality.js         ← fetch state + per-place 1 h localStorage cache
src/components/                    ← InsightsSection (tabs) + AirQualityAdvisor,
                                     FarmerRainPlanner, WeatherFeelCard
src/insights.css                   ← styles, reusing tokens from src/index.css
src/services/*.test.js             ← Vitest tests (calculations, missing inputs, API shapes, rules)
```

## 1. Air quality service — `src/services/airQualityService.js`

Open-Meteo Air Quality API (CAMS model), keyless, CC BY 4.0.
Endpoint: `https://air-quality-api.open-meteo.com/v1/air-quality`.
Requests `current` + `hourly` for `us_aqi`, `pm2_5`, `pm10`, `timezone=auto`,
`forecast_days=3` (max 7). The **US AQI is the global index**; the European AQI
is Europe-only, so it is not requested. HTTP is delegated to the shared
`src/services/httpClient.js` (`buildUrl` / `fetchJson` / `ApiError`) — no second
client exists.

| Export | Notes |
| --- | --- |
| `AIR_QUALITY_BASE_URL`, `AIR_QUALITY_SOURCE`, `AIR_QUALITY_UNITS` | constants/attribution |
| `buildAirQualityUrl(params)` | validates coordinates (`null`/`''` rejected), clamps `forecast_days` to 1…7 |
| `normalizeAirQualityHourly(raw)` | drops malformed timestamps, keeps nulls |
| `normalizeAirQuality(raw, location)` | → `NormalizedAirQuality`; throws `ApiError('parse')` when unusable |
| `fetchAirQuality(location, options)` | fetch + normalize; accepts an `AbortSignal` |

`NormalizedAirQuality`:

```js
{
  location, timezone,
  units: { aqi: 'US AQI', pm25: 'µg/m³', pm10: 'µg/m³' },
  current: { time|null, usAqi|null, pm25|null, pm10|null },
  hourly:  [{ time, usAqi|null, pm25|null, pm10|null }],
  fetchedAt, source,
}
```

## 2. Air-quality advisor — `src/services/airQualityAdvisor.js`

Pure. Joins AQ hourly points with the weather forecast for one local date
(`joinExerciseHours`) and judges each hour (`evaluateExerciseHour`).

Rules (`OUTDOOR_EXERCISE_RULES`): hard blockers → *not recommended*
(thunderstorm, rain probability ≥ 70%, wind ≥ 35 km/h, AQI band unhealthy or
worse); soft cautions → *caution* (sensitive AQI band, rain 40–70%, wind
20–35 km/h, fog, darkness, missing AQI); otherwise *recommended*. Missing
AQ *and* weather at once → *unknown*. Contiguous same-verdict hours become
windows (`groupIntoWindows`); `buildExercisePlan` returns counts and the
longest recommended window (`bestWindow`, ≥ 2 h).

| Export | Notes |
| --- | --- |
| `classifyAqi(usAqi)` | EPA band `{ id, risk, label, summary }`; `null` when missing |
| `describeAirQuality(sample)` | display object (index, pollutants, advice, precautions); `null` when empty |
| `evaluateExerciseHour(facts)` | → `{ verdict, reasons }` |
| `joinExerciseHours({ airQuality, weather }, date)` | per-hour joined facts + verdict |
| `groupIntoWindows(hours)` | consecutive same-verdict runs |
| `buildExercisePlan({ airQuality, weather, date })` | day plan (`status`, `hours`, `windows`, `counts`, `bestWindow`) |

## 3. Weather-Feel — `src/services/weatherFeel.js`

Pure. Resolves "feels like" in a fixed priority:

1. **heat index** (`computeHeatIndex` from `heatStress.js`) when its validated
   window covers the inputs;
2. else the model's **apparent temperature** (temperature + humidity + wind);
3. else **air temperature**.

The source is always reported (`feelsLikeSource`) and every card labels the
value as an estimate. `classifyFeel` maps the effective value to
`FEEL_BANDS`, adding `humid`/`dry` variants for warm/hot bands and
`breezy`/`windy` variants (wind chill below 24 °C). Missing temperature →
`{ status: 'unavailable', reasonKey: 'missingTemperature' }`.

## 4. Farmer's Rain Planner — `src/services/farmerPlanner.js`

Pure. The Forecast API's daily block has **no** precipitation sum, so daily
rain is the **sum of forecast hourly precipitation** for the day
(`aggregateRainFromHourly`), flagged `complete: false` when hours are missing.
Each day is scored per operation by `evaluateOperation`:

| Operation | unsuitable | pause | caution | suitable |
| --- | --- | --- | --- | --- |
| irrigation | — | ≥10 mm, or rain chance ≥70% | light rain, chance 40–70% | dry; + evaporation note ≥35 °C |
| sowing | ≥10 mm | — | light rain or chance ≥70% | dry/workable |
| harvest | ≥10 mm | light rain or chance ≥70% | chance 40–70% | dry |

Reasons are structured (`{ id, text, values }`) and `FARM_DISCLAIMER` is always
returned with the plan.

| Export | Notes |
| --- | --- |
| `aggregateRainFromHourly(weather, date)` | `{ rainMm, wetHours, maxHourlyMm, hoursWithData, complete }` |
| `evaluateOperation(opId, dayFacts)` | → `{ verdict, reasons }`; throws on unknown id |
| `buildFarmPlan(weather)` | `{ status, days, operations, disclaimer, verdictLabels, … }`; falls back to hourly dates when the daily block is empty |

## 5. Hook + UI

- `useAirQuality(location, { isOnline })` — fetch state (`idle`/`loading`/
  `ready`/`error`), abort-safe, best-effort per-place localStorage cache
  (`mausam.insights.air-quality.cache.v1`, 1 h). Cached data is still clearly
  attributed; nothing is invented while offline.
- `InsightsSection` — accessible tabs (Air & outdoors / Farm planner / Weather
  feel), arrow-key navigation, `hidden` panels.
- `WeatherFeelCard` follows Member 2's 24-hour scrubber: `AdaptiveExperience`
  gained an optional `onSelectionChange` prop (backward-compatible) which App
  mirrors into the Insights section, so the feel always matches the selected
  hour — or the current observation before a selection exists.
- `AirQualityAdvisor` and `FarmerRainPlanner` show per-hour/per-day reasons and
  keep their scope disclaimers visible.

## 6. Tests

`npm test` (Vitest, node environment — pure logic only, no DOM):

| File | Covers |
| --- | --- |
| `airQualityService.test.js` | URL building/clamping, coordinate validation, normalization, malformed/partial payloads, `fetchAirQuality` failure kind |
| `airQualityAdvisor.test.js` | AQI band boundaries, verdict rules (blockers/cautions/unknown), hour joining, window grouping, day plan |
| `weatherFeel.test.js` | source priority (heat index vs apparent vs air temp), variants, missing inputs |
| `farmerPlanner.test.js` | hourly rain aggregation/completeness, per-operation verdicts, placeholder-free reason text, plan building/fallbacks |
