import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Browser speech-synthesis wrapper (Member 2).
 *
 * - Never plays on its own: `speak()` must be called from a user gesture.
 * - Degrades gracefully — `supported` is false where the Web Speech API is
 *   missing, and the UI then shows a readable text alternative instead.
 * - Cancels any in-flight utterance when `stop()` runs, on unmount, or when
 *   the caller changes the text (handled by VoiceAdvisory).
 *
 * States: 'idle' | 'speaking' | 'paused'.
 */
export function useSpeech() {
  const supported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function'

  const [voices, setVoices] = useState(() => (supported ? window.speechSynthesis.getVoices() : []))
  const [state, setState] = useState('idle')

  const utteranceRef = useRef(null)
  const resumeTimerRef = useRef(null)

  useEffect(() => {
    if (!supported) return undefined
    const synth = window.speechSynthesis
    const loadVoices = () => {
      const list = synth.getVoices()
      if (list?.length) setVoices(list)
    }
    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)
    return () => {
      synth.removeEventListener('voiceschanged', loadVoices)
      synth.cancel()
      utteranceRef.current = null
    }
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    clearTimeout(resumeTimerRef.current)
    utteranceRef.current = null
    setState('idle')
    window.speechSynthesis.cancel()
  }, [supported])

  const speak = useCallback(
    (text, language) => {
      if (!supported || !text) return false
      const synth = window.speechSynthesis
      clearTimeout(resumeTimerRef.current)
      synth.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
      utterance.rate = 1

      const wantedPrefix = language === 'hi' ? 'hi' : 'en'
      const wantedExact = language === 'hi' ? 'hi-IN' : 'en-IN'
      const match =
        voices.find((voice) => voice?.lang?.replace('_', '-') === wantedExact) ??
        voices.find((voice) => voice?.lang?.replace('_', '-').startsWith(wantedPrefix))
      if (match) utterance.voice = match

      utterance.onend = () => {
        if (utteranceRef.current !== utterance) return
        utteranceRef.current = null
        setState('idle')
      }
      utterance.onerror = () => {
        // Expected when we cancel deliberately; still settle the state.
        if (utteranceRef.current !== utterance) return
        utteranceRef.current = null
        setState('idle')
      }
      // Some engines pause long utterances on their own; resume unless the
      // user pressed Pause themselves.
      utterance.onpause = () => {
        if (utteranceRef.current !== utterance) return
        clearTimeout(resumeTimerRef.current)
        resumeTimerRef.current = setTimeout(() => {
          if (utteranceRef.current === utterance && window.speechSynthesis.paused) {
            window.speechSynthesis.resume()
          }
        }, 500)
      }

      utteranceRef.current = utterance
      setState('speaking')
      synth.speak(utterance)
      return true
    },
    [supported, voices],
  )

  const pause = useCallback(() => {
    if (!supported || utteranceRef.current === null) return
    clearTimeout(resumeTimerRef.current)
    window.speechSynthesis.pause()
    setState('paused')
  }, [supported])

  const resume = useCallback(() => {
    if (!supported || utteranceRef.current === null) return
    window.speechSynthesis.resume()
    setState('speaking')
  }, [supported])

  /** True when a locally installed voice matches the language (hint only). */
  const hasVoiceFor = useCallback(
    (language) => {
      if (!voices.length) return true // unknown yet — let the browser try
      const prefix = language === 'hi' ? 'hi' : 'en'
      return voices.some((voice) => voice?.lang?.replace('_', '-')?.startsWith(prefix))
    },
    [voices],
  )

  useEffect(() => () => clearTimeout(resumeTimerRef.current), [])

  return { supported, state, speak, pause, resume, stop, hasVoiceFor }
}
