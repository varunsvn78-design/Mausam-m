import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DESCRIPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  isValidCoordinatePair,
  observationLabel,
  validateReportPayload,
} from './validation.js'

test('rejects an empty payload with field errors', () => {
  const result = validateReportPayload({})
  assert.equal(result.valid, false)
  assert.ok(result.errors.location)
  assert.ok(result.errors.type)
})

test('accepts a minimal valid payload without coordinates', () => {
  const result = validateReportPayload({ location: 'Pune', type: 'light-rain' })
  assert.equal(result.valid, true)
  assert.deepEqual(result.value, {
    location: 'Pune',
    type: 'light-rain',
    description: '',
    latitude: null,
    longitude: null,
  })
})

test('accepts and coerces numeric coordinates', () => {
  const result = validateReportPayload({
    location: 'Pune',
    type: 'heavy-rain',
    latitude: '18.52',
    longitude: '73.85',
  })
  assert.equal(result.valid, true)
  assert.equal(result.value.latitude, 18.52)
  assert.equal(result.value.longitude, 73.85)
})

test('rejects out-of-range coordinates', () => {
  const result = validateReportPayload({ location: 'X', type: 'other', latitude: 120, longitude: 200 })
  assert.equal(result.valid, false)
  assert.ok(result.errors.coordinates)
})

test('rejects a half-provided coordinate pair', () => {
  const result = validateReportPayload({ location: 'X', type: 'other', latitude: 12 })
  assert.equal(result.valid, false)
  assert.ok(result.errors.coordinates)
})

test('rejects an unknown observation type', () => {
  const result = validateReportPayload({ location: 'X', type: 'meteor-strike' })
  assert.equal(result.valid, false)
  assert.ok(result.errors.type)
})

test('rejects over-long location and description', () => {
  const result = validateReportPayload({
    location: 'a'.repeat(LOCATION_MAX_LENGTH + 1),
    type: 'other',
    description: 'b'.repeat(DESCRIPTION_MAX_LENGTH + 1),
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.location)
  assert.ok(result.errors.description)
})

test('trims location and description', () => {
  const result = validateReportPayload({ location: '  Pune  ', type: 'other', description: '  hi  ' })
  assert.equal(result.valid, true)
  assert.equal(result.value.location, 'Pune')
  assert.equal(result.value.description, 'hi')
})

test('isValidCoordinatePair treats null/undefined as optional', () => {
  assert.equal(isValidCoordinatePair(null, null), true)
  assert.equal(isValidCoordinatePair(undefined, undefined), true)
  assert.equal(isValidCoordinatePair(NaN, 10), false)
})

test('observationLabel resolves known ids and passes through unknown', () => {
  assert.equal(observationLabel('heavy-rain'), 'Heavy rain')
  assert.equal(observationLabel('mystery'), 'mystery')
})
