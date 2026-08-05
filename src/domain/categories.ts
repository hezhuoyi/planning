import type { TaskCategory } from './types'

export const TASK_CATEGORIES: Array<{
  value: TaskCategory
  label: string
  color: string
  soft: string
}> = [
  { value: 'health', label: '健康', color: '#1f9ea8', soft: '#e3f5f6' },
  { value: 'home', label: '生活', color: '#8f8b7c', soft: '#f2f0eb' },
  { value: 'growth', label: '成长', color: '#5a6fc4', soft: '#eaedf8' },
  { value: 'career', label: '事业', color: '#8a65c0', soft: '#f0eaf8' },
  { value: 'travel', label: '出行', color: '#d45a63', soft: '#fcebec' },
]

export const CATEGORY_LABELS: Record<TaskCategory, string> = Object.fromEntries(
  TASK_CATEGORIES.map((item) => [item.value, item.label]),
) as Record<TaskCategory, string>

export const CATEGORY_COLORS: Record<TaskCategory, string> = Object.fromEntries(
  TASK_CATEGORIES.map((item) => [item.value, item.color]),
) as Record<TaskCategory, string>
