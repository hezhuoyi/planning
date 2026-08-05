import { describe, expect, it } from 'vitest'
import {
  getTaskBarClip,
  getTaskPosition,
  getTaskProgress,
  getTaskStatus,
  getTimelineRange,
  getFullTimelineRange,
  getPlanSummary,
  shiftTaskByDays,
} from './timeline'
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

describe('getTaskProgress', () => {
  it('returns 0 before start, 100 when completed, and scales across the range', () => {
    expect(getTaskProgress(baseTask, new Date(2026, 7, 5))).toBe(0)
    expect(
      getTaskProgress(
        { ...baseTask, completedAt: '2026-08-12T00:00:00.000Z' },
        new Date(2026, 7, 15),
      ),
    ).toBe(100)
    expect(getTaskProgress(baseTask, new Date(2026, 7, 15))).toBe(55)
  })
})

describe('getPlanSummary', () => {
  it('defaults to a monthly headline for tasks overlapping this month', () => {
    const summary = getPlanSummary(
      [
        baseTask,
        {
          ...baseTask,
          id: 'done',
          completedAt: '2026-08-01T00:00:00.000Z',
        },
        {
          ...baseTask,
          id: 'late',
          endDate: '2026-08-01',
        },
      ],
      new Date(2026, 7, 15),
      'month',
    )

    expect(summary.kicker).toBe('本月速览')
    expect(summary.total).toBe(3)
    expect(summary.completed).toBe(1)
    expect(summary.overdue).toBe(1)
    expect(summary.headline).toContain('留意')
    expect(summary.overdue).toBe(1)
    expect(summary.detail).toBe('')
  })

  it('summarizes every task in the all scope', () => {
    const summary = getPlanSummary(
      [
        baseTask,
        {
          ...baseTask,
          id: 'future',
          startDate: '2026-09-01',
          endDate: '2026-09-10',
        },
      ],
      new Date(2026, 7, 15),
      'all',
    )

    expect(summary.kicker).toBe('全部计划')
    expect(summary.total).toBe(2)
    expect(summary.inFlight + summary.upcoming).toBeGreaterThan(0)
    expect(summary.detail).toBe('')
  })
})

describe('getTimelineRange', () => {
  it('limits the week scope to Monday–Sunday of the selected week', () => {
    const range = getTimelineRange(
      [{ ...baseTask, startDate: '2026-05-01', endDate: '2027-02-10' }],
      new Date(2026, 7, 15),
      'week',
      new Date(2026, 7, 12),
    )

    expect(range.start).toEqual(new Date(2026, 7, 10))
    expect(range.end.getFullYear()).toBe(2026)
    expect(range.end.getMonth()).toBe(7)
    expect(range.end.getDate()).toBe(16)
  })

  it('limits the month scope to the selected calendar month', () => {
    const range = getTimelineRange(
      [{ ...baseTask, startDate: '2026-05-01', endDate: '2027-02-10' }],
      new Date(2026, 7, 15),
      'month',
      new Date(2026, 8, 1),
    )

    expect(range.start).toEqual(new Date(2026, 8, 1))
    expect(range.end).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999))
  })

  it('uses the full task span for the all scope', () => {
    const range = getTimelineRange(
      [{ ...baseTask, startDate: '2026-08-01', endDate: '2027-02-10' }],
      new Date(2026, 7, 15),
      'all',
    )

    expect(range.start).toEqual(new Date(2026, 7, 1))
    expect(range.end).toEqual(new Date(2027, 2, 31, 23, 59, 59, 999))
  })
})

describe('getFullTimelineRange', () => {
  it('shows at least six months and adds a month after the latest task', () => {
    const range = getFullTimelineRange(
      [{ ...baseTask, startDate: '2026-08-01', endDate: '2027-02-10' }],
      new Date(2026, 7, 3),
    )

    expect(range.start).toEqual(new Date(2026, 7, 1))
    expect(range.end).toEqual(new Date(2027, 2, 31, 23, 59, 59, 999))
  })

  it('includes an earlier task instead of hard-coding the current month', () => {
    const range = getFullTimelineRange(
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

  it('returns zero width when a task ends before the visible range', () => {
    const position = getTaskPosition(
      { ...baseTask, startDate: '2026-08-01', endDate: '2026-08-20' },
      {
        start: new Date(2026, 8, 1),
        end: new Date(2026, 8, 30, 23, 59, 59, 999),
      },
    )

    expect(position.width).toBe(0)
  })
})

describe('getTaskBarClip', () => {
  it('marks clipped ends when a task continues past the visible month', () => {
    const clip = getTaskBarClip(
      { ...baseTask, startDate: '2026-07-20', endDate: '2026-09-10' },
      {
        start: new Date(2026, 7, 1),
        end: new Date(2026, 7, 31, 23, 59, 59, 999),
      },
    )

    expect(clip.clipStart).toBe(true)
    expect(clip.clipEnd).toBe(true)
  })

  it('clips only the continuing end for ongoing tasks', () => {
    const clip = getTaskBarClip(
      { ...baseTask, startDate: '2026-08-10', endDate: null, isOngoing: true },
      {
        start: new Date(2026, 7, 1),
        end: new Date(2026, 7, 31, 23, 59, 59, 999),
      },
    )

    expect(clip.clipStart).toBe(false)
    expect(clip.clipEnd).toBe(true)
  })
})

describe('shiftTaskByDays', () => {
  it('returns the same task when days is 0', () => {
    expect(shiftTaskByDays(baseTask, 0)).toBe(baseTask)
  })

  it('shifts start and end dates together', () => {
    const shifted = shiftTaskByDays(baseTask, 3)
    expect(shifted.startDate).toBe('2026-08-13')
    expect(shifted.endDate).toBe('2026-08-23')
    expect(shifted.id).toBe(baseTask.id)
  })

  it('keeps ongoing tasks without an end date', () => {
    const shifted = shiftTaskByDays(
      { ...baseTask, endDate: null, isOngoing: true },
      -2,
    )
    expect(shifted.startDate).toBe('2026-08-08')
    expect(shifted.endDate).toBeNull()
  })
})
