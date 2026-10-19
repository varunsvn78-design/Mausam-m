import { useEffect, useMemo, useRef, useState } from 'react'
import WeatherIcon from './WeatherIcon.jsx'
import { CloudDrizzle, CloudRain, Droplets, Moon, Sun, Thermometer, Wind } from 'lucide-react'
import { dayPhrase } from '../services/advisoryEngine.js'
import { classifyHour, dayTemperatureRange } from '../services/timeline.js'
import { TIMELINE_COPY, conditionLabel, hourStateLabel } from '../config/adaptiveCopy.js'
import {
  PLACEHOLDER,
  degreesToCompass,
  formatDateLabel,
  formatFullDate,
  formatNumber,
  formatTemperature,
  formatWeekday,
} from '../utils/format.js'

const HOURS = Array.from({ length: 24 }, (_, index) => index)
const HOUR_STEP_LABEL = 3 // print "00 03 06 …" under the track

/**
 * Chrono-UI: a 24-hour scrubber for the selected location.
 *
 * Interaction model:
 *  - a native `input[type=range]` (0–23) provides drag, touch and full
 *    keyboard support (arrows / Home / End / Page keys) with an aria-valuetext
 *    that reads time, temperature and past-current-upcoming state;
 *  - the visual track behind it (temperature bars + rain-probability ticks)
 *    is decorative and marked aria-hidden;
 *  - clicking anywhere on the track jumps to that hour (mirrors the range
 *    input's own thumb mapping so the two never disagree).
 *
 * Past / current / upcoming are derived from `weather.current.time`; when the
 * API provides no current time every hour is shown as unclassified.
 *
 * @param {{
 *   weather: object, language: 'en'|'hi',
 *   selection: {date:string,hour:number}, days: string[], daySlots: Array<object|null>,
 *   selectedPoint: object|null, nowSlot: {date:string,hour:number}|null,
 *   onSelectDay: (date:string)=>void, onSelectHour: (hour:number)=>void,
 *   jumpToNow: ()=>void
 * }} props
 */
