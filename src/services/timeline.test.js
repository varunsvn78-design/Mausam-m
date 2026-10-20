import { describe, expect, it } from 'vitest'
import {
  classifyHour,
  datePart,
  dayTemperatureRange,
  getCurrentSelection,
  hasHourForSelection,
  hourPart,
  indexHourlyByDay,
  nearestAvailableHour,
  resolveSelection,
} from './timeline.js'

describe('datePart / hourPart', () => {
  it('extracts the date and hour by string slicing (no Date parsing)', () => {
    expect(datePart('2026-05-01T14:00')).toBe('2026-05-01')
    expect(hourPart('2026-05-01T14:00')).toBe(14)
    expect(hourPart('2026-05-01T00:00')).toBe(0)
  })

  it('returns null for malformed input', () => {
    expect(datePart(null)).toBeNull()
    expect(hourPart('bad')).toBeNull()
    expect(hourPart('2026-05-01')).toBeNull()
  })
})

describe('indexHourlyByDay', () => {
  it('creates sparse 24-slot days and preserves forecast order', () => {
    const { days, byDay } = indexHourlyByDay([
      { time: '2026-05-01T00:00' },
      { time: '2026-05-01T06:00' },
      { time: '2026-05-02T00:00' },
    ])
    expect(days).toEqual(['2026-05-01', '2026-05-02'])
    expect(byDay['2026-05-01']).toHaveLength(24)
    expect(byDay['2026-05-01'][6].time).toBe('2026-05-01T06:00')
    expect(byDay['2026-05-01'][5]).toBeNull()
  })

  it('ignores malformed entries and non-arrays', () => {
    expect(indexHourlyByDay(null).days).toEqual([])
    expect(indexHourlyByDay([{ time: null }]).days).toEqual([])
  })
})

describe('classifyHour', () => {
  it('classifies past / current / future against the observation hour', () => {
    const current = '2026-05-01T10:30'
    expect(classifyHour({ time: '2026-05-01T09:00' }, current)).toBe('past')
    expect(classifyHour({ time: '2026-05-01T10:00' }, current)).toBe('current')
    expect(classifyHour({ time: '2026-05-01T11:00' }, current)).toBe('future')
  })

  it('returns unknown without a reference time', () => {
    expect(classifyHour({ time: '2026-05-01T10:00' }, null)).toBe('unknown')
  })
})

describe('getCurrentSelection', () => {
  it('returns the current observation slot when present', () => {
    const weather = { current: { time: '2026-05-01T10:00' }, hourly: [] }
    expect(getCurrentSelection(weather)).toEqual({ date: '2026-05-01', hour: 10 })
  })

  it('falls back to the first forecast day when current is missing', () => {
    const weather = { current: {}, hourly: [{ time: '2026-05-03T05:00' }] }
    expect(getCurrentSelection(weather)).toEqual({ date: '2026-05-03', hour: 0 })
  })

  it('returns null when nothing is available', () => {
    expect(getCurrentSelection({})).toBeNull()
  })
})

describe('hasHourForSelection / resolveSelection', () => {
  const hourly = [{ time: '2026-05-01T08:00', temperature: 25 }]
  it('detects present and absent slots', () => {
    expect(hasHourForSelection(hourly, { date: '2026-05-01', hour: 8 })).toBe(true)
    expect(hasHourForSelection(hourly, { date: '2026-05-01', hour: 9 })).toBe(false)
    expect(hasHourForSelection(hourly, null)).toBe(false)
  })

  it('resolves the point or null', () => {
    const { byDay } = indexHourlyByDay(hourly)
    expect(resolveSelection(byDay, { date: '2026-05-01', hour: 8 }).temperature).toBe(25)
    expect(resolveSelection(byDay, { date: '2026-05-01', hour: 9 })).toBeNull()
    expect(resolveSelection(byDay, null)).toBeNull()
  })
})

describe('dayTemperatureRange', () => {
  it('computes min/max ignoring nulls', () => {
    const slots = [null, { temperature: 20 }, { temperature: 35 }, { temperature: null }]
    expect(dayTemperatureRange(slots)).toEqual({ min: 20, max: 35 })
  })

  it('expands a flat range so charts stay readable', () => {
    expect(dayTemperatureRange([{ temperature: 25 }])).toEqual({ min: 24, max: 26 })
  })

  it('returns null with no usable data', () => {
    expect(dayTemperatureRange([null, { temperature: null }])).toBeNull()
  })
})

describe('nearestAvailableHour', () => {
  it('returns the preferred hour when present', () => {
    const slots = []
    slots[10] = { time: '2026-05-01T10:00' }
    expect(nearestAvailableHour(slots, 10)).toBe(10)
  })

  it('finds the closest non-empty slot', () => {
    const slots = []
    slots[7] = { time: 'x' }
    expect(nearestAvailableHour(slots, 10)).toBe(7)
  })

  it('falls back to the preferred hour for an empty day', () => {
    expect(nearestAvailableHour([], 9)).toBe(9)
  })
})
