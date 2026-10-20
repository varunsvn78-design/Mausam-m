import { useCallback, useEffect, useState } from 'react'

const INSTALL_DISMISSED_KEY = 'mausam.pwa.installDismissed.v1'
const INSTALL_INSTALLED_KEY = 'mausam.pwa.installed.v1'

function readFlag(key) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    /* storage unavailable — the prompt just reappears next session */
  }
}

/**
 * Progressive install prompt (Phase 4).
 *
 * Captures the browser's `beforeinstallprompt` event so the user can install
 * MAUSAM to their home screen / desktop. The prompt is only offered when the
 * browser actually fired the event (i.e. the app is installable) — we never
 * claim installability we cannot deliver, and we never auto-prompt. Dismissal
 * and successful installs are remembered in localStorage.
 *
 * The banner is suppressed entirely inside an already-installed display mode
 * (standalone / minimal-ui).
 */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null)
  const [isInstalled, setIsInstalled] = useState(() => isStandalone())
  const [dismissed, setDismissed] = useState(() => readFlag(INSTALL_DISMISSED_KEY))

  useEffect(() => {
    const onBeforeInstall = (event) => {
      // Stop the browser's own mini-infobar so we control the moment.
      event.preventDefault()
      setDeferredEvent(event)
    }
    const onInstalled = () => {
      writeFlag(INSTALL_INSTALLED_KEY)
      setIsInstalled(true)
      setDeferredEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return { ok: false, outcome: 'unavailable' }
    try {
      deferredEvent.prompt()
      const choice = await deferredEvent.userChoice
      setDeferredEvent(null)
      if (choice?.outcome === 'dismissed') {
        writeFlag(INSTALL_DISMISSED_KEY)
        setDismissed(true)
      }
      return { ok: choice?.outcome === 'accepted', outcome: choice?.outcome ?? 'unknown' }
    } catch {
      return { ok: false, outcome: 'error' }
    }
  }, [deferredEvent])

  const dismissInstall = useCallback(() => {
    writeFlag(INSTALL_DISMISSED_KEY)
    setDismissed(true)
  }, [])

  return {
    canInstall: Boolean(deferredEvent) && !isInstalled && !dismissed,
    promptInstall,
    dismissInstall,
  }
}

function isStandalone() {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
    // iOS Safari reports installed PWAs via navigator.standalone.
    return window.navigator.standalone === true
  } catch {
    return false
  }
}

export default useInstallPrompt
