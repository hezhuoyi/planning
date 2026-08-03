import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Task, TaskCategory, TaskType } from '../domain/types'

const CONFIG_KEY = 'mainline.supabase.config.v1'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

interface TaskRow {
  id: string
  user_id: string
  title: string
  start_date: string
  end_date: string | null
  owner: string | null
  category: TaskCategory
  task_type: TaskType
  is_ongoing: boolean
  completed_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (envUrl && envKey) return { url: envUrl, anonKey: envKey }

  if (typeof localStorage === 'undefined') return null
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null') as SupabaseConfig | null
    return stored?.url && stored?.anonKey ? stored : null
  } catch {
    return null
  }
}

export function storeSupabaseConfig(config: SupabaseConfig | null): void {
  if (typeof localStorage === 'undefined') return
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  else localStorage.removeItem(CONFIG_KEY)
}

export function createSupabase(config: SupabaseConfig | null): SupabaseClient | null {
  if (!config) return null
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
}

export function taskToRow(task: Task, userId: string): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    start_date: task.startDate,
    end_date: task.endDate,
    owner: task.owner,
    category: task.category,
    task_type: task.type,
    is_ongoing: task.isOngoing,
    completed_at: task.completedAt,
    sort_order: task.sortOrder,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  }
}

export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    owner: row.owner,
    category: row.category,
    type: row.task_type,
    isOngoing: row.is_ongoing,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
