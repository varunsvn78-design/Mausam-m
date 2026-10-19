import { useEffect, useRef, useState } from 'react'
import { Clock3 } from 'lucide-react'
import {
  OBSERVATION_TYPES,
  validateReport,
  DESCRIPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
} from '../services/reportStore.js'

function formatDeviceTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return null
  }
}

/**
 * Rain-check reporting form (Member 3).
 *
 * Honest-by-design: reports are stored in THIS BROWSER ONLY (localStorage).
 * There is no backend and no authority integration — the form, success
 * message and stored-record list all say so. Covers idle, inline-error,
 * submitting, success and failure states.
 *
 * @param {{
 *   defaultLocation?: string,
 *   reports: Array<object>,
 *   onSubmit: (draft: object) => { ok: boolean, error?: string, errors?: Record<string,string> },
 *   onClear: () => boolean,
 *   clearFailed: boolean,
 * }} props
 */
export function RainReportForm({ defaultLocation = '', reports, onSubmit, onClear, clearFailed }) {
  const [location, setLocation] = useState(defaultLocation)
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [touched, setTouched] = useState({})
  const [phase, setPhase] = useState('idle') // idle | submitting | success | failure
  const [savedAt, setSavedAt] = useState(null)
  const [failureReason, setFailureReason] = useState(null)
  const [clockAt, setClockAt] = useState(() => Date.now())
  const locationEditedRef = useRef(false)
  const formRef = useRef(null)

  useEffect(() => {
    if (!locationEditedRef.current && defaultLocation) setLocation(defaultLocation)
  }, [defaultLocation])

  const draft = { location, type, description }
  const { valid, errors } = validateReport(draft)
  const showError = (field) => Boolean(errors[field]) && (submitted || touched[field])
  const descriptionOver = description.length > DESCRIPTION_MAX_LENGTH

  const submitDraft = () => {
    if (!valid) {
      setSubmitted(true)
      const firstField = errors.location ? 'location' : errors.type ? 'type' : 'description'
      formRef.current?.querySelector(`[name="${firstField}"]`)?.focus()
      return
    }

    setSubmitted(true)
    setPhase('submitting')
    setFailureReason(null)
    window.setTimeout(() => {
      const result = onSubmit({ location, type, description })
      if (result.ok) {
        setSavedAt(Date.now())
        setClockAt(Date.now())
        setPhase('success')
        setType('')
        setDescription('')
        setSubmitted(false)
        setTouched({})
      } else {
        setFailureReason(result.error)
        setPhase('failure')
      }
    }, 450)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    submitDraft()
  }

  const startNew = () => {
    setPhase('idle')
    setFailureReason(null)
  }

  return (
    <div className="community-block">
      <header>
        <p className="community-block__eyebrow">Community rain check</p>
        <h3 className="community-block__title">Report rain where you are</h3>
        <p className="community-block__hint">
          <strong>Demo reporting:</strong> entries are stored in this browser on this device only. Nothing is sent
          to any server, authority, or emergency service, and reports are not shared with other users.
        </p>
      </header>

      <form
        className="card report-form"
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        aria-describedby="report-privacy"
      >
        <div className="report-form__grid">
          <div className="field">
            <label className="field__label" htmlFor="report-location">
              Your location
              <span className="field__required" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </label>
            <input
              id="report-location"
              name="location"
              className="field__input"
              type="text"
              value={location}
              maxLength={LOCATION_MAX_LENGTH}
              autoComplete="address-level2"
              placeholder="e.g. Bengaluru, Karnataka"
              aria-invalid={showError('location') ? 'true' : undefined}
              aria-describedby={showError('location') ? 'report-location-error' : undefined}
              onChange={(event) => {
                locationEditedRef.current = true
                setLocation(event.target.value)
              }}
              onBlur={() => setTouched((t) => ({ ...t, location: true }))}
            />
            {showError('location') && (
              <p className="field__error" id="report-location-error" role="alert">
                {errors.location}
              </p>
            )}
            {!locationEditedRef.current && defaultLocation && (
              <p className="field__hint">Prefilled from your selected weather location — editable.</p>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="report-type">
              What did you observe?
              <span className="field__required" aria-hidden="true">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </label>
            <select
              id="report-type"
              name="type"
              className="field__select"
              value={type}
              aria-invalid={showError('type') ? 'true' : undefined}
              aria-describedby={showError('type') ? 'report-type-error' : undefined}
              onChange={(event) => setType(event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, type: true }))}
            >
              <option value="">Choose an observation…</option>
              {OBSERVATION_TYPES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {showError('type') && (
              <p className="field__error" id="report-type-error" role="alert">
                {errors.type}
              </p>
            )}
          </div>

          <div className="field field--full">
            <label className="field__label" htmlFor="report-description">
              Description
              <span className="field__optional">(optional)</span>
            </label>
            <textarea
              id="report-description"
              name="description"
              className="field__textarea"
              value={description}
              maxLength={DESCRIPTION_MAX_LENGTH + 40}
              placeholder="Anything useful, e.g. started at 4 pm, waterlogging on main road…"
              aria-invalid={showError('description') ? 'true' : undefined}
              aria-describedby={
                showError('description')
                  ? 'report-description-error report-description-counter'
                  : 'report-description-counter'
              }
              onChange={(event) => setDescription(event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, description: true }))}
            />
            <p
              className={`field__counter${descriptionOver ? ' field__counter--over' : ''}`}
              id="report-description-counter"
            >
              {description.length} / {DESCRIPTION_MAX_LENGTH}
            </p>
            {showError('description') && (
              <p className="field__error" id="report-description-error" role="alert">
                {errors.description}
              </p>
            )}
          </div>
        </div>

        <p className="report-form__time">
          <Clock3 size={15} aria-hidden="true" /> Submission time (device clock):{' '}
          <strong>{formatDeviceTime(clockAt)}</strong>
        </p>

        <div className="report-form__actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={phase === 'submitting'}
            aria-busy={phase === 'submitting' ? 'true' : undefined}
          >
            {phase === 'submitting' ? 'Saving locally…' : 'Save report on this device'}
          </button>
          {phase === 'success' && (
            <button type="button" className="button button--ghost" onClick={startNew}>
              Report another
            </button>
          )}
        </div>

        <p className="report-form__privacy" id="report-privacy">
          Stored locally under <code>localStorage</code> key <code>mausam.community.reports.v1</code> (demo,
          capped at 20 entries). Do not enter personal or sensitive information.
        </p>

        {phase === 'submitting' && (
          <div className="report-form__status" role="status" aria-live="polite">
            Saving your report on this device…
          </div>
        )}

        {phase === 'success' && savedAt && (
          <div className="report-form__status report-form__status--success" role="status" aria-live="polite">
            <p className="report-form__status-title">Saved on this device</p>
            <p>
              Your report was stored locally at {formatDeviceTime(savedAt)}. It was <strong>not</strong> sent to
              any authority — this is a local demo record.
            </p>
          </div>
        )}

        {phase === 'failure' && (
          <div className="report-form__status report-form__status--error" role="alert">
            <p className="report-form__status-title">Could not save the report</p>
            <p>
              {failureReason === 'storage'
                ? 'Local storage rejected the write (it may be full or disabled in private browsing). Nothing was saved.'
                : 'The report could not be saved. Please try again.'}
            </p>
            <div className="report-form__status-actions">
              <button type="button" className="button button--ghost" onClick={submitDraft}>
                Retry
              </button>
              <button type="button" className="button button--ghost" onClick={startNew}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="community-block">
        <header className="block-toolbar">
          <div>
            <h4 className="block-toolbar__title">Reports stored on this device</h4>
            <span className="block-toolbar__count">{reports.length} local demo record(s)</span>
          </div>
          {reports.length > 0 && (
            <button type="button" className="button button--ghost" onClick={onClear}>
              Clear local reports
            </button>
          )}
        </header>

        {clearFailed && (
          <p className="field__error" role="alert">
            Could not clear local reports — storage may be unavailable.
          </p>
        )}

        {reports.length === 0 ? (
          <div className="card state-message state-message--empty">
            <h4>No local reports yet</h4>
            <p>Reports you save appear here, on this device only. They are never uploaded.</p>
          </div>
        ) : (
          <ul className="reports-list">
            {reports.map((report) => (
              <li key={report.id} className="reports-list__item">
                <span className="reports-list__place">{report.location}</span>
                <span className="badge badge--muted">{report.typeLabel}</span>
                <span className="reports-list__meta">
                  {formatDeviceTime(report.observedAt)} · local demo record
                </span>
                {report.description && <p className="reports-list__desc">{report.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default RainReportForm
