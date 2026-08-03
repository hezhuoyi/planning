export const TASK_OWNERS = ['王慧云', '何卓逸', '共同'] as const

export type TaskOwner = (typeof TASK_OWNERS)[number]

export const OWNER_GROUPS = [...TASK_OWNERS, '未指定'] as const

export type OwnerGroup = (typeof OWNER_GROUPS)[number]

const OWNER_ALIASES: Record<string, TaskOwner> = {
  王: '王慧云',
  王慧云: '王慧云',
  何: '何卓逸',
  何卓逸: '何卓逸',
  共同: '共同',
}

export function normalizeOwner(owner: string | null | undefined): TaskOwner | null {
  if (!owner) return null
  return OWNER_ALIASES[owner] ?? null
}

export function getOwnerGroup(owner: string | null | undefined): OwnerGroup {
  return normalizeOwner(owner) ?? '未指定'
}

/** 将旧负责人名迁移到新名；无变化时返回原数组 */
export function migrateTaskOwners<T extends { owner: string | null }>(tasks: T[]): T[] {
  let changed = false
  const next = tasks.map((task) => {
    const owner = normalizeOwner(task.owner)
    if (owner === task.owner) return task
    changed = true
    return { ...task, owner }
  })
  return changed ? next : tasks
}
