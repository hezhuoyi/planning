import {
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  isAfter,
  isBefore,
  max,
  min,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import type { Task, TaskPosition, TaskStatus, TimelineRange } from './types'

export function getTaskStatus(task: Task, today: Date): TaskStatus {
  if (task.completedAt) return 'completed'

  const current = startOfDay(today)
  const start = startOfDay(parseISO(task.startDate))

  if (isBefore(current, start)) return 'not_started'
  if (task.isOngoing || !task.endDate) return 'ongoing'

  const end = endOfDay(parseISO(task.endDate))
  return isAfter(current, end) ? 'overdue' : 'in_progress'
}

export function getTimelineRange(
  tasks: Task[],
  today: Date,
  minimumMonths = 6,
): TimelineRange {
  const currentMonth = startOfMonth(today)
  const taskStarts = tasks.map((task) => startOfMonth(parseISO(task.startDate)))
  const earliest = taskStarts.length > 0 ? min([currentMonth, ...taskStarts]) : currentMonth

  const taskEnds = tasks.map((task) =>
    endOfMonth(parseISO(task.endDate ?? task.startDate)),
  )
  const minimumEnd = endOfMonth(addMonths(currentMonth, minimumMonths - 1))
  const latestTaskEnd = taskEnds.length > 0 ? max(taskEnds) : minimumEnd
  const bufferedTaskEnd = endOfMonth(addMonths(latestTaskEnd, 1))

  return {
    start: earliest,
    end: max([minimumEnd, bufferedTaskEnd]),
  }
}

export function getTaskPosition(
  task: Task,
  range: TimelineRange,
): TaskPosition {
  const rangeStart = startOfDay(range.start)
  const rangeEnd = endOfDay(range.end)
  const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1
  const taskStart = max([rangeStart, startOfDay(parseISO(task.startDate))])
  const requestedEnd = task.isOngoing || !task.endDate ? rangeEnd : endOfDay(parseISO(task.endDate))
  const taskEnd = min([rangeEnd, requestedEnd])
  const leftDays = Math.max(0, differenceInCalendarDays(taskStart, rangeStart))
  const widthDays = Math.max(1, differenceInCalendarDays(taskEnd, taskStart) + 1)

  return {
    left: leftDays / totalDays,
    width: Math.min(1 - leftDays / totalDays, widthDays / totalDays),
  }
}
