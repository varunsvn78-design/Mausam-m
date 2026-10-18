import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getCurrentSelection,
  hasHourForSelection,
  indexHourlyByDay,
  nearestAvailableHour,
  resolveSelection,
} from '../services/timeline.js'

/**
 * Selected-day/selected-hour state for the chrono-UI (Member 2).
 *
 * - Defaults to the location's current observation hour.
 * - Keeps the user's scrubbed hour across background data refreshes for the
 *   same place (as long as that slot still exists).
 * - Resets to "now" whenever a different place is loaded.
 *
 * @param {object|null} weather NormalizedWeather
 */
export function useSelectedHour(weather) {
  const [selection, setSelection] = useState(() => (weather ? getCurrentSelection(weather) : null))
  const placeIdRef = useRef(null)

  useEffect(() => {
    if (!weather) {
      placeIdRef.current = null
      setSelection(null)
      return
    }

    const placeId = weather.location?.id ?? `${weather.location?.latitude},${weather.location?.longitude}`
    const samePlace = placeIdRef.current === placeId
    placeIdRef.current = placeId

    setSelection((previous) => {
      if (samePlace && previous && hasHourForSelection(weather.hourly, previous)) return previous
      return getCurrentSelection(weather)
    })
  }, [weather])

  const { days, byDay } = useMemo(() => indexHourlyByDay(weather?.hourly), [weather?.hourly])

  const daySlots = useMemo(() => {
    if (!selection) return new Array(24).fill(null)
    return byDay[selection.date] ?? new Array(24).fill(null)
  }, [byDay, selection])

  const selectedPoint = useMemo(() => resolveSelection(byDay, selection), [byDay, selection])

  const nowSlot = (() => {
    const currentTime = weather?.current?.time
    if (typeof currentTime !== 'string' || currentTime.length < 13) return null
    const hour = Number(currentTime.slice(11, 13))
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
    return { date: currentTime.slice(0, 10), hour }
  })()

  const selectDay = useCallback(
    (date) => {
      setSelection((previous) => {
        const slots = byDay[date] ?? new Array(24).fill(null)
        const preferred = previous?.hour ?? 0
        return { date, hour: nearestAvailableHour(slots, preferred) }
      })
    },
    [byDay],
  )

  const selectHour = useCallback((hour) => {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return
    setSelection((previous) => (previous ? { ...previous, hour } : previous))
  }, [])

  const jumpToNow = useCallback(() => {
    if (!weather) return
    setSelection(getCurrentSelection(weather))
  }, [weather])

  return {
    selection,
    days,
    byDay,
    daySlots,
    selectedPoint,
    nowSlot,
    selectDay,
    selectHour,
    jumpToNow,
  }
}
