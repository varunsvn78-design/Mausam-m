import { HEAT_COPY, heatCategoryLabel, wetBulbBandLabel } from '../config/adaptiveCopy.js'
import { PLACEHOLDER, formatNumber } from '../utils/format.js'

/** Resolve a structured `{ reasonKey, params }` from heatStress into copy. */
function formatReason(reasons, result, language) {
  if (!result) return PLACEHOLDER
  const entry = reasons[result.reasonKey]
  if (!entry) return language === 'hi' ? 'गणना नहीं।' : 'Not calculated.'
  const text = language === 'hi' ? entry.hi : entry.en
  return typeof text === 'function' ? text(result.params ?? {}) : text
}

function Estimate({ label, result, reasons, category, tone, language, inputs }) {
  const isOk = result?.status === 'ok'
  const methodLabel = language === 'hi' ? `विधि: ${result?.method ?? PLACEHOLDER}` : `Method: ${result?.method ?? PLACEHOLDER}`

  return (
    <article className="estimate">
      <header className="estimate__head">
        <h4 className="estimate__label">{label}</h4>
        <span className="estimate__chip">{HEAT_COPY.estimatedChip[language]}</span>
      </header>

      {isOk ? (
        <>
          <p className="estimate__value">
            {formatNumber(result.valueC, { suffix: '°C', digits: 1 })}
            {category && <span className={`estimate__category estimate__category--${tone}`}>{category}</span>}
          </p>
          {inputs && (
            <p className="estimate__inputs">
              {HEAT_COPY.inputsUsed[language](inputs.temperature, inputs.humidity)}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="estimate__value estimate__value--empty">{HEAT_COPY.unavailable[language]}</p>
          <p className="estimate__reason">{formatReason(reasons, result, language)}</p>
        </>
      )}

      <details className="estimate__details">
        <summary>{HEAT_COPY.howThisWorks[language]}</summary>
        <p>{language === 'hi' ? reasons.meaning.hi : reasons.meaning.en}</p>
        <p>{language === 'hi' ? reasons.limitations.hi : reasons.limitations.en}</p>
        <p className="estimate__method">{methodLabel}</p>
      </details>
    </article>
  )
}

/**
 * Heat index and wet-bulb estimates for the selected hour.
 * Both are labelled "Estimated"; unavailable results show the reason instead
 * of a number, and nothing is shown when the hour itself is missing.
 *
 * @param {{ heatIndex: object, wetBulb: object, point: object|null, language: 'en'|'hi' }} props
 */
export function HeatStressCard({ heatIndex, wetBulb, point, language }) {
  const hasInputs = Number.isFinite(point?.temperature) && Number.isFinite(point?.relativeHumidity)
  const inputs = hasInputs
    ? { temperature: formatNumber(point.temperature, { digits: 0 }), humidity: Math.round(point.relativeHumidity) }
    : null

  return (
    <section className="card heat" aria-labelledby="heat-heading">
      <p className="heat__eyebrow">{language === 'hi' ? 'अनुमान' : 'Estimates'}</p>
      <h3 id="heat-heading" className="heat__title">
        {HEAT_COPY.title[language]}
      </h3>
      <p className="heat__subtitle">{HEAT_COPY.subtitle[language]}</p>

      <div className="heat__grid">
        <Estimate
          label={HEAT_COPY.heatIndexLabel[language]}
          result={heatIndex}
          reasons={HEAT_COPY.heatIndex}
          category={heatIndex?.categoryId ? heatCategoryLabel(heatIndex.categoryId, language) : null}
          tone={
            ['danger', 'extreme-danger'].includes(heatIndex?.categoryId)
              ? 'danger'
              : heatIndex?.categoryId
                ? 'warning'
                : 'info'
          }
          language={language}
          inputs={inputs}
        />
        <Estimate
          label={HEAT_COPY.wetBulbLabel[language]}
          result={wetBulb}
          reasons={HEAT_COPY.wetBulb}
          category={wetBulb?.bandId ? wetBulbBandLabel(wetBulb.bandId, language) : null}
          tone={
            ['limit', 'severe', 'high'].includes(wetBulb?.bandId)
              ? 'danger'
              : wetBulb?.bandId === 'elevated'
                ? 'warning'
                : 'info'
          }
          language={language}
          inputs={inputs}
        />
      </div>

      <p className="heat__source">{HEAT_COPY.sourceNote[language]}</p>
    </section>
  )
}

export default HeatStressCard
