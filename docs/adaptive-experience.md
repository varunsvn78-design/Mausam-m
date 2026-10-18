# Adaptive Experience — module reference (Member 2)

The Adaptive Experience sits between the Weather Engine and the user's day: a
24-hour chrono-UI scrubber over Member 1's normalized hourly data, heat-stress
estimates, activity-priority cards and a personalized EN/HI advisory (speech
synthesis optional, never autoplayed).

Same layering as Member 1 — pure logic first, React thin:

```
src/config/      ← every threshold + every bilingual string (nothing hard-coded in components)
src/services/    ← pure JS: timeline math, heat stress, activity rules, advisory text
src/hooks/       ← selection state + speech wrapper
src/components/  ← AdaptiveExperience (wires everything) + ChronoTimeline, HeatStressCard, ActivityCards, VoiceAdvisory
src/adaptive.css ← styles, reusing design tokens from src/index.css
```

## Attribution & safety

Heat index and wet-bulb values are **estimates derived from forecast data**,
not official warnings (formulas cited below). Every estimate and every spoken
advisory carries a disclaimer. All thresholds and copy live in
`src/config/adaptiveThresholds.js` / `src/config/adaptiveCopy.js` — tune them
there, never in components.

---

## 1. Timeline — `src/services/timeline.js`

Consumes Member 1's `NormalizedWeather` contract (`current.time` is a local
wall-clock ISO string **without** an offset — compare string prefixes, never
`new Date()`).

| Export | Signature | Notes |
| --- | --- | --- |
| `datePart(localDateTime)` | `(string) => string` | `"2026-10-18T14:00"` → `"2026-10-18"`. |
| `hourPart(localDateTime)` | `(string) => number \| null` | → `14`, or `null` if malformed. |
| `indexHourlyByDay(hourly)` | `(NormalizedHour[]) => { days: Day[], byDay: Record<date, HourSlot[]> }` | `Day = { date, slots, temperatureMin, temperatureMax }`. `days` in chronological order; each `slots` is a fixed length-24 array (`HourSlot[]`, empty slots are `null`). |
| `classifyHour(point, currentTime)` | `(NormalizedHour, string) => 'past' \| 'current' \| 'future'` | Wall-clock comparison. |
| `getCurrentSelection(weather)` | `(NormalizedWeather) => { date, hour } \| null` | Today + current hour when the hourly array covers it; otherwise the nearest available hour today, otherwise the first available hour. |
| `hasHourForSelection(hourly, selection)` | | Whether a re-init is needed. |
| `resolveSelection(byDay, selection)` | | → `NormalizedHour \| null`. |
| `dayTemperatureRange(slots)` | `(HourSlot[]) => { min, max } \| null` | For the timeline temperature sparkline. |
| `nearestAvailableHour(slots, preferred)` | `(HourSlot[], number) => number` | Falls back gracefully around gaps. |

**Hook** — `src/hooks/useSelectedHour.js`:

```js
const { selection, days, daySlots, selectedPoint, nowSlot, selectDay, selectHour, jumpToNow } =
  useSelectedHour(weather)
```

Selection survives weather refreshes and location switches only when the place
id is unchanged; otherwise it re-initializes to "now".

## 2. Heat stress — `src/services/heatStress.js`

Both functions are pure and defensive: bad/missing input returns
`{ status: 'unavailable', reasonKey, params }` — never a fabricated number.

| Export | Formula / rule |
| --- | --- |
| `computeHeatIndex({ temperature, relativeHumidity })` | NWS **Rothfusz regression** (°F), converted back to °C. Valid only when `temperature ≥ 27°C` **and** `relativeHumidity ≥ 40%`; otherwise `unavailable` with a `reasonKey`. Plausibility-clamped. Categories from `HEAT_INDEX_CATEGORIES` (`caution` → `extreme-danger`). |
| `computeWetBulb({ temperature, relativeHumidity })` | **Stull (2011)** approximation. Valid for `5 ≤ RH ≤ 99%` and `-20 ≤ T ≤ 50°C`. Bands from `WET_BULB_BANDS` (`low` → `limit`). |
| `celsiusToFahrenheit` / `fahrenheitToCelsius` | Shared conversion helpers. |
| `METHODS` | `'rothfusz-regression'` / `'stull-2011'` — surfaced in the UI for transparency. |

