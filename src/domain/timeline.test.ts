import { describe, expect, it } from 'vitest'
import { getTaskPosition, getTaskStatus, getTimelineRange } from './timeline'
import type { Task } from './types'

const baseTask: Task = {
  id: 'task-1',
  title: '测试任务',
  startDate: '2026-08-10',
  endDate: '2026-08-20',
  owner: null,
  category: 'growth',
  type: 'range',
  isOngoing: false,
  completedAt: null,
  sortOrder: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('getTaskStatus', () => {
  it('returns completed when a task has a completion timestamp', () => {
    expect(
      getTaskStatus(
        { ...baseTask, completedAt: '2026-08-12T00:00:00.000Z' },
        new Date(2026, 7, 15),
      ),
    ).toBe('completed')
  })

  it('derives not started, in progress, and overdue from task dates', () => {
    expect(getTaskStatus(baseTask, new Date(2026, 7, 5))).toBe('not_started')
    expect(getTaskStatus(baseTask, new Date(2026, 7, 15))).toBe('in_progress')
    expect(getTaskStatus(baseTask, new Date(2026, 7, 21))).toBe('overdue')
  })

  it('labels a no-end-date task as ongoing after its start date', () => {
    expect(
      getTaskStatus(
        { ...baseTask, endDate: null, isOngoing: true },
        new Date(2027, 0, 1),
      ),
    ).toBe('ongoing')
  })
})

describe('getTimelineRange', () => {
  it('shows at least six months and adds a month after the latest task', () => {
    const range = getTimelineRange(
      [{ ...baseTask, startDate: '2026-08-01', endDate: '2027-02-10' }],
      new Date(2026, 7, 3),
    )

    expect(range.start).toEqual(new Date(2026, 7, 1))
    expect(range.end).toEqual(new Date(2027, 2, 31, 23, 59, 59, 999))
  })

  it('includes an earlier task instead of hard-coding the current month', () => {
    const range = getTimelineRange(
      [{ ...baseTask, startDate: '2026-05-12' }],
      new Date(2026, 7, 3),
    )

    expect(range.start).toEqual(new Date(2026, 4, 1))
  })
})

describe('getTaskPosition', () => {
  it('maps a dated task to a proportional left offset and width', () => {
    const position = getTaskPosition(
      { ...baseTask, startDate: '2026-09-01', endDate: '2026-09-30' },
      {
        start: new Date(2026, 7, 1),
        end: new Date(2026, 9, 31, 23, 59, 59, 999),
      },
    )

    expect(position.left).toBeCloseTo(31 / 92, 4)
    expect(position.width).toBeCloseTo(30 / 92, 4)
  })

  it('extends an ongoing task to the end of the visible range', () => {
    const position = getTaskPosition(
      { ...baseTask, startDate: '2026-09-01', endDate: null, isOngoing: true },
      {
        start: new Date(2026, 7, 1),
        end: new Date(2026, 9, 31, 23, 59, 59, 999),
      },
    )

    expect(position.left + position.width).toBeCloseTo(1, 4)
  })
})
