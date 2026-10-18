/**
 * Advisory text generator (Member 2).
 *
 * Builds one concise, spoken-friendly sentence group from real forecast data,
 * the activity-priority results and the heat-stress estimate. Pure function —
 * no side effects, no audio. `src/components/VoiceAdvisory.jsx` decides when
 * (and whether) the browser reads it aloud.
 *
 * Always ends with the disclaimer so a generated advisory can never be
 * mistaken for an official warning.
 */

import {
  ACTIVITIES as ACTIVITY_CATALOGUE,
} from '../config/activities.js'
import {
  advisoryActivitySentence,
  advisoryConditionSentence,
  advisoryDisclaimer,
  advisoryHeatSentence,
  advisoryNoDataSentence,
  conditionLabel,
  heatCategoryLabel,
  spokenTimePhrase,
} from '../config/adaptiveCopy.js'
import { groupEvaluationsByStatus } from './activityEngine.js'
import { formatDateLabel, formatWeekday, todayInTimeZone } from '../utils/format.js'
import { datePart, hourPart } from './timeline.js'

/** Localised "Today" / "Tomorrow" / "Sat, 18 Oct" for a forecast date. */
export function dayPhrase(date, timezone, language) {
  const today = todayInTimeZone(timezone)
  const tomorrowDate = new Date(`${today}T12:00:00Z`)
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1)
  const tomorrow = tomorrowDate.toISOString().slice(0, 10)

  if (date === today) return language === 'hi' ? 'आज' : 'Today'
  if (date === tomorrow) return language === 'hi' ? 'कल' : 'Tomorrow'
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN'
  return `${formatWeekday(date, locale)}, ${formatDateLabel(date, locale)}`
}

function activityLabel(activityId, language) {
  const activity = ACTIVITY_CATALOGUE.find((entry) => entry.id === activityId)
  if (!activity) return activityId
  return language === 'hi' ? activity.labels.hi : activity.labels.en
}

/**
 * @param {{
 *   weather: object,                 // NormalizedWeather
 *   selection: { date: string, hour: number } | null,
 *   point: object | null,            // selected hourly point
 *   evaluations: Array<object>,      // from activityEngine.evaluateActivities
 *   heatIndex: object,               // from heatStress.computeHeatIndex
 *   language: 'en' | 'hi'
 * }} params
 * @returns {string} the advisory text (empty string when there is no data)
 */
export function buildAdvisory({ weather, selection, point, evaluations = [], heatIndex, language = 'en' }) {
  if (!point || !selection) return ''

  const place = weather?.location?.name ?? (language === 'hi' ? 'चुना गया स्थान' : 'the selected location')
  const timePhrase = `${dayPhrase(datePart(point.time), weather?.timezone, language)} ${spokenTimePhrase(
    hourPart(point.time) ?? selection.hour,
    language,
  )}`

  const conditions = advisoryConditionSentence(
    {
      place,
      timePhrase,
      condition: point.condition
        ? conditionLabel(point.condition.group, point.condition.label, language)
        : null,
      temperature: Number.isFinite(point.temperature) ? Math.round(point.temperature) : null,
      feelsLike: Number.isFinite(point.apparentTemperature) ? Math.round(point.apparentTemperature) : null,
      rainChance: Number.isFinite(point.precipitationProbability) ? Math.round(point.precipitationProbability) : null,
      windSpeed: Number.isFinite(point.windSpeed) ? Math.round(point.windSpeed) : null,
    },
    language,
  )

  const parts = [conditions]

  if (heatIndex?.status === 'ok') {
    parts.push(
      advisoryHeatSentence(
        { valueC: heatIndex.valueC, categoryLabel: heatCategoryLabel(heatIndex.categoryId, language) },
        language,
      ),
    )
  }

  const groups = groupEvaluationsByStatus(evaluations, language, activityLabel)
  const hasVerdict = groups.recommended.length > 0 || groups.caution.length > 0 || groups.avoid.length > 0
  if (hasVerdict) {
    parts.push(advisoryActivitySentence(groups, language))
  } else if (evaluations.length > 0) {
    parts.push(advisoryNoDataSentence(language))
  }

  parts.push(advisoryDisclaimer(language))

  return parts.filter(Boolean).join(' ')
}
