import type { Task } from './types'

/** 展示排序：未完成优先 → 开始日期升序 → sortOrder */
export function compareTasksForDisplay(a: Task, b: Task): number {
  const aDone = a.completedAt ? 1 : 0
  const bDone = b.completedAt ? 1 : 0
  if (aDone !== bDone) return aDone - bDone
  if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1
  return a.sortOrder - b.sortOrder
}

export function sortTasksForDisplay(tasks: Task[]): Task[] {
  return [...tasks].sort(compareTasksForDisplay)
}