export function ChronoTimeline({
  weather,
  language,
  selection,
  days,
  daySlots,
  selectedPoint,
  nowSlot,
  onSelectDay,
  onSelectHour,
  jumpToNow,
}) {
  const currentTime = weather?.current?.time ?? null
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN'
  const tempRange = useMemo(() => dayTemperatureRange(daySlots), [daySlots])

  const plotRef = useRef(null)
  const [plotWidth, setPlotWidth] = useState(0)

  useEffect(() => {
    const element = plotRef.current
    if (!element) return undefined
    if (typeof ResizeObserver === 'undefined') {
      setPlotWidth(element.getBoundingClientRect().width)
      return undefined
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width
      if (width) setPlotWidth(width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const thumbWidth = plotWidth > 0 ? plotWidth / 24 : null
  const selectedHour = selection.hour
  const selectedState = selectedPoint ? classifyHour(selectedPoint, currentTime) : 'missing'
  const timeLabel = `${String(selectedHour).padStart(2, '0')}:00`
  const dayLabel = dayPhrase(selection.date, weather?.timezone, language)
  const nowIsShown = Boolean(nowSlot && nowSlot.date === selection.date)
  const nowCenter = nowSlot ? ((nowSlot.hour + 0.5) / 24) * 100 : 0
  const selectedCenter = ((selectedHour + 0.5) / 24) * 100
  const isNowSelected = nowIsShown && nowSlot.hour === selectedHour

  const handlePlotClick = (event) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const thumb = thumbWidth ?? rect.width / 24
    const usable = Math.max(rect.width - thumb, 1)
    const offset = event.clientX - rect.left - thumb / 2
    const hour = Math.round((offset / usable) * 23)
    onSelectHour(Math.min(23, Math.max(0, hour)))
  }

  const barHeight = (point) => {
    const value = point?.temperature
    if (!Number.isFinite(value) || !tempRange) return null
    const ratio = (value - tempRange.min) / (tempRange.max - tempRange.min)
    return 20 + ratio * 80
  }

  const ariaValueText = (() => {
    const stateText = hourStateLabel(selectedState, language)
    const temp = selectedPoint && Number.isFinite(selectedPoint.temperature)
      ? `, ${Math.round(selectedPoint.temperature)} degrees`
      : ''
    return `${timeLabel}, ${stateText}${temp}`
  })()

  const dayChipLabel = (date, full = false) => {
    const phrase = dayPhrase(date, weather?.timezone, language)
    if (full) return `${phrase}, ${formatFullDate(date, locale)}`
    if (phrase === TIMELINE_COPY.today[language] || phrase === TIMELINE_COPY.tomorrow[language]) return phrase
    return `${formatWeekday(date, locale)} ${formatDateLabel(date, locale)}`
  }

  const windDirection = selectedPoint ? degreesToCompass(selectedPoint.windDirection) : null

  return (
    <section className="card chrono" aria-labelledby="chrono-heading">
      <header className="chrono__header">
        <div className="chrono__header-text">
          <p className="chrono__eyebrow">{TIMELINE_COPY.eyebrow[language]}</p>
          <h3 id="chrono-heading" className="chrono__title">
            {TIMELINE_COPY.title[language]}
          </h3>
          <p className="chrono__hint">{TIMELINE_COPY.hint[language]}</p>
        </div>

        <div className="chrono__header-actions">
          {days.length > 1 && (
            <div className="chrono__days" role="group" aria-label={TIMELINE_COPY.title[language]}>
              {days.map((date) => (
                <button
                  key={date}
                  type="button"
                  className={`chrono__day${date === selection.date ? ' is-active' : ''}`}
                  aria-pressed={date === selection.date}
                  aria-label={dayChipLabel(date, true)}
                  onClick={() => onSelectDay(date)}
                >
                  {dayChipLabel(date)}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="button button--ghost chrono__now"
            onClick={jumpToNow}
            disabled={!nowIsShown || isNowSelected}
          >
            {TIMELINE_COPY.nowButton[language]}
          </button>
        </div>
      </header>

      <div
        className="chrono__plot"
        ref={plotRef}
        onClick={handlePlotClick}
        style={thumbWidth ? { '--chrono-thumb': `${thumbWidth}px` } : undefined}
      >
        {nowIsShown && (
          <span
            className={`chrono__now-line${isNowSelected ? ' is-hidden' : ''}`}
            style={{ left: `${nowCenter}%` }}
            aria-hidden="true"
          >
            <span className="chrono__now-pill">{TIMELINE_COPY.now[language]}</span>
          </span>
        )}

        <div className="chrono__bubble" style={{ left: `${selectedCenter}%` }} aria-hidden="true">
          {timeLabel}
        </div>

        <div className="chrono__columns" aria-hidden="true">
          {daySlots.map((point, hour) => {
            const state = point ? classifyHour(point, currentTime) : 'missing'
            const height = barHeight(point)
            const isSelected = hour === selectedHour
            const label = `${String(hour).padStart(2, '0')}:00 — ${hourStateLabel(state, language)}`
            return (
              <div
                key={hour}
                className={`chrono__col chrono__col--${state}${isSelected ? ' is-selected' : ''}`}
                title={label}
              >
                <span className="chrono__bar" style={height ? { height: `${height}%` } : undefined}>
                  {height !== null && (hour % HOUR_STEP_LABEL === 0 || isSelected) && (
                    <span className="chrono__bar-temp">{formatTemperature(point.temperature)}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        <div className="chrono__rain" aria-hidden="true">
          {daySlots.map((point, hour) => {
            const probability = point?.precipitationProbability
            const hasValue = Number.isFinite(probability)
            const height = hasValue ? Math.max(2, (probability / 100) * 100) : 0
            return (
              <span
                key={hour}
                className={`chrono__rain-tick${hour === selectedHour ? ' is-selected' : ''}`}
                style={hasValue ? { height: `${height}%` } : undefined}
              />
            )
          })}
        </div>

        <input
          className="chrono__range"
          type="range"
          min={0}
          max={23}
          step={1}
          value={selectedHour}
          onChange={(event) => onSelectHour(Number(event.target.value))}
          aria-label={TIMELINE_COPY.selectedHour[language]}
          aria-valuetext={ariaValueText}
        />
      </div>

      <div className="chrono__labels" aria-hidden="true">
        {HOURS.map((hour) => (
          <span key={hour} className={`chrono__label${hour === selectedHour ? ' is-selected' : ''}`}>
            {hour % HOUR_STEP_LABEL === 0 || hour === selectedHour
              ? String(hour).padStart(2, '0')
              : ''}
          </span>
        ))}
      </div>

      <ul className="chrono__legend">
        <li className="chrono__legend-item chrono__legend-item--past">{TIMELINE_COPY.past[language]}</li>
        <li className="chrono__legend-item chrono__legend-item--current">
          {TIMELINE_COPY.current[language]}
        </li>
        <li className="chrono__legend-item chrono__legend-item--future">{TIMELINE_COPY.future[language]}</li>
        <li className="chrono__legend-item chrono__legend-item--missing">{TIMELINE_COPY.missing[language]}</li>
      </ul>

      {selectedPoint ? (
        <div className="chrono__readout">
          <div className="chrono__readout-head">
            <WeatherIcon
              group={selectedPoint.condition.group}
              isDay={selectedPoint.isDay}
              size={56}
              title={conditionLabel(selectedPoint.condition.group, selectedPoint.condition.label, language)}
              className={`weather-icon--${selectedPoint.isDay ? 'day' : 'night'}`}
            />
            <div className="chrono__readout-title">
              <p className="chrono__readout-time">
                <strong>{timeLabel}</strong>
                <span className="chrono__readout-day"> · {dayLabel}</span>
                <span className={`chrono__state chrono__state--${selectedState}`}>
                  {hourStateLabel(selectedState, language)}
                </span>
              </p>
              <p className="chrono__readout-temp">{formatTemperature(selectedPoint.temperature)}</p>
              <p className="chrono__readout-condition">
                {conditionLabel(selectedPoint.condition.group, selectedPoint.condition.label, language)}
              </p>
            </div>
          </div>

          <dl className="metric-grid chrono__metrics">
            <div className="metric">
              <dt>
                <Thermometer size={14} aria-hidden="true" />
                {language === 'hi' ? 'अहसास' : 'Feels like'}
              </dt>
              <dd>{formatTemperature(selectedPoint.apparentTemperature)}</dd>
            </div>
            <div className="metric">
              <dt>
                <Droplets size={14} aria-hidden="true" />
                {language === 'hi' ? 'आर्द्रता' : 'Humidity'}
              </dt>
              <dd>{formatNumber(selectedPoint.relativeHumidity, { suffix: '%' })}</dd>
            </div>
            <div className="metric">
              <dt>
                <Wind size={14} aria-hidden="true" />
                {language === 'hi' ? 'हवा' : 'Wind'}
              </dt>
              <dd>
                {formatNumber(selectedPoint.windSpeed, { suffix: ' km/h' })}
                {windDirection ? <span className="metric__hint"> {windDirection}</span> : null}
              </dd>
            </div>
            <div className="metric">
              <dt>
                <CloudDrizzle size={14} aria-hidden="true" />
                {language === 'hi' ? 'बारिश की संभावना' : 'Rain chance'}
              </dt>
              <dd>{formatNumber(selectedPoint.precipitationProbability, { suffix: '%' })}</dd>
            </div>
            <div className="metric">
              <dt>
                <CloudRain size={14} aria-hidden="true" />
                {language === 'hi' ? 'वर्षा (1 घंटा)' : 'Precipitation (1 h)'}
              </dt>
              <dd>{formatNumber(selectedPoint.precipitation, { suffix: ' mm', digits: 1 })}</dd>
            </div>
            <div className="metric">
              <dt>
                {selectedPoint.isDay ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
                {language === 'hi' ? 'रोशनी' : 'Daylight'}
              </dt>
              <dd>
                {typeof selectedPoint.isDay === 'boolean'
                  ? selectedPoint.isDay
                    ? language === 'hi'
                      ? 'दिन'
                      : 'Day'
                    : language === 'hi'
                      ? 'रात'
                      : 'Night'
                  : PLACEHOLDER}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="chrono__missing" role="status">
          <p className="chrono__missing-title">{TIMELINE_COPY.hourMissingTitle[language]}</p>
          <p className="chrono__missing-body">{TIMELINE_COPY.hourMissingBody[language]}</p>
        </div>
      )}
    </section>
  )
}

export default ChronoTimeline
