import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Browser geolocation for the "Use my location" control.
 *
 * The permission prompt is only ever triggered by an explicit user action
 * (`locate()` is called from a click). Nothing here runs on mount.
 *
 * `status` values:
 *   'idle'        - locate() has not been called yet
 *   'locating'    - a position request is in flight
 *   'success'     - `coords` holds the last position
 *   'denied'      - the user blocked the permission
 *   'unavailable' - the browser/OS could not determine a position (or is unsupported)
 *   'timeout'     - the request took too long
 *
 * `locate()` returns a Promise that resolves with
 * `{ latitude, longitude, accuracy }` or rejects with a typed `GeolocationError`.
 */

const GEO_OPTIONS = Object.freeze({
  enableHighAccuracy: false,
  timeout: 12000,
  maximumAge: 5 * 60 * 1000,
})

/** Error thrown by `locate()` so callers can branch on `.kind`. */
export class GeolocationError extends Error {
  constructor(message, { kind = 'unavailable', cause = null } = {}) {
    super(message)
    this.name = 'GeolocationError'
    this.kind = kind
    this.cause = cause
  }
}

const MESSAGES = {
  denied: 'Location access was blocked. Allow location permission in your browser and try again.',
  unavailable: 'Your location could not be determined. Try searching for a city instead.',
  timeout: 'Getting your location took too long. Try again or search for a city instead.',
}

function toGeolocationError(geoError) {
  const code = geoError?.code
  if (code === 1) return new GeolocationError(MESSAGES.denied, { kind: 'denied', cause: geoError })
  if (code === 3) return new GeolocationError(MESSAGES.timeout, { kind: 'timeout', cause: geoError })
  return new GeolocationError(MESSAGES.unavailable, { kind: 'unavailable', cause: geoError })
}

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.geolocation?.getCurrentPosition === 'function'
}

export function useGeolocation() {
  const supported = isGeolocationSupported()
  const [status, setStatus] = useState('idle')
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const locate = useCallback(() => {
    if (!isGeolocationSupported()) {
      const unsupported = new GeolocationError(MESSAGES.unavailable, { kind: 'unavailable' })
      setError(unsupported)
      setStatus('unavailable')
      return Promise.reject(unsupported)
    }

    setStatus('locating')
    setError(null)

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          }
          // Always settle the promise, even after unmount, so callers never hang.
          if (!mountedRef.current) {
            resolve(next)
            return
          }
          setCoords(next)
          setError(null)
          setStatus('success')
          resolve(next)
        },
        (geoError) => {
          const normalised = toGeolocationError(geoError)
          if (!mountedRef.current) {
            reject(normalised)
            return
          }
          setCoords(null)
          setError(normalised)
          setStatus(normalised.kind)
          reject(normalised)
        },
        GEO_OPTIONS,
      )
    })
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setCoords(null)
    setError(null)
  }, [])

  return {
    supported,
    status,
    coords,
    error,
    isLocating: status === 'locating',
    locate,
    reset,
  }
}
