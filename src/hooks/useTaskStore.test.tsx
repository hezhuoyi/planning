// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../domain/types'
import { useTaskStore } from './useTaskStore'

const mocks = vi.hoisted(() => ({
  createSupabase: vi.fn(),
  loadCachedTasks: vi.fn(),
  saveCachedTasks: vi.fn(),
}))

vi.mock('../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/supabase')>()
  return {
    ...actual,
    createSupabase: mocks.createSupabase,
    getSupabaseConfig: () => ({ url: 'https://example.supabase.co', anonKey: 'anon-key' }),
  }
})

vi.mock('../lib/storage', () => ({
  loadCachedTasks: mocks.loadCachedTasks,
  saveCachedTasks: mocks.saveCachedTasks,
}))

type Operation = {
  kind: 'select' | 'upsert' | 'delete'
  filters: Array<[string, unknown]>
  payload?: unknown
}

const remoteRow = {
  id: 'remote-task',
  user_id: 'user-123',
  title: 'Remote task',
  start_date: '2026-08-03',
  end_date: null,
  owner: null,
  category: 'growth' as const,
  task_type: 'range' as const,
  is_ongoing: true,
  completed_at: null,
  sort_order: 10,
  created_at: '2026-08-03T00:00:00.000Z',
  updated_at: '2026-08-03T00:00:00.000Z',
}

const localTask: Task = {
  id: 'local-task',
  title: 'Local task',
  startDate: '2026-08-04',
  endDate: null,
  owner: null,
  category: 'career',
  type: 'range',
  isOngoing: true,
  completedAt: null,
  sortOrder: 20,
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
}

const secondLocalTask: Task = {
  ...localTask,
  id: 'second-local-task',
  title: 'Second local task',
  sortOrder: 30,
}

function createFakeSupabase(
  options: { rejectUpsert?: boolean; remoteRows?: Array<typeof remoteRow> } = {},
) {
  const operations: Operation[] = []
  let realtimeCallback: (() => void) | null = null
  let realtimeFilter: Record<string, string> | null = null
  let authStateCallback:
    | ((_event: string, nextSession: { user: { id: string } } | null) => void)
    | null = null
  let rejectUpsert = options.rejectUpsert ?? false
  let remoteRows = options.remoteRows ?? [remoteRow]
  let deferNextSelect = false
  let deferNextUpsert = false
  let resolveDeferredSelect: (() => void) | null = null
  let resolveDeferredUpsert: (() => void) | null = null

  const applyUpsert = (payload: unknown) => {
    const rows = (Array.isArray(payload) ? payload : [payload]) as Array<typeof remoteRow>
    for (const row of rows) {
      remoteRows = [...remoteRows.filter(({ id }) => id !== row.id), row]
    }
  }

  const createBuilder = (operation: Operation, deferred = false) => {
    const queryResult = { data: remoteRows, error: null }
    const queryPromise = deferred
      ? new Promise<typeof queryResult>((resolve) => {
          resolveDeferredSelect = () => resolve(queryResult)
        })
      : Promise.resolve(queryResult)
    const builder = queryPromise as Promise<typeof queryResult> & {
      eq: (column: string, value: string) => typeof builder
      in: (column: string, values: string[]) => typeof builder
      order: (column: string) => typeof builder
    }
    builder.eq = (column, value) => {
      operation.filters.push([column, value])
      return builder
    }
    builder.in = (column, values) => {
      operation.filters.push([column, values])
      return builder
    }
    builder.order = () => builder
    return builder
  }

  const channel = {
    on: (
      _event: string,
      filter: Record<string, string>,
      callback: () => void,
    ) => {
      realtimeFilter = filter
      realtimeCallback = callback
      return channel
    },
    subscribe: () => channel,
  }

  const client = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: 'user-123' } } },
          error: null,
        }),
      onAuthStateChange: (
        callback: (_event: string, nextSession: { user: { id: string } } | null) => void,
      ) => {
        authStateCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
    from: () => ({
      select: () => {
        const operation: Operation = { kind: 'select', filters: [] }
        operations.push(operation)
        const deferred = deferNextSelect
        deferNextSelect = false
        return createBuilder(operation, deferred)
      },
      upsert: (payload: unknown) => {
        operations.push({ kind: 'upsert', filters: [], payload })
        if (rejectUpsert) return Promise.reject(new Error('Network unavailable'))
        if (deferNextUpsert) {
          deferNextUpsert = false
          return new Promise<{ data: null; error: null }>((resolve) => {
            resolveDeferredUpsert = () => {
              applyUpsert(payload)
              resolve({ data: null, error: null })
            }
          })
        }
        applyUpsert(payload)
        return Promise.resolve({ data: null, error: null })
      },
      delete: () => {
        const operation: Operation = { kind: 'delete', filters: [] }
        operations.push(operation)
        return createBuilder(operation)
      },
    }),
    channel: () => channel,
    removeChannel: vi.fn(),
  }

  return {
    client,
    operations,
    getRealtimeCallback: () => realtimeCallback,
    getRealtimeFilter: () => realtimeFilter,
    setRejectUpsert: (next: boolean) => {
      rejectUpsert = next
    },
    setRemoteRows: (next: Array<typeof remoteRow>) => {
      remoteRows = next
    },
    deferOneSelect: () => {
      deferNextSelect = true
    },
    resolveDeferredSelect: () => {
      resolveDeferredSelect?.()
      resolveDeferredSelect = null
    },
    deferOneUpsert: () => {
      deferNextUpsert = true
    },
    resolveDeferredUpsert: () => {
      resolveDeferredUpsert?.()
      resolveDeferredUpsert = null
    },
    triggerAuth: (userId: string | null) => {
      authStateCallback?.(
        userId ? 'SIGNED_IN' : 'SIGNED_OUT',
        userId ? { user: { id: userId } } : null,
      )
    },
  }
}

