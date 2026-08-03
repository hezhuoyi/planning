export type TaskType = 'range' | 'milestone'
export type TaskStatus = 'not_started' | 'in_progress' | 'ongoing' | 'overdue' | 'completed'

export type TaskCategory = 'health' | 'growth' | 'career' | 'home' | 'travel'

export interface Task {
  id: string
  title: string
  startDate: string
  endDate: string | null
  owner: string | null
  category: TaskCategory
  type: TaskType
  isOngoing: boolean
  completedAt: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface TimelineRange {
  start: Date
  end: Date
}

export interface TaskPosition {
  left: number
  width: number
}
