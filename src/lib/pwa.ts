import { registerSW } from 'virtual:pwa-register'

const UPDATE_INTERVAL_MS = 60 * 60 * 1000

export function registerPwaUpdates(): () => void {
  let disposeChecks = () => undefined
  let disposed = false

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration || disposed) return

      disposeChecks()

      const checkForUpdate = () => {
        if (!navigator.onLine) return
        void registration.update().catch(() => undefined)
      }
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      }
      const handleOnline = () => checkForUpdate()

      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('online', handleOnline)
      const intervalId = window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS)

      disposeChecks = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('online', handleOnline)
        window.clearInterval(intervalId)
      }

      checkForUpdate()
    },
  })

  return () => {
    disposed = true
    disposeChecks()
  }
}
