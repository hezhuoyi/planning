import type { TaskCategory } from './types'

export const TASK_CATEGORIES: Array<{
  value: TaskCategory
  label: string
  color: string
  soft: string
}> = [
  { value: 'health', label: '健康', color: '#4f9d8a', soft: '#e3f2eb' },
  { value: 'growth', label: '成长', color: '#5b86c7', soft: '#e8f0fb' },
  { value: 'career', label: '事业', color: '#8a74b8', soft: '#efeaf8' },
  { value: 'home', label: '生活', color: '#c9895c', soft: '#faf0e4' },
  { value: 'travel', label: '出行', color: '#d36b7a', soft: '#fceced' },
]

export const CATEGORY_LABELS: Record<TaskCategory, string> = Object.fromEntries(
  TASK_CATEGORIES.map((item) => [item.value, item.label]),
) as Record<TaskCategory, string>

export const CATEGORY_COLORS: Record<TaskCategory, string> = Object.fromEntries(
  TASK_CATEGORIES.map((item) => [item.value, item.color]),
) as Record<TaskCategory, string>
