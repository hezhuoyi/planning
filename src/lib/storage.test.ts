import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get, set } from 'idb-keyval'
import type { Task } from '../domain/types'
import { loadCachedTasks, saveCachedTasks } from './storage'

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}))

const task: Task = {
  id: 'task-1',
  title: 'Cached task',
  startDate: '2026-08-03',
  endDate: null,
  owner: null,
  category: 'growth',
  type: 'range',
  isOngoing: true,
  completedAt: null,
  sortOrder: 10,
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('indexedDB', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('task cache fallback', () => {
  it('persists pending state in a user-scoped cache', async () => {
    const database = new Map<string, unknown>()
    vi.mocked(get).mockImplementation(async (key) => database.get(String(key)))
    vi.mocked(set).mockImplementation(async (key, value) => {
      database.set(String(key), value)
    })
    const snapshot = {
      tasks: [task],
      pendingSync: true,
      claimedBy: null,
      remoteInitialized: false,
    }

    await saveCachedTasks('user-123', snapshot)

    await expect(loadCachedTasks('user-123')).resolves.toEqual(snapshot)
    await expect(loadCachedTasks('user-456')).resolves.toBeNull()
  })

  it('returns no cache when IndexedDB cannot be read', async () => {
    vi.mocked(get).mockRejectedValue(new Error('IndexedDB blocked'))

    await expect(loadCachedTasks(null)).resolves.toBeNull()
  })

  it('treats an IndexedDB write failure as a best-effort cache miss', async () => {
    vi.mocked(set).mockRejectedValue(new Error('IndexedDB unavailable'))

    await expect(
      saveCachedTasks(null, {
        tasks: [task],
        pendingSync: false,
        claimedBy: null,
        remoteInitialized: false,
      }),
    ).resolves.toBeUndefined()
  })
})
