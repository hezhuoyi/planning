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

/** 0–100：按日期推进估算；已完成固定 100；未开始为 0；持续事项按已开始天数封顶 85 */
export function getTaskProgress(task: Task, today: Date): number {
  if (task.completedAt) return 100

  const current = startOfDay(today)
  const start = startOfDay(parseISO(task.startDate))
  if (isBefore(current, start)) return 0

  if (task.isOngoing || !task.endDate) {
    const elapsed = differenceInCalendarDays(current, start) + 1
    return Math.min(85, Math.round(Math.min(elapsed / 30, 1) * 85))
  }

  const end = startOfDay(parseISO(task.endDate))
  const total = Math.max(1, differenceInCalendarDays(end, start) + 1)
  const elapsed = Math.max(0, differenceInCalendarDays(current, start) + 1)
  return Math.min(100, Math.round((elapsed / total) * 100))
}

export type SummaryScope = 'month' | 'all'

export interface PlanSummary {
  total: number
  completed: number
  inFlight: number
  upcoming: number
  overdue: number
  headline: string
  detail: string
  kicker: string
}

function taskOverlapsMonth(task: Task, monthAnchor: Date): boolean {
  const monthStart = startOfMonth(monthAnchor)
  const monthEnd = endOfMonth(monthAnchor)
  const start = startOfDay(parseISO(task.startDate))
  if (isAfter(start, monthEnd)) return false
  if (task.isOngoing || !task.endDate) return true
  const end = endOfDay(parseISO(task.endDate))
  return !isBefore(end, monthStart)
}

/** 月：与指定月有交集；全部：所有事项 */
export function filterTasksForSummary(
  tasks: Task[],
  today: Date,
  scope: SummaryScope,
  monthAnchor: Date = today,
): Task[] {
  if (scope === 'month') {
    return tasks.filter((task) => taskOverlapsMonth(task, monthAnchor))
  }
  return tasks
}

export function getPlanSummary(
  tasks: Task[],
  today: Date,
  scope: SummaryScope = 'month',
  monthAnchor: Date = today,
): PlanSummary {
  const scoped = filterTasksForSummary(tasks, today, scope, monthAnchor)
  const statuses = scoped.map((task) => getTaskStatus(task, today))
  const completed = statuses.filter((status) => status === 'completed').length
  const overdue = statuses.filter((status) => status === 'overdue').length
  const upcoming = statuses.filter((status) => status === 'not_started').length
  const inFlight = statuses.filter(
    (status) => status === 'in_progress' || status === 'ongoing',
  ).length
  const total = scoped.length
  const monthLabel = `${monthAnchor.getMonth() + 1}月`
  const kicker = scope === 'month' ? '本月速览' : '全部计划'

  if (total === 0) {
    return {
      total,
      completed,
      inFlight,
      upcoming,
      overdue,
      kicker,
      headline: scope === 'month' ? `${monthLabel}还没有安排` : '还没有安排事项',
      detail: '点右上角「新增」，把想做的事放上时间轴吧',
    }
  }

  if (completed === total) {
    return {
      total,
      completed,
      inFlight,
      upcoming,
      overdue,
      kicker,
      headline: scope === 'month' ? `${monthLabel}的计划都完成啦` : '太棒了，计划都完成啦',
      detail: `一共 ${total} 项，全部划掉了`,
    }
  }

  const parts: string[] = []
  if (inFlight) parts.push(`${inFlight} 项进行中`)
  if (upcoming) parts.push(`${upcoming} 项待开始`)
  if (overdue) parts.push(`${overdue} 项已逾期`)
  if (completed) parts.push(`已完成 ${completed} 项`)

  const headline =
    scope === 'month'
      ? overdue > 0
        ? `${monthLabel}有 ${overdue} 项需要留意`
        : inFlight > 0
          ? `${monthLabel}有 ${inFlight} 项正在推进`
          : `${monthLabel}还有 ${upcoming} 项安排`
      : overdue > 0
        ? `一共 ${total} 项，其中 ${overdue} 项需留意`
        : inFlight > 0
          ? `一共 ${total} 项，${inFlight} 项正在推进`
          : `一共 ${total} 项家庭计划`

  return {
    total,
    completed,
    inFlight,
    upcoming,
    overdue,
    kicker,
    headline,
    detail: parts.join(' · ') || `共 ${total} 项`,
  }
}

export function getTimelineRange(
  tasks: Task[],
  today: Date,
  scope: SummaryScope = 'month',
  monthAnchor: Date = today,
): TimelineRange {
  if (scope === 'month') {
    return {
      start: startOfMonth(monthAnchor),
      end: endOfMonth(monthAnchor),
    }
  }

  return getFullTimelineRange(tasks, today)
}

/** 保留完整跨度计算，供测试 / 需要总览时使用 */
export function getFullTimelineRange(
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
  const rawStart = startOfDay(parseISO(task.startDate))
  const rawEnd =
    task.isOngoing || !task.endDate ? rangeEnd : endOfDay(parseISO(task.endDate))

  // 与可视区间无交集时返回零宽，避免「已结束任务」被压成左侧 1 天小色块
  if (rawEnd < rangeStart || rawStart > rangeEnd) {
    return { left: 0, width: 0 }
  }

  const taskStart = max([rangeStart, rawStart])
  const taskEnd = min([rangeEnd, rawEnd])
  const leftDays = Math.max(0, differenceInCalendarDays(taskStart, rangeStart))
  const widthDays = Math.max(1, differenceInCalendarDays(taskEnd, taskStart) + 1)

  return {
    left: leftDays / totalDays,
    width: Math.min(1 - leftDays / totalDays, widthDays / totalDays),
  }
}

/** 任务在可视范围外还有延伸时，对应端应取消胶囊圆角 */
export function getTaskBarClip(
  task: Task,
  range: TimelineRange,
): { clipStart: boolean; clipEnd: boolean } {
  const rangeStart = startOfDay(range.start)
  const rangeEnd = endOfDay(range.end)
  const rawStart = startOfDay(parseISO(task.startDate))
  const continuesPastEnd = task.isOngoing || !task.endDate
  const rawEnd = continuesPastEnd ? null : endOfDay(parseISO(task.endDate!))

  return {
    clipStart: isBefore(rawStart, rangeStart),
    clipEnd: continuesPastEnd || (rawEnd !== null && isAfter(rawEnd, rangeEnd)),
  }
}
