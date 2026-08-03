import { describe, expect, it } from 'vitest'
import type { Task } from '../domain/types'
import { FAMILY_USER_ID, taskToRow } from './supabase'

const task: Task = {
  id: 'task-1',
  title: 'Test task',
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

describe('taskToRow', () => {
  it('binds a task row to the shared family id by default', () => {
    expect(taskToRow(task)).toEqual({
      id: 'task-1',
      user_id: FAMILY_USER_ID,
      title: 'Test task',
      start_date: '2026-08-03',
      end_date: null,
      owner: null,
      category: 'growth',
      task_type: 'range',
      is_ongoing: true,
      completed_at: null,
      sort_order: 10,
      created_at: '2026-08-03T00:00:00.000Z',
      updated_at: '2026-08-03T00:00:00.000Z',
    })
  })
})
