import { get, set } from 'idb-keyval'
import type { Task } from '../domain/types'

const LEGACY_TASKS_KEY = 'mainline.tasks.v1'
const TASKS_KEY_PREFIX = 'mainline.tasks.v2'

export interface TaskCacheState {
  tasks: Task[]
  pendingSync: boolean
  claimedBy: string | null
  remoteInitialized: boolean
}

function getTasksKey(userId: string | null): string {
  return userId
    ? `${TASKS_KEY_PREFIX}.user.${encodeURIComponent(userId)}`
    : `${TASKS_KEY_PREFIX}.local`
}

function normalizeCacheState(value: unknown): TaskCacheState | null {
  if (!value || typeof value !== 'object' || !('tasks' in value)) return null
  const state = value as Partial<TaskCacheState>
  if (!Array.isArray(state.tasks)) return null
  return {
    tasks: state.tasks,
    pendingSync: state.pendingSync === true,
    claimedBy: typeof state.claimedBy === 'string' ? state.claimedBy : null,
    remoteInitialized: state.remoteInitialized === true,
  }
}

export async function loadCachedTasks(userId: string | null): Promise<TaskCacheState | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const cached = normalizeCacheState(await get<unknown>(getTasksKey(userId)))
    if (cached || userId) return cached

    const legacyTasks = await get<unknown>(LEGACY_TASKS_KEY)
    if (!Array.isArray(legacyTasks)) return null
    return {
      tasks: legacyTasks as Task[],
      pendingSync: false,
      claimedBy: null,
      remoteInitialized: false,
    }
  } catch {
    return null
  }
}

export async function saveCachedTasks(
  userId: string | null,
  state: TaskCacheState,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    await set(getTasksKey(userId), state)
  } catch {
    // IndexedDB is only a cache; in-memory task changes must remain usable.
  }
}
