import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { seedTasks } from '../data/seedTasks'
import type { Task } from '../domain/types'
import { createSupabase, getSupabaseConfig, rowToTask, taskToRow } from '../lib/supabase'
import { loadCachedTasks, saveCachedTasks, type TaskCacheState } from '../lib/storage'

export type SyncState = 'local' | 'connecting' | 'synced' | 'offline' | 'error'

const REALTIME_REFRESH_DELAY_MS = 50

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder)
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
  const [tasks, setTasks] = useState<Task[]>(seedTasks)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [cacheOwner, setCacheOwner] = useState<string | null | undefined>(undefined)
  const [syncState, setSyncState] = useState<SyncState>(config ? 'connecting' : 'local')
  const [syncError, setSyncError] = useState<string | null>(null)

  const tasksRef = useRef<Task[]>(seedTasks)
  const localRevisionRef = useRef(0)
  const pendingSyncRef = useRef(false)
  const remoteInitializedRef = useRef(false)
  const cacheOwnerRef = useRef<string | null>(null)
  const sessionUserIdRef = useRef<string | null>(null)
  const hydrationTokenRef = useRef(0)
  const refreshInFlightRef = useRef<Promise<void> | null>(null)
  const refreshQueuedRef = useRef(false)
  const performRefreshRef = useRef<() => Promise<void>>(async () => undefined)

  sessionUserIdRef.current = session?.user.id ?? null

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
    if (!supabase) return

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) handleSyncFailure(error)
        else setSession(data.session)
        setAuthReady(true)
      })
      .catch((error: unknown) => {
        handleSyncFailure(error)
        setAuthReady(true)
      })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      sessionUserIdRef.current = nextSession?.user.id ?? null
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [handleSyncFailure, supabase])

  useEffect(() => {
    if (!authReady) return

    const owner = session?.user.id ?? null
    const hydrationToken = hydrationTokenRef.current + 1
    const startingRevision = localRevisionRef.current
    hydrationTokenRef.current = hydrationToken
    cacheOwnerRef.current = owner
    setCacheOwner(undefined)

    void (async () => {
      let cached = await loadCachedTasks(owner)

      if (!owner && cached?.claimedBy) cached = null

      if (!cached && owner) {
        const anonymousCache = await loadCachedTasks(null)
        const canClaimAnonymous =
          anonymousCache &&
          (anonymousCache.claimedBy === null || anonymousCache.claimedBy === owner)
        if (canClaimAnonymous) {
          cached = {
            ...anonymousCache,
            claimedBy: owner,
            remoteInitialized: false,
          }
          await saveCachedTasks(null, { ...anonymousCache, claimedBy: owner })
          await saveCachedTasks(owner, cached)
        }
      }

      if (hydrationTokenRef.current !== hydrationToken) return

      if (localRevisionRef.current === startingRevision) {
        const nextCache = cached ?? createInitialCache(owner)
        tasksRef.current = sortTasks(nextCache.tasks)
        pendingSyncRef.current = nextCache.pendingSync === true
        remoteInitializedRef.current = nextCache.remoteInitialized === true
        localRevisionRef.current += 1
        setTasks(tasksRef.current)
      } else {
        persistCurrent()
      }

      setCacheOwner(owner)
    })()
  }, [authReady, persistCurrent, session?.user.id])

  const performRefresh = useCallback(async () => {
    if (!supabase || !session || cacheOwner !== session.user.id) return
    const userId = session.user.id
    const startingRevision = localRevisionRef.current
    const isCurrent = () =>
      sessionUserIdRef.current === userId &&
      cacheOwnerRef.current === userId &&
      localRevisionRef.current === startingRevision

    setSyncState('connecting')
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
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
            .upsert(localSnapshot.map((task) => taskToRow(task, userId)))
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
            .eq('user_id', userId)
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
          .upsert(localSnapshot.map((task) => taskToRow(task, userId)))
        if (initializeError) {
          handleSyncFailure(initializeError)
          return
        }
        if (!isCurrent()) return
        commitLocal(localSnapshot, { pendingSync: false, remoteInitialized: true })
      } else {
        commitLocal((data ?? []).map(rowToTask), {
          pendingSync: false,
          remoteInitialized: true,
        })
      }

      setSyncError(null)
      setSyncState('synced')
    } catch (error) {
      handleSyncFailure(error)
    }
  }, [cacheOwner, commitLocal, handleSyncFailure, session, supabase])

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
    if (!supabase || !session || cacheOwner !== session.user.id) {
      setSyncState(config ? 'connecting' : 'local')
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

    const channel = supabase
      .channel(`tasks:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${session.user.id}` },
        scheduleRefresh,
      )
      .subscribe()

    const handleOnline = () => void refreshRemote()
    window.addEventListener('online', handleOnline)
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      window.removeEventListener('online', handleOnline)
      void supabase.removeChannel(channel)
    }
  }, [cacheOwner, config, refreshRemote, session, supabase])

  const saveTask = useCallback(
    async (task: Task) => {
      const hadPendingSync = pendingSyncRef.current
      const next = [...tasksRef.current.filter((item) => item.id !== task.id), task]
      commitLocal(next, { pendingSync: true })
      const mutationRevision = localRevisionRef.current
      if (!supabase || !session || cacheOwner !== session.user.id) return

      if (hadPendingSync) {
        await refreshRemote()
        return
      }

      try {
        const { error } = await supabase.from('tasks').upsert(taskToRow(task, session.user.id))
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
    [cacheOwner, commitLocal, handleSyncFailure, refreshRemote, session, supabase],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      const hadPendingSync = pendingSyncRef.current
      commitLocal(tasksRef.current.filter((task) => task.id !== id), { pendingSync: true })
      const mutationRevision = localRevisionRef.current
      if (!supabase || !session || cacheOwner !== session.user.id) return

      if (hadPendingSync) {
        await refreshRemote()
        return
      }

      try {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', id)
          .eq('user_id', session.user.id)
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
    [cacheOwner, commitLocal, handleSyncFailure, refreshRemote, session, supabase],
  )

  const importTasks = useCallback(
    async (incoming: Task[]) => {
      commitLocal(incoming, { pendingSync: true })
      if (supabase && session && cacheOwner === session.user.id) await refreshRemote()
    },
    [cacheOwner, commitLocal, refreshRemote, session, supabase],
  )

  const sendMagicLink = useCallback(
    async (email: string) => {
      if (!supabase) throw new Error('请先配置 Supabase')
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    sessionUserIdRef.current = null
    setSession(null)
    setSyncError(null)
    setSyncState(config ? 'connecting' : 'local')
  }, [config, supabase])

  return {
    tasks,
    saveTask,
    deleteTask,
    importTasks,
    session,
    syncState,
    syncError,
    isConfigured: Boolean(config),
    sendMagicLink,
    signOut,
    refreshRemote,
  }
}
