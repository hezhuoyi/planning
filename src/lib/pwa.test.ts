// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerPwaUpdates } from './pwa'

const { registerSWMock } = vi.hoisted(() => ({
  registerSWMock: vi.fn(),
}))

vi.mock('virtual:pwa-register', () => ({
  registerSW: registerSWMock,
}))

interface RegisterOptions {
  immediate?: boolean
  onNeedRefresh?: () => void
  onOfflineReady?: () => void
  onRegisteredSW?: (
    swUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
}

function setVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  })
}

describe('registerPwaUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    registerSWMock.mockReset()
    setOnline(true)
    setVisibility('visible')
    vi.stubGlobal('caches', {
      keys: vi.fn(async () => ['workbox-precache']),
      open: vi.fn(async () => ({
        keys: vi.fn(async () => [
          { url: 'https://example.com/planning/favicon.svg' },
          { url: 'https://example.com/planning/assets/app.js' },
        ]),
        delete: vi.fn(async () => true),
      })),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('checks immediately, on foreground, online recovery, and every hour', () => {
    const update = vi.fn().mockResolvedValue(undefined)
    registerSWMock.mockImplementation((options: RegisterOptions) => {
      options.onRegisteredSW?.(
        '/planning/sw.js',
        { update } as unknown as ServiceWorkerRegistration,
      )
      return vi.fn()
    })

    const dispose = registerPwaUpdates()

    expect(registerSWMock).toHaveBeenCalledWith(
      expect.objectContaining({ immediate: true }),
    )
    expect(update).toHaveBeenCalledTimes(1)

    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).toHaveBeenCalledTimes(1)

    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).toHaveBeenCalledTimes(2)

    setOnline(false)
    window.dispatchEvent(new Event('online'))
    expect(update).toHaveBeenCalledTimes(2)

    setOnline(true)
    window.dispatchEvent(new Event('online'))
    expect(update).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(update).toHaveBeenCalledTimes(4)

    dispose()
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(update).toHaveBeenCalledTimes(4)
  })

  it('clears icon caches and applies waiting service worker on refresh', async () => {
    const applyUpdate = vi.fn()
    const deleteEntry = vi.fn(async () => true)
    vi.stubGlobal('caches', {
      keys: vi.fn(async () => ['workbox-precache']),
      open: vi.fn(async () => ({
        keys: vi.fn(async () => [
          { url: 'https://example.com/planning/pwa-192x192.svg?v=1' },
          { url: 'https://example.com/planning/assets/app.js' },
        ]),
        delete: deleteEntry,
      })),
    })

    let options: RegisterOptions | undefined
    registerSWMock.mockImplementation((next: RegisterOptions) => {
      options = next
      return applyUpdate
    })

    registerPwaUpdates()
    options?.onNeedRefresh?.()

    await vi.waitFor(() => {
      expect(deleteEntry).toHaveBeenCalledWith({
        url: 'https://example.com/planning/pwa-192x192.svg?v=1',
      })
      expect(applyUpdate).toHaveBeenCalledWith(true)
    })
  })
})
