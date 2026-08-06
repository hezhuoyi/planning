import { registerSW } from 'virtual:pwa-register'

const UPDATE_INTERVAL_MS = 60 * 60 * 1000
const ICON_CACHE_PATTERNS = [
  /favicon[^/]*\.(svg|ico)/i,
  /apple-touch-icon[^/]*\.png/i,
  /pwa-\d+[^/]*\.(svg|png)/i,
  /manifest\.webmanifest/i,
]
const ICON_CACHE_NAME_PATTERN = /^planning-icons-v/i

async function clearIconCaches(): Promise<void> {
  if (!('caches' in window)) return
  try {
    const keys = await caches.keys()
    await Promise.all(
      keys.map(async (key) => {
        if (ICON_CACHE_NAME_PATTERN.test(key)) {
          await caches.delete(key)
          return
        }
        const cache = await caches.open(key)
        const requests = await cache.keys()
        await Promise.all(
          requests.map(async (request) => {
            if (ICON_CACHE_PATTERNS.some((pattern) => pattern.test(request.url))) {
              await cache.delete(request)
            }
          }),
        )
      }),
    )
  } catch {
    // Cache cleanup is best-effort; outdated icons should not block the app.
  }
}

export function registerPwaUpdates(): () => void {
  let disposeChecks = () => undefined
  let disposed = false

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void clearIconCaches().finally(() => {
        void updateSW(true)
      })
    },
    onOfflineReady() {
      void clearIconCaches()
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration || disposed) return

      disposeChecks()
      void clearIconCaches()

      const checkForUpdate = () => {
        if (!navigator.onLine) return
        void registration.update().catch(() => undefined)
      }
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          void clearIconCaches()
          checkForUpdate()
        }
      }
      const handleOnline = () => {
        void clearIconCaches()
        checkForUpdate()
      }

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
