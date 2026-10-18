import { useEffect } from 'react'
import { LANGUAGES, VOICE_COPY } from '../config/adaptiveCopy.js'
import { useSpeech } from '../hooks/useSpeech.js'

/**
 * Language selector + speech controls for the generated advisory.
 *
 * - Speech only ever starts from a click/tap (never automatically).
 * - Playback is stopped whenever the advisory text changes (new hour, new
 *   location, new language) so stale advice is never read aloud.
 * - Where the Web Speech API is missing, the buttons are disabled and the
 *   always-visible text below remains the accessible alternative.
 *
 * @param {{ text: string, language: 'en'|'hi', onLanguageChange: (id:'en'|'hi')=>void }} props
 */
export function VoiceAdvisory({ text, language, onLanguageChange }) {
  const { supported, state, speak, pause, resume, stop, hasVoiceFor } = useSpeech()

  // Stop any playback when the underlying advisory changes.
  useEffect(() => {
    stop()
  }, [text, stop])

  const handlePlay = () => {
    if (state === 'paused') resume()
    else if (state === 'idle') speak(text, language)
  }

  const showPlay = state !== 'speaking'
  const showPause = state === 'speaking'
  const showStop = state === 'speaking' || state === 'paused'
  const statusLine = !supported
    ? VOICE_COPY.unsupported[language]
    : state === 'speaking'
      ? VOICE_COPY.speaking[language]
      : state === 'paused'
        ? VOICE_COPY.paused[language]
        : VOICE_COPY.idle[language]

  return (
    <section className="card advisory" aria-labelledby="advisory-heading">
      <p className="advisory__eyebrow">{VOICE_COPY.eyebrow[language]}</p>
      <h3 id="advisory-heading" className="advisory__title">
        {VOICE_COPY.title[language]}
      </h3>

      <div className="advisory__controls">
        <div className="advisory__field">
          <span className="advisory__field-label" id="advisory-language-label">
            {VOICE_COPY.languageLabel[language]}
          </span>
          <div className="advisory__langs" role="group" aria-labelledby="advisory-language-label">
            {LANGUAGES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`advisory__lang${entry.id === language ? ' is-active' : ''}`}
                aria-pressed={entry.id === language}
                onClick={() => onLanguageChange(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="advisory__buttons">
          {showPlay && (
            <button
              type="button"
              className="button button--primary advisory__button"
              onClick={handlePlay}
              disabled={!supported || !text}
            >
              <ControlIcon name="play" />
              {state === 'paused' ? VOICE_COPY.resume[language] : VOICE_COPY.play[language]}
            </button>
          )}
          {showPause && (
            <button
              type="button"
              className="button button--ghost advisory__button"
              onClick={pause}
              disabled={!supported}
            >
              <ControlIcon name="pause" />
              {VOICE_COPY.pause[language]}
            </button>
          )}
          {showStop && (
            <button type="button" className="button button--ghost advisory__button" onClick={stop}>
              <ControlIcon name="stop" />
              {VOICE_COPY.stop[language]}
            </button>
          )}
        </div>
      </div>

      <p className="advisory__status" role="status" aria-live="polite">
        {statusLine}
      </p>

      <div className="advisory__text">
        <p className="advisory__label">{VOICE_COPY.textLabel[language]}</p>
        <p className="advisory__body" lang={language === 'hi' ? 'hi' : 'en'}>
          {text || (language === 'hi' ? 'कोई सलाह उपलब्ध नहीं है।' : 'No advisory is available for this hour.')}
        </p>
      </div>

      {supported && !hasVoiceFor(language) && (
        <p className="advisory__note">{VOICE_COPY.noVoices[language]}</p>
      )}
    </section>
  )
}

function ControlIcon({ name }) {
  if (name === 'play') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    )
  }
  if (name === 'pause') {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <rect x="7" y="5.5" width="3.5" height="13" rx="1" />
        <rect x="13.5" y="5.5" width="3.5" height="13" rx="1" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
    </svg>
  )
}

export default VoiceAdvisory
