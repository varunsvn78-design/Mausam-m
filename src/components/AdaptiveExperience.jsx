import { useMemo, useState } from 'react'
import ChronoTimeline from './ChronoTimeline.jsx'
import HeatStressCard from './HeatStressCard.jsx'
import ActivityCards from './ActivityCards.jsx'
import VoiceAdvisory from './VoiceAdvisory.jsx'
import { useSelectedHour } from '../hooks/useSelectedHour.js'
import { computeHeatIndex, computeWetBulb } from '../services/heatStress.js'
import { evaluateActivities } from '../services/activityEngine.js'
import { buildAdvisory } from '../services/advisoryEngine.js'
import { SECTION_COPY, TIMELINE_COPY, isLanguage } from '../config/adaptiveCopy.js'
import '../adaptive.css'

const LANGUAGE_STORAGE_KEY = 'mausam.adaptive.language.v1'

function loadStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguage(stored) ? stored : 'en'
  } catch {
    return 'en'
  }
}

/**
 * Member 2 — Adaptive Experience.
 *
 * Composes the chrono-UI (24-hour scrubber), heat-stress estimates, activity
 * cards and the bilingual voice advisory around Member 1's NormalizedWeather
 * data. All heavy lifting happens in pure services (`src/services/*`); this
 * component only holds selection + language state and passes props.
 *
 * @param {{ weather: object|null }} props NormalizedWeather from useWeatherEngine()
 */
export function AdaptiveExperience({ weather }) {
  const [language, setLanguage] = useState(loadStoredLanguage)

  const changeLanguage = (id) => {
    if (!isLanguage(id)) return
    setLanguage(id)
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, id)
    } catch {
      /* storage unavailable (private mode) — selection simply won't persist */
    }
  }

  const { selection, days, daySlots, selectedPoint, nowSlot, selectDay, selectHour, jumpToNow } =
    useSelectedHour(weather)

  const heatIndex = useMemo(
    () =>
      selectedPoint
        ? computeHeatIndex({
            temperature: selectedPoint.temperature,
            relativeHumidity: selectedPoint.relativeHumidity,
          })
        : null,
    [selectedPoint],
  )

  const wetBulb = useMemo(
    () =>
      selectedPoint
        ? computeWetBulb({
            temperature: selectedPoint.temperature,
            relativeHumidity: selectedPoint.relativeHumidity,
          })
        : null,
    [selectedPoint],
  )

  const evaluations = useMemo(
    () => evaluateActivities(selectedPoint, { heatIndex }),
    [selectedPoint, heatIndex],
  )

  const advisory = useMemo(
    () =>
      buildAdvisory({
        weather,
        selection,
        point: selectedPoint,
        evaluations,
        heatIndex,
        language,
      }),
    [weather, selection, selectedPoint, evaluations, heatIndex, language],
  )

  if (!weather) return null

  const hasHourly = Array.isArray(weather.hourly) && weather.hourly.length > 0
  const ready = hasHourly && Boolean(selection)

  return (
    <section className="adaptive" aria-labelledby="adaptive-heading">
      <header className="adaptive__header">
        <p className="adaptive__eyebrow">{SECTION_COPY.eyebrow[language]}</p>
        <h2 id="adaptive-heading" className="adaptive__title">
          {SECTION_COPY.title[language]}
        </h2>
        <p className="adaptive__intro">{SECTION_COPY.intro[language]}</p>
      </header>

      {!ready ? (
        <div className="card state-message">
          <h3>{TIMELINE_COPY.noDataTitle[language]}</h3>
          <p>{TIMELINE_COPY.noData[language]}</p>
        </div>
      ) : (
        <div className="stack">
          <ChronoTimeline
            weather={weather}
            language={language}
            selection={selection}
            days={days}
            daySlots={daySlots}
            selectedPoint={selectedPoint}
            nowSlot={nowSlot}
            onSelectDay={selectDay}
            onSelectHour={selectHour}
            jumpToNow={jumpToNow}
          />

          <div className="adaptive__split">
            <HeatStressCard
              heatIndex={heatIndex}
              wetBulb={wetBulb}
              point={selectedPoint}
              language={language}
            />
            <VoiceAdvisory text={advisory} language={language} onLanguageChange={changeLanguage} />
          </div>

          <ActivityCards evaluations={evaluations} point={selectedPoint} language={language} />
        </div>
      )}
    </section>
  )
}

export default AdaptiveExperience
