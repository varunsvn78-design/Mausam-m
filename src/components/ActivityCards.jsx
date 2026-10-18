import { ACTIVITY_COPY, STATUS_PRECAUTIONS, formatFactorReason, statusLabel, statusSummary } from '../config/adaptiveCopy.js'
import { PLACEHOLDER, formatTemperature } from '../utils/format.js'

const ICON_PATHS = {
  walk: (
    <>
      <circle cx="13" cy="4.5" r="2" />
      <path d="M13 7l-2.5 3.5L13 14l-1.5 7" />
      <path d="M13 7l2.5 3 2 1.5" />
      <path d="M10.5 10.5L7.5 13" />
      <path d="M11.5 14L9 21" />
    </>
  ),
  run: (
    <>
      <circle cx="15" cy="4.5" r="2" />
      <path d="M15 7l-3 2.5L14 13l-3 8" />
      <path d="M14 13l4 1 1 4" />
      <path d="M12 9.5L8 10.5" />
    </>
  ),
  cycle: (
    <>
      <circle cx="5.5" cy="16.5" r="3.5" />
      <circle cx="18.5" cy="16.5" r="3.5" />
      <path d="M5.5 16.5L10 9.5h4l4.5 7" />
      <path d="M10 9.5l4.5 7" />
      <path d="M8.5 9.5h3.5" />
    </>
  ),
  sport: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M6.5 6.5a9 9 0 0 1 3 11" />
      <path d="M17.5 17.5a9 9 0 0 1-3-11" />
    </>
  ),
  picnic: (
    <>
      <path d="M4 9.5h16l-1.5 10h-13z" />
      <path d="M8 9.5a4 4 0 0 1 8 0" />
      <path d="M4.5 13.5h15" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
      <circle cx="12" cy="14" r="3.5" />
      <path d="M8.5 7.5L10 5h4l1.5 2.5" />
    </>
  ),
}

function ActivityIcon({ name, title }) {
  const paths = ICON_PATHS[name] ?? ICON_PATHS.walk
  return (
    <svg
      className="activity__icon-svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      {paths}
    </svg>
  )
}

function valueChips(values, language) {
  if (!values) return []
  const chips = []
  const hi = language === 'hi'

  if (Number.isFinite(values.temperature)) {
    chips.push({ id: 'temp', text: `${hi ? 'तापमान' : 'Temp'} ${formatTemperature(values.temperature)}` })
  }
  if (Number.isFinite(values.precipitationProbability)) {
    chips.push({
      id: 'rain',
      text: `${hi ? 'बारिश' : 'Rain'} ${Math.round(values.precipitationProbability)}%`,
    })
  }
  if (Number.isFinite(values.windSpeed)) {
    chips.push({ id: 'wind', text: `${hi ? 'हवा' : 'Wind'} ${Math.round(values.windSpeed)} km/h` })
  }
  if (Number.isFinite(values.heatIndexC)) {
    chips.push({
      id: 'heat',
      text: `${hi ? 'हीट इंडेक्स' : 'Heat index'} ${formatTemperature(values.heatIndexC)}`,
    })
  } else if (Number.isFinite(values.apparentTemperature)) {
    chips.push({
      id: 'feels',
      text: `${hi ? 'अहसास' : 'Feels like'} ${formatTemperature(values.apparentTemperature)}`,
    })
  }
  if (Number.isFinite(values.relativeHumidity)) {
    chips.push({ id: 'humidity', text: `${hi ? 'आर्द्रता' : 'Humidity'} ${Math.round(values.relativeHumidity)}%` })
  }
  return chips
}

function ActivityCard({ evaluation, language }) {
  const { activity, status, deciding, results, values } = evaluation
  const name = language === 'hi' ? activity.labels.hi : activity.labels.en
  const reasonSource = deciding.length > 0 ? deciding : results.filter((result) => result.level === 'ok')
  const reasons = reasonSource.slice(0, 4)
  const chips = valueChips(values, language)
  const statusPrecaution = STATUS_PRECAUTIONS[status]
  const ownPrecaution = language === 'hi' ? activity.precautions.hi : activity.precautions.en

  return (
    <li className={`activity activity--${status}`}>
      <header className="activity__head">
        <span className="activity__badge-icon" aria-hidden="true">
          <ActivityIcon name={activity.icon} title="" />
        </span>
        <div className="activity__identity">
          <h4 className="activity__name">{name}</h4>
          <span className={`activity__badge activity__badge--${status}`}>
            <span className="activity__badge-dot" aria-hidden="true" />
            {statusLabel(status, language)}
          </span>
        </div>
      </header>

      <p className="activity__summary">{statusSummary(status, language)}</p>

      <div className="activity__block">
        <p className="activity__label">{ACTIVITY_COPY.whyLabel[language]}</p>
        {reasons.length > 0 ? (
          <ul className="activity__reasons">
            {reasons.map((result) => (
              <li key={result.factorId}>{formatFactorReason(result, language)}</li>
            ))}
          </ul>
        ) : (
          <p className="activity__reasons-empty">{ACTIVITY_COPY.noData[language]}</p>
        )}
      </div>

      {chips.length > 0 && (
        <div className="activity__block">
          <p className="activity__label">{ACTIVITY_COPY.valuesLabel[language]}</p>
          <ul className="activity__chips">
            {chips.map((chip) => (
              <li key={chip.id} className="activity__chip">
                {chip.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="activity__block activity__block--precaution">
        <p className="activity__label">{ACTIVITY_COPY.precautionLabel[language]}</p>
        <ul className="activity__precautions">
          {statusPrecaution && <li>{statusPrecaution[language]}</li>}
          <li>{ownPrecaution ?? PLACEHOLDER}</li>
        </ul>
      </div>
    </li>
  )
}

/**
 * Personalized activity cards for the selected hour.
 *
 * @param {{ evaluations: Array<object>, point: object|null, language: 'en'|'hi' }} props
 */
export function ActivityCards({ evaluations, point, language }) {
  return (
    <section className="card activities" aria-labelledby="activities-heading">
      <p className="activities__eyebrow">{ACTIVITY_COPY.eyebrow[language]}</p>
      <h3 id="activities-heading" className="activities__title">
        {ACTIVITY_COPY.title[language]}
      </h3>

      {!point && (
        <p className="activities__notice" role="status">
          {ACTIVITY_COPY.noData[language]}
        </p>
      )}

      <ul className="activities__grid">
        {evaluations.map((evaluation) => (
          <ActivityCard key={evaluation.activity.id} evaluation={evaluation} language={language} />
        ))}
      </ul>

      <p className="activities__disclaimer">{ACTIVITY_COPY.notice[language]}</p>
    </section>
  )
}

export default ActivityCards
