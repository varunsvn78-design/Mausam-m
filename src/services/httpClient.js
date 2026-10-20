/**
 * Low-level HTTP helper shared by the weather and geocoding services.
 *
 * Responsibilities:
 *  - build query strings
 *  - perform `fetch` requests with a timeout
 *  - combine an external AbortSignal (search cancellation) with the timeout
 *  - turn unsuccessful HTTP responses / malformed JSON into typed errors
 *
 * Nothing in here knows about weather, so it can be reused by any service.
 */

export const DEFAULT_TIMEOUT_MS = 15000

/**
 * Error type thrown by the API layer so the UI can distinguish failure modes.
 * `kind` is one of: 'network' | 'timeout' | 'http' | 'parse' | 'aborted' | 'invalid'
 */
export class ApiError extends Error {
  constructor(message, { kind = 'network', status = null, url = null, cause = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.url = url
    this.cause = cause
  }
}

/** Append a plain-object of parameters to a base URL, skipping null/undefined. */
export function buildUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl)
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

/**
 * Fetch JSON from `url`.
 *
 * @param {string} url
 * @param {{ signal?: AbortSignal, timeoutMs?: number, serviceName?: string }} [options]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, { signal, timeoutMs = DEFAULT_TIMEOUT_MS, serviceName = 'weather service' } = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(new ApiError(`${serviceName} request timed out.`, { kind: 'timeout', url })),
    timeoutMs,
  )

  // Forward an external abort (e.g. the user typed another character) to the request.
  const onExternalAbort = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) onExternalAbort()
    else signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  let response
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason
      if (reason instanceof ApiError && reason.kind === 'timeout') throw reason
      throw new ApiError('Request was cancelled', { kind: 'aborted', url, cause: error })
    }
    throw new ApiError(`Unable to reach the ${serviceName}. Check your connection.`, {
      kind: 'network',
      url,
      cause: error,
    })
  } finally {
    clearTimeout(timeoutId)
    if (signal) signal.removeEventListener('abort', onExternalAbort)
  }

  if (!response.ok) {
    throw new ApiError(`The ${serviceName} responded with status ${response.status}.`, {
      kind: 'http',
      status: response.status,
      url,
    })
  }

  try {
    return await response.json()
  } catch (error) {
    throw new ApiError(`The ${serviceName} returned malformed data.`, { kind: 'parse', url, cause: error })
  }
}

/** True when an error was caused by an intentional abort (obsolete request). */
export function isAbortError(error) {
  return error instanceof ApiError ? error.kind === 'aborted' : error?.name === 'AbortError'
}
