import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Task, TaskCategory, TaskType } from '../domain/types'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

/** 写死的 Supabase 配置 */
const HARDCODED_SUPABASE: SupabaseConfig = {
  url: 'https://cirbniblcgzyfuizjzig.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpcmJuaWJsY2d6eWZ1aXpqemlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDY2MTgsImV4cCI6MjEwMTMyMjYxOH0.wDorCxTxsk2WzIAfw90CxoJrFUJt8q1BKr3O3EhHB0I',
}

/** 家庭口令：对了就能同步，全家人共用同一份云数据 */
export const FAMILY_PASSCODE = 'wang'

/** 固定家庭 user_id，所有设备读写同一份 tasks */
export const FAMILY_USER_ID = '00000000-0000-4000-8000-000000000001'

const UNLOCK_KEY = 'mainline.family.unlock.v1'

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

function isPlaceholder(config: SupabaseConfig): boolean {
  return (
    !config.url ||
    !config.anonKey ||
    config.url.includes('YOUR_PROJECT') ||
    config.anonKey === 'YOUR_ANON_KEY'
  )
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  if (envUrl && envKey) return { url: envUrl, anonKey: envKey }

  if (isPlaceholder(HARDCODED_SUPABASE)) return null
  return HARDCODED_SUPABASE
}

export function createSupabase(config: SupabaseConfig | null): SupabaseClient | null {
  if (!config) return null
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export function isFamilyUnlocked(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(UNLOCK_KEY) === '1'
}

export function setFamilyUnlocked(unlocked: boolean): void {
  if (typeof localStorage === 'undefined') return
  if (unlocked) localStorage.setItem(UNLOCK_KEY, '1')
  else localStorage.removeItem(UNLOCK_KEY)
}

export function verifyFamilyPasscode(input: string): boolean {
  return input.trim() === FAMILY_PASSCODE
}

export function taskToRow(task: Task, userId: string = FAMILY_USER_ID): TaskRow {
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
