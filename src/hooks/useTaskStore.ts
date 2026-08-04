import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { seedTasks } from '../data/seedTasks'
import { migrateTaskOwners } from '../domain/owners'
import { sortTasksForDisplay } from '../domain/taskSort'
import type { Task } from '../domain/types'
import {
  createSupabase,
  FAMILY_USER_ID,
  getSupabaseConfig,
  isFamilyUnlocked,
  rowToTask,
  setFamilyUnlocked,
  taskToRow,
  verifyFamilyPasscode,
} from '../lib/supabase'
import { loadCachedTasks, saveCachedTasks, type TaskCacheState } from '../lib/storage'

export type SyncState = 'local' | 'connecting' | 'synced' | 'offline' | 'error'

const REALTIME_REFRESH_DELAY_MS = 50

function sortTasks(tasks: Task[]): Task[] {
  return sortTasksForDisplay(tasks)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message)
  }
  return '同步失败'
}

function createInitialCache(userId: string | null): TaskCacheState {
  return {
    tasks: seedTasks,
    pendingSync: false,
    claimedBy: userId,
    remoteInitialized: false,
  }
}

export function useTaskStore() {
  const config = useMemo(() => getSupabaseConfig(), [])
  const supabase = useMemo(() => createSupabase(config), [config])
  const initiallyUnlocked = Boolean(config) && isFamilyUnlocked()
  const [tasks, setTasks] = useState<Task[]>([])
  const [unlocked, setUnlocked] = useState(() => initiallyUnlocked)
  const [cacheOwner, setCacheOwner] = useState<string | null | undefined>(undefined)
  const [syncState, setSyncState] = useState<SyncState>(
    initiallyUnlocked ? 'connecting' : 'local',
  )
  const [syncError, setSyncError] = useState<string | null>(null)

  const tasksRef = useRef<Task[]>([])
  const localRevisionRef = useRef(0)
  const pendingSyncRef = useRef(false)
  const remoteInitializedRef = useRef(false)
  const cacheOwnerRef = useRef<string | null>(null)
  const unlockedRef = useRef(unlocked)
  const hydrationTokenRef = useRef(0)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)
  const refreshQueuedRef = useRef(false)
  const performRefreshRef = useRef<() => Promise<void>>(async () => undefined)

  unlockedRef.current = unlocked
  const syncActive = Boolean(supabase && unlocked)

  const persistCurrent = useCallback(() => {
    const owner = cacheOwnerRef.current
    const snapshot: TaskCacheState = {
      tasks: tasksRef.current,
      pendingSync: pendingSyncRef.current,
      claimedBy: owner,
      remoteInitialized: remoteInitializedRef.current,
    }
    void saveCachedTasks(owner, snapshot)
  }, [])

  const commitLocal = useCallback(
    (
      next: Task[],
      options: { pendingSync?: boolean; remoteInitialized?: boolean } = {},
    ) => {
      const sorted = sortTasks(next)
      tasksRef.current = sorted
      localRevisionRef.current += 1
      pendingSyncRef.current = options.pendingSync ?? pendingSyncRef.current
      remoteInitializedRef.current =
        options.remoteInitialized ?? remoteInitializedRef.current
      setTasks(sorted)
      persistCurrent()
      return sorted
    },
    [persistCurrent],
  )

  const handleSyncFailure = useCallback((error: unknown) => {
    setSyncState(navigator.onLine ? 'error' : 'offline')
    setSyncError(getErrorMessage(error))
  }, [])

  useEffect(() => {
    const owner = syncActive ? FAMILY_USER_ID : null
    const hydrationToken = hydrationTokenRef.current + 1
    const startingRevision = localRevisionRef.current
    hydrationTokenRef.current = hydrationToken
    cacheOwnerRef.current = owner
    setCacheOwner(undefined)

    void (async () => {
      let cached = await loadCachedTasks(owner)

      if (!owner && cached?.claimedBy) cached = null

      if (!cached && owner) {
        const localCache = await loadCachedTasks(null)
        const canClaimLocal =
          localCache &&
          (localCache.claimedBy === null || localCache.claimedBy === owner)
        if (canClaimLocal) {
          cached = {
            ...localCache,
            claimedBy: owner,
            remoteInitialized: false,
          }
          await saveCachedTasks(null, { ...localCache, claimedBy: owner })
          await saveCachedTasks(owner, cached)
        }
      }

      if (hydrationTokenRef.current !== hydrationToken) return

      if (localRevisionRef.current === startingRevision) {
        // 未解锁：不展示本地/示例数据，避免没输口令也能看到计划。
        if (!owner) {
          tasksRef.current = []
          pendingSyncRef.current = false
          remoteInitializedRef.current = false
          localRevisionRef.current += 1
          setTasks([])
        } else {
          const nextCache = cached ?? createInitialCache(owner)
          const migrated = migrateTaskOwners(nextCache.tasks)
          const ownersChanged = migrated !== nextCache.tasks
          tasksRef.current = sortTasks(migrated)
          pendingSyncRef.current = nextCache.pendingSync === true || ownersChanged
          remoteInitializedRef.current = nextCache.remoteInitialized === true
          localRevisionRef.current += 1
          setTasks(tasksRef.current)
          if (ownersChanged || !cached) persistCurrent()
        }
      } else {
        persistCurrent()
      }

      setCacheOwner(owner)
    })()
  }, [persistCurrent, syncActive])

  const performRefresh = useCallback(async () => {
    if (!supabase || !unlockedRef.current || cacheOwner !== FAMILY_USER_ID) return
    const startingRevision = localRevisionRef.current
    const isCurrent = () =>
      unlockedRef.current &&
      cacheOwnerRef.current === FAMILY_USER_ID &&
      localRevisionRef.current === startingRevision

    setSyncState((current) => (current === 'synced' ? 'synced' : 'connecting'))
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', FAMILY_USER_ID)
        .order('sort_order')
      if (error) {
        handleSyncFailure(error)
        return
      }
      if (!isCurrent()) return

      const localSnapshot = tasksRef.current
      if (pendingSyncRef.current) {
        if (localSnapshot.length) {
          const { error: upsertError } = await supabase
            .from('tasks')
            .upsert(localSnapshot.map((task) => taskToRow(task)))
          if (upsertError) {
            handleSyncFailure(upsertError)
            return
          }
          if (!isCurrent()) return
        }

        const localIds = new Set(localSnapshot.map((task) => task.id))
        const staleIds = (data ?? [])
          .map((row) => row.id as string)
          .filter((id) => !localIds.has(id))
        if (staleIds.length) {
          const { error: deleteError } = await supabase
            .from('tasks')
            .delete()
            .eq('user_id', FAMILY_USER_ID)
            .in('id', staleIds)
          if (deleteError) {
            handleSyncFailure(deleteError)
            return
          }
          if (!isCurrent()) return
        }

        commitLocal(localSnapshot, { pendingSync: false, remoteInitialized: true })
      } else if (!data?.length && !remoteInitializedRef.current && localSnapshot.length) {
        const { error: initializeError } = await supabase
          .from('tasks')
          .upsert(localSnapshot.map((task) => taskToRow(task)))
        if (initializeError) {
          handleSyncFailure(initializeError)
          return
        }
        if (!isCurrent()) return
        commitLocal(localSnapshot, { pendingSync: false, remoteInitialized: true })
      } else {
        const remoteTasks = migrateTaskOwners((data ?? []).map(rowToTask))
        const ownersChanged = remoteTasks.some((task, index) => {
          const original = data?.[index]
          return original && task.owner !== original.owner
        })
        commitLocal(remoteTasks, {
          pendingSync: ownersChanged,
          remoteInitialized: true,
        })
        if (ownersChanged && remoteTasks.length) {
          const { error: migrateError } = await supabase
            .from('tasks')
            .upsert(remoteTasks.map((task) => taskToRow(task)))
          if (migrateError) {
            handleSyncFailure(migrateError)
            return
          }
          if (!isCurrent()) return
          commitLocal(remoteTasks, { pendingSync: false, remoteInitialized: true })
        }
      }

      setSyncError(null)
      setSyncState('synced')
    } catch (error) {
      handleSyncFailure(error)
    }
  }, [cacheOwner, commitLocal, handleSyncFailure, supabase])

  performRefreshRef.current = performRefresh

  const refreshRemote = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true
      return refreshInFlightRef.current
    }

    const run = async () => {
      do {
        refreshQueuedRef.current = false
        await performRefreshRef.current()
      } while (refreshQueuedRef.current)
    }
    const tracked = run().finally(() => {
      if (refreshInFlightRef.current === tracked) refreshInFlightRef.current = null
    })
    refreshInFlightRef.current = tracked
    return tracked
  }, [])

  useEffect(() => {
    if (!syncActive || cacheOwner !== FAMILY_USER_ID) {
      setSyncState(config ? (unlocked ? 'connecting' : 'local') : 'local')
      return
    }
    void refreshRemote()

    let refreshTimer: number | null = null
    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        void refreshRemote()
      }, REALTIME_REFRESH_DELAY_MS)
    }

    const channel = supabase!
      .channel(`tasks:${FAMILY_USER_ID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${FAMILY_USER_ID}`,
        },
        scheduleRefresh,
      )
      .subscribe()

    const handleOnline = () => void refreshRemote()
    window.addEventListener('online', handleOnline)
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      window.removeEventListener('online', handleOnline)
      void supabase!.removeChannel(channel)
    }
  }, [cacheOwner, config, refreshRemote, supabase, syncActive, unlocked])

  const saveTask = useCallback(
    async (task: Task) => {
      const hadPendingSync = pendingSyncRef.current
      const next = [...tasksRef.current.filter((item) => item.id !== task.id), task]
      commitLocal(next, { pendingSync: true })
      const mutationRevision = localRevisionRef.current
      if (!supabase || !unlockedRef.current || cacheOwner !== FAMILY_USER_ID) return

      if (hadPendingSync) {
        await refreshRemote()
        return
      }

      try {
        const { error } = await supabase.from('tasks').upsert(taskToRow(task))
        if (error) {
          handleSyncFailure(error)
          return
        }
        if (localRevisionRef.current !== mutationRevision) {
          await refreshRemote()
          return
        }
        commitLocal(tasksRef.current, { pendingSync: false, remoteInitialized: true })
        setSyncState('synced')
        setSyncError(null)
      } catch (error) {
        handleSyncFailure(error)
      }
    },
    [cacheOwner, commitLocal, handleSyncFailure, refreshRemote, supabase],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      const hadPendingSync = pendingSyncRef.current
      commitLocal(tasksRef.current.filter((task) => task.id !== id), { pendingSync: true })
      const mutationRevision = localRevisionRef.current
      if (!supabase || !unlockedRef.current || cacheOwner !== FAMILY_USER_ID) return

      if (hadPendingSync) {
        await refreshRemote()
        return
      }

      try {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', id)
          .eq('user_id', FAMILY_USER_ID)
        if (error) {
          handleSyncFailure(error)
          return
        }
        if (localRevisionRef.current !== mutationRevision) {
          await refreshRemote()
          return
        }
        commitLocal(tasksRef.current, { pendingSync: false, remoteInitialized: true })
        setSyncState('synced')
        setSyncError(null)
      } catch (error) {
        handleSyncFailure(error)
      }
    },
    [cacheOwner, commitLocal, handleSyncFailure, refreshRemote, supabase],
  )

  const importTasks = useCallback(
    async (incoming: Task[]) => {
      commitLocal(incoming, { pendingSync: true })
      if (supabase && unlockedRef.current && cacheOwner === FAMILY_USER_ID) {
        await refreshRemote()
      }
    },
    [cacheOwner, commitLocal, refreshRemote, supabase],
  )

  const unlockWithPasscode = useCallback((passcode: string) => {
    if (!verifyFamilyPasscode(passcode)) {
      throw new Error('口令不正确')
    }
    setFamilyUnlocked(true)
    setUnlocked(true)
    setSyncError(null)
    setSyncState('connecting')
  }, [])

  const lockSync = useCallback(() => {
    setFamilyUnlocked(false)
    setUnlocked(false)
    setSyncError(null)
    setSyncState('local')
    tasksRef.current = []
    pendingSyncRef.current = false
    remoteInitializedRef.current = false
    localRevisionRef.current += 1
    setTasks([])
  }, [])

  return {
    tasks,
    saveTask,
    deleteTask,
    importTasks,
    unlocked,
    syncState,
    syncError,
    isConfigured: Boolean(config),
    unlockWithPasscode,
    lockSync,
    refreshRemote,
  }
}
