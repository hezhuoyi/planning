import { describe, expect, it } from 'vitest'
import type { Task } from './types'
import { sortTasksForDisplay } from './taskSort'

const base: Task = {
  id: 't',
  title: 't',
  startDate: '2026-08-10',
  endDate: '2026-08-20',
  owner: '一起',
  category: 'growth',
  type: 'range',
  isOngoing: false,
  completedAt: null,
  sortOrder: 10,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('sortTasksForDisplay', () => {
  it('puts incomplete tasks before completed ones', () => {
    const done = { ...base, id: 'done', completedAt: '2026-08-05T00:00:00.000Z', sortOrder: 1 }
    const open = { ...base, id: 'open', sortOrder: 99 }
    expect(sortTasksForDisplay([done, open]).map((task) => task.id)).toEqual(['open', 'done'])
  })

  it('orders by start date then sortOrder within the same completion state', () => {
    const later = { ...base, id: 'later', startDate: '2026-08-20', sortOrder: 1 }
    const earlier = { ...base, id: 'earlier', startDate: '2026-08-05', sortOrder: 50 }
    const sameDayLow = { ...base, id: 'low', startDate: '2026-08-05', sortOrder: 10 }
    expect(sortTasksForDisplay([later, earlier, sameDayLow]).map((task) => task.id)).toEqual([
      'low',
      'earlier',
      'later',
    ])
  })
})