Constants (`HEAT_INDEX_VALIDITY`, `HEAT_INDEX_CATEGORIES`,
`WET_BULB_VALIDITY`, `WET_BULB_BANDS`) live in
`src/config/adaptiveThresholds.js`.

## 3. Activity engine — `src/services/activityEngine.js`

| Export | Notes |
| --- | --- |
| `evaluateActivities(point, context)` | Evaluates every activity in `ACTIVITIES`; returns evaluations in catalogue order. |
| `evaluateActivity(activity, point, context)` | `context` may include `heatIndex`. |
| `evaluateFactor(factorId, point, context, activity)` | One judgement per factor (`rain`, `thunderstorm`, `wind`, `heat`, `cold`, `heatIndex`, `precipitation`); returns `{ factorId, status, value, threshold, reasonKey }`. |
| `groupEvaluationsByStatus(evaluations, language, labelFor)` | Groups not-recommended activities for the advisory sentence. |
| `LEVELS` | `ok` < `caution` < `notRecommended` (precedence); `unknown` means *no judgement possible* — never a silent pass. |

**Status rule:** worst explicit judgement wins; `unknown` is returned only
when *no* factor produced a judgement. Every activity carries bilingual
`precautions` (see `src/config/activities.js`), including per-activity
`thresholdOverrides` (e.g. cycling is cautious about rain earlier than walking).

## 4. Advisory — `src/services/advisoryEngine.js`

| Export | Notes |
| --- | --- |
| `buildAdvisory({ weather, selection, point, evaluations, heatIndex, language })` | One paragraph: place + time + feels-like + condition + rain chance + wind, estimated heat index (when available), activity verdicts, disclaimer. |
| `dayPhrase(date, timezone, language)` | Wall-clock "today"/"tomorrow" phrasing, EN + HI. |

Sentence-level builders (`advisoryConditionSentence`, `advisoryHeatSentence`,
`advisoryActivitySentence`, `advisoryDisclaimer`, `advisoryNoDataSentence`,
`spokenTimePhrase`) are exported from `src/config/adaptiveCopy.js` for reuse.

## 5. Voice — `src/hooks/useSpeech.js`

`useSpeech()` wraps the Web Speech API: `supported`, `speaking`, `speak(text,
language)`, `cancel()`. **Speech never starts without an explicit user
action.** Voices are chosen per language prefix (`en`/`hi`); no matching
voice → the button reports unavailability instead of speaking the wrong
language.

## 6. Components

| Component | Role |
| --- | --- |
| `AdaptiveExperience` | Owns language state (persisted at `localStorage['mausam.adaptive.language.v1']`, validated through `isLanguage`) and composes the section. Renders the no-data card when hourly data or selection is missing. |
| `ChronoTimeline` | Today/tomorrow tabs + 24-slot scrubber. Each slot is a button (click **and** keyboard operable, labelled via `hourStateLabel`), shows a temperature sparkline, past/current/future styling, and a "Now" jump. |
| `HeatStressCard` | The two `Estimate` panels (heat index, wet-bulb) with value, category chip, reasons/limits, formula + inputs, disclaimer. |
| `ActivityCards` | One card per activity: status label/summary, deciding reasons, bilingual precautions, inline SVG icon. |
| `VoiceAdvisory` | Advisory text, EN/HI toggle (persists), speak/stop controls, spoken time in the selected language. |

The section is rendered in `src/App.jsx` between the current-weather card and
the daily forecast, under an `<h2>` ("Plan your hours" / "अपने घंटों की
योजना बनाएं").

## 7. Styling — `src/adaptive.css`

Reuses Member 1's tokens (`--color-*`, `--radius-*`, `--space-*`,
`--shadow-*`) and card/button/metric primitives. One notable trick: the range
thumb width is set to `trackWidth/24` (`--chrono-thumb`, fallback
`calc(100%/24)`) so native thumb centers align exactly with the 24 visual
slots.

## 8. Verification

The pure layer was exercised by a throwaway Node script
(`member2-sanity.mjs`, removed after the run) — 40 checks, all passing:
heat index against NWS chart values, wet-bulb ≈18°C at 25°C/50% RH, timeline
indexing/gaps/classification, activity precedence and overrides, EN + HI
advisory text including disclaimers. `npm run lint` and `npm run build` are
clean.

---

*Adaptive Experience module — Member 2. Prototype only; not an official IMD
service.*