beforeEach(() => {
  mocks.loadCachedTasks.mockResolvedValue(null)
  mocks.saveCachedTasks.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('useTaskStore cloud synchronization', () => {
  it('scopes remote reads and deletes to the authenticated user', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })

    expect(fake.operations[0]?.filters).toEqual([['user_id', 'user-123']])

    await act(async () => {
      await result.current.deleteTask('remote-task')
    })

    expect(fake.operations.find(({ kind }) => kind === 'delete')?.filters).toEqual([
      ['id', 'remote-task'],
      ['user_id', 'user-123'],
    ])
    expect(fake.getRealtimeFilter()).toMatchObject({ filter: 'user_id=eq.user-123' })
  })

  it('binds saves and imports to the authenticated user', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })

    await act(async () => {
      await result.current.saveTask(localTask)
      await result.current.importTasks([localTask])
    })

    const payloads = fake.operations
      .filter(({ kind }) => kind === 'upsert')
      .map(({ payload }) => payload)

    expect(payloads).toEqual([
      expect.objectContaining({ id: 'local-task', user_id: 'user-123' }),
      [expect.objectContaining({ id: 'local-task', user_id: 'user-123' })],
    ])
  })

  it('coalesces a burst of realtime events into one remote refresh', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })
    vi.useFakeTimers()

    act(() => {
      fake.getRealtimeCallback()?.()
      fake.getRealtimeCallback()?.()
    })

    expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(2)
  })

  it('keeps a local save usable when the remote request rejects', async () => {
    const fake = createFakeSupabase({ rejectUpsert: true })
    mocks.createSupabase.mockReturnValue(fake.client)
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })

    await act(async () => {
      await result.current.saveTask(localTask)
    })

    expect(result.current.tasks).toContainEqual(localTask)
    expect(result.current.syncState).toBe('offline')
    expect(result.current.syncError).toBe('Network unavailable')
  })

  it('uploads the cached local plan when the first remote snapshot is empty', async () => {
    const fake = createFakeSupabase({ remoteRows: [] })
    mocks.createSupabase.mockReturnValue(fake.client)
    mocks.loadCachedTasks.mockResolvedValue({
      tasks: [localTask],
      pendingSync: false,
      claimedBy: null,
    })
    renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.some(({ kind }) => kind === 'upsert')).toBe(true)
    })

    expect(fake.operations.find(({ kind }) => kind === 'upsert')?.payload).toEqual([
      expect.objectContaining({ id: 'local-task', user_id: 'user-123' }),
    ])
  })

  it('does not revive seed tasks after the last task is deleted', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(result.current.tasks).toEqual([
        expect.objectContaining({ id: 'remote-task' }),
      ])
    })

    await act(async () => {
      await result.current.deleteTask('remote-task')
    })
    fake.setRemoteRows([])

    await act(async () => {
      await result.current.refreshRemote()
    })

    expect(result.current.tasks).toEqual([])
    expect(
      fake.operations.filter(({ kind }) => kind === 'upsert'),
    ).toHaveLength(0)
  })

  it('pushes pending local changes before reading remote state after reconnect', async () => {
    const fake = createFakeSupabase({ rejectUpsert: true })
    mocks.createSupabase.mockReturnValue(fake.client)
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })

    await act(async () => {
      await result.current.saveTask(localTask)
    })
    fake.setRejectUpsert(false)

    await act(async () => {
      await result.current.refreshRemote()
    })

    expect(result.current.tasks).toContainEqual(localTask)
    expect(fake.operations.at(-1)?.kind).toBe('upsert')
    expect(fake.operations.at(-1)?.payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'local-task', user_id: 'user-123' }),
      ]),
    )
  })

  it('imports as a complete remote replacement', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })

    await act(async () => {
      await result.current.importTasks([localTask])
    })

    expect(fake.operations.find(({ kind }) => kind === 'delete')?.filters).toEqual([
      ['user_id', 'user-123'],
      ['id', ['remote-task']],
    ])
  })

  it('does not let an older remote refresh overwrite a newer local save', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })
    fake.deferOneSelect()

    let refreshPromise: Promise<void> | undefined
    act(() => {
      refreshPromise = result.current.refreshRemote()
    })
    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(2)
    })

    await act(async () => {
      await result.current.saveTask(localTask)
    })
    fake.resolveDeferredSelect()
    await act(async () => {
      await refreshPromise
    })

    expect(result.current.tasks).toContainEqual(localTask)
  })

  it('restores persisted pending changes before accepting a remote snapshot', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    mocks.loadCachedTasks.mockResolvedValue({
      tasks: [localTask],
      pendingSync: true,
      claimedBy: 'user-123',
    })
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.some(({ kind }) => kind === 'upsert')).toBe(true)
    })

    expect(result.current.tasks).toEqual([localTask])
    expect(fake.operations.find(({ kind }) => kind === 'upsert')?.payload).toEqual([
      expect.objectContaining({ id: 'local-task', user_id: 'user-123' }),
    ])
  })

  it('does not overwrite an edit made while cache hydration is pending', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    let resolveCache: ((value: unknown) => void) | null = null
    mocks.loadCachedTasks.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCache = resolve
        }),
    )
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(result.current.session?.user.id).toBe('user-123')
    })
    await act(async () => {
      await result.current.saveTask(localTask)
    })

    act(() => {
      resolveCache?.({ tasks: [], pendingSync: false, claimedBy: 'user-123' })
    })

    await waitFor(() => {
      expect(result.current.tasks).toContainEqual(localTask)
    })
  })

  it('does not clear a newer pending save when an older write finishes', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })
    fake.deferOneUpsert()

    let firstSave: Promise<void> | undefined
    act(() => {
      firstSave = result.current.saveTask(localTask)
    })
    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'upsert')).toHaveLength(1)
    })
    fake.deferOneSelect()

    let secondSave: Promise<void> | undefined
    act(() => {
      secondSave = result.current.saveTask(secondLocalTask)
    })
    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(2)
    })

    fake.resolveDeferredUpsert()
    fake.resolveDeferredSelect()
    await act(async () => {
      await Promise.all([firstSave, secondSave])
    })

    expect(result.current.tasks).toEqual(
      expect.arrayContaining([localTask, secondLocalTask]),
    )
    expect(
      fake.operations
        .filter(({ kind }) => kind === 'upsert')
        .some(
          ({ payload }) =>
            Array.isArray(payload) &&
            payload.some((row) => (row as { id?: string }).id === 'second-local-task'),
        ),
    ).toBe(true)
  })

  it('serializes overlapping remote refreshes and performs one queued refresh', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })
    fake.deferOneSelect()

    let firstRefresh: Promise<void> | undefined
    let secondRefresh: Promise<void> | undefined
    act(() => {
      firstRefresh = result.current.refreshRemote()
      secondRefresh = result.current.refreshRemote()
    })

    expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(2)
    fake.resolveDeferredSelect()
    await act(async () => {
      await Promise.all([firstRefresh, secondRefresh])
    })

    expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(3)
  })

  it('does not upload an anonymous cache already claimed by another user', async () => {
    const fake = createFakeSupabase({ remoteRows: [] })
    mocks.createSupabase.mockReturnValue(fake.client)
    mocks.loadCachedTasks.mockImplementation(async (userId: string | null) => {
      if (userId) return null
      return { tasks: [localTask], pendingSync: false, claimedBy: 'user-A' }
    })
    renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(fake.operations.filter(({ kind }) => kind === 'select')).toHaveLength(1)
    })

    const uploadedIds = fake.operations
      .filter(({ kind }) => kind === 'upsert')
      .flatMap(({ payload }) => (Array.isArray(payload) ? payload : [payload]))
      .map((row) => (row as { id?: string } | undefined)?.id)
    expect(uploadedIds).not.toContain('local-task')
  })

  it('does not expose a claimed user cache after sign out', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    mocks.loadCachedTasks.mockImplementation(async (userId: string | null) => {
      if (userId) return null
      return {
        tasks: [localTask],
        pendingSync: false,
        claimedBy: 'user-123',
        remoteInitialized: false,
      }
    })
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(result.current.tasks).toContainEqual(
        expect.objectContaining({ id: 'remote-task' }),
      )
    })
    act(() => fake.triggerAuth(null))

    await waitFor(() => {
      expect(result.current.session).toBeNull()
      expect(result.current.tasks).toContainEqual(
        expect.objectContaining({ id: 'weight-aug-2026' }),
      )
      expect(result.current.tasks).not.toContainEqual(localTask)
    })
  })

  it('keeps both tasks when saves happen back to back', async () => {
    const fake = createFakeSupabase()
    mocks.createSupabase.mockReturnValue(fake.client)
    const { result } = renderHook(() => useTaskStore())

    await waitFor(() => {
      expect(result.current.tasks).toEqual([
        expect.objectContaining({ id: 'remote-task' }),
      ])
    })
    const save = result.current.saveTask
    const secondTask = { ...localTask, id: 'local-task-2', title: 'Second local task' }

    await act(async () => {
      await Promise.all([save(localTask), save(secondTask)])
    })

    expect(result.current.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'local-task' }),
        expect.objectContaining({ id: 'local-task-2' }),
      ]),
    )
  })
})
