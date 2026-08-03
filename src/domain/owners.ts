export const TASK_OWNERS = ['王', '何', '共同'] as const

export type TaskOwner = (typeof TASK_OWNERS)[number]

export const OWNER_GROUPS = [...TASK_OWNERS, '未指定'] as const

export type OwnerGroup = (typeof OWNER_GROUPS)[number]

export function normalizeOwner(owner: string | null | undefined): TaskOwner | null {
  if (!owner) return null
  return (TASK_OWNERS as readonly string[]).includes(owner) ? (owner as TaskOwner) : null
}

export function getOwnerGroup(owner: string | null | undefined): OwnerGroup {
  return normalizeOwner(owner) ?? '未指定'
}
