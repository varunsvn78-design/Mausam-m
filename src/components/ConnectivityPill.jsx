/**
 * Online/offline status pill (Member 3). Uses Member 1's useOnlineStatus hook.
 * Rendered in the app header where it is visible on every screen.
 */
export function ConnectivityPill({ isOnline }) {
  return (
    <span
      className={`connectivity-pill${isOnline ? '' : ' connectivity-pill--offline'}`}
      role="status"
      aria-live="polite"
    >
      <span className="connectivity-pill__dot" aria-hidden="true" />
      {isOnline ? 'Online' : 'Offline'}
    </span>
  )
}

export default ConnectivityPill
