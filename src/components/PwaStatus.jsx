import { useRegisterSW } from 'virtual:pwa-register/react'

const OFFLINE_READY_KEY = 'mausam.pwa.offlineReadyDismissed.v1'

function alreadyDismissedOfflineReady() {
  try {
    return window.localStorage.getItem(OFFLINE_READY_KEY) === '1'
  } catch {
    return false
  }
}

function dismissOfflineReady() {
  try {
    window.localStorage.setItem(OFFLINE_READY_KEY, '1')
  } catch {
    /* storage unavailable — banner will simply reappear next session */
  }
}

/**
 * Service-worker status UI (Member 3).
 *
 * Uses vite-plugin-pwa's single managed worker (`virtual:pwa-register/react`):
 * - "offline ready" notice once the app shell is cached (dismissable),
 * - "update available" prompt (registerType: 'prompt') with an explicit
 *   Reload action — updates are never silently swapped mid-session.
 *
 * Banners render in production builds only; development never registers a
 * service worker (vite-plugin-pwa devOptions are disabled).
 */
export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onOfflineReady() {
      if (alreadyDismissedOfflineReady()) setOfflineReady(false)
    },
  })

  if (!import.meta.env.PROD) return null
  if (!offlineReady && !needRefresh) return null

  if (needRefresh) {
    return (
      <div className="pwa-banner pwa-banner--update" role="status" aria-live="polite">
        <span className="badge badge--primary">App update</span>
        <span className="pwa-banner__text">
          A new version of the app has downloaded and is ready. Reload to switch to it.
        </span>
        <span className="pwa-banner__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => updateServiceWorker(true)}
            aria-label="Reload to update the application"
          >
            Reload
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setNeedRefresh(false)}
            aria-label="Dismiss update notice"
          >
            Later
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="pwa-banner" role="status" aria-live="polite">
      <span className="badge badge--success">Offline ready</span>
      <span className="pwa-banner__text">
        The app shell is cached for offline use. Live weather still needs a connection (or shows Member 1's
        clearly-labelled saved forecast).
      </span>
      <span className="pwa-banner__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            dismissOfflineReady()
            setOfflineReady(false)
          }}
          aria-label="Dismiss offline ready notice"
        >
          Got it
        </button>
      </span>
    </div>
  )
}

export default PwaStatus
