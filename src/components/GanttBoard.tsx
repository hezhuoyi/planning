import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getDate,
  isWithinInterval,
  max,
  min,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import { Check, Heart, Mars, Venus } from 'lucide-react'
import { CATEGORY_LABELS, TASK_CATEGORIES } from '../domain/categories'
import {
  getOwnerGroup,
  getOwnerMarkKind,
  OWNER_GROUPS,
  type OwnerGroup,
  type OwnerMarkKind,
} from '../domain/owners'
import {
  getTaskBarClip,
  getTaskPosition,
  getTaskProgress,
  getTaskStatus,
  getTimelineRange,
  type SummaryScope,
} from '../domain/timeline'
import type { Task, TaskStatus } from '../domain/types'

interface GanttBoardProps {
  tasks: Task[]
  viewScope: SummaryScope
  viewMonth: Date
  focusTodayToken: number
  onEdit: (task: Task) => void
  onCreateAt: (date: string) => void
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  ongoing: '持续',
  overdue: '已逾期',
  completed: '已完成',
}

function getBarDensity(
  widthRatio: number,
  approxPx?: number,
): 'tight' | 'narrow' | 'normal' {
  if (widthRatio <= 0) return 'normal'
  // 优先按像素判断：全部视角下比例会偏小，但条本身可能够宽
  if (typeof approxPx === 'number' && approxPx > 0) {
    if (approxPx < 44) return 'tight'
    if (approxPx < 120) return 'narrow'
    return 'normal'
  }
  if (widthRatio < 0.06) return 'tight'
  if (widthRatio < 0.18) return 'narrow'
  return 'normal'
}

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(max-width: 720px)').matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 720px)')
    const update = () => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return narrow
}

function clipPercent(left: number, width: number) {
  const start = Math.max(0, left)
  const end = Math.min(100, left + width)
  if (end <= start) return null
  return { left: start, width: end - start }
}

function OwnerMarkIcon({ kind }: { kind: OwnerMarkKind }) {
  if (kind === 'female') return <Venus size={12} strokeWidth={2.4} />
  if (kind === 'male') return <Mars size={12} strokeWidth={2.4} />
  if (kind === 'together') return <Heart size={11} strokeWidth={2.4} fill="currentColor" />
  return <span className="owner-mark-dot" />
}

export function GanttBoard({
  tasks,
  viewScope,
  viewMonth,
  focusTodayToken,
  onEdit,
  onCreateAt,
}: GanttBoardProps) {
  const today = useMemo(() => new Date(), [])
  const narrow = useNarrowScreen()
  const range = useMemo(
    () => getTimelineRange(tasks, today, viewScope, viewMonth),
    [tasks, today, viewMonth, viewScope],
  )
  const months = useMemo(() => eachMonthOfInterval(range), [range])
  const totalDays = differenceInCalendarDays(range.end, range.start) + 1
  const pixelsPerDay = narrow
    ? viewScope === 'month'
      ? 13
      : 5.5
    : viewScope === 'month'
      ? 22
      : 5.2
  const fitMonth = viewScope === 'month'
  const boardWidth = fitMonth
    ? undefined
    : Math.max(narrow ? 320 : 640, Math.round(totalDays * pixelsPerDay))
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const showYearRow = months.length > 1

  const dateToPercent = (date: Date) =>
    (differenceInCalendarDays(startOfDay(date), startOfDay(range.start)) / totalDays) * 100

  const monthBlocks = months
    .map((month) => {
      const monthStart = max([startOfMonth(month), startOfDay(range.start)])
      const monthEnd = min([endOfMonth(month), range.end])
      const left = dateToPercent(monthStart)
      const width =
        ((differenceInCalendarDays(monthEnd, monthStart) + 1) / totalDays) * 100
      const clipped = clipPercent(left, width)
      if (!clipped) return null
      return {
        key: format(month, 'yyyy-MM'),
        label: showYearRow
          ? `${format(month, 'M')}月`
          : `${format(month, 'yyyy年M月')}`,
        year: format(month, 'yyyy'),
        left: clipped.left,
        width: clipped.width,
        month,
      }
    })
    .filter((block): block is NonNullable<typeof block> => Boolean(block))

  const yearBlocks = Array.from(new Set(monthBlocks.map((block) => block.year))).map((year) => {
    const blocks = monthBlocks.filter((block) => block.year === year)
    const left = blocks[0].left
    const right = blocks[blocks.length - 1].left + blocks[blocks.length - 1].width
    return {
      year,
      left,
      width: right - left,
    }
  })

  const periodBlocks = monthBlocks.flatMap((block) => {
    const lastDay = getDate(endOfMonth(block.month))
    return [
      { label: '上旬', start: 1, length: 10 },
      { label: '中旬', start: 11, length: 10 },
      { label: '下旬', start: 21, length: lastDay - 20 },
    ]
      .map((period) => {
        const periodStart = new Date(
          block.month.getFullYear(),
          block.month.getMonth(),
          period.start,
        )
        const periodEnd = new Date(
          block.month.getFullYear(),
          block.month.getMonth(),
          period.start + period.length - 1,
        )
        const visibleStart = max([startOfDay(periodStart), startOfDay(range.start)])
        const visibleEnd = min([startOfDay(periodEnd), startOfDay(range.end)])
        if (visibleEnd < visibleStart) return null
        const left = dateToPercent(visibleStart)
        const width =
          ((differenceInCalendarDays(visibleEnd, visibleStart) + 1) / totalDays) * 100
        const clipped = clipPercent(left, width)
        if (!clipped) return null
        return {
          key: `${block.key}-${period.label}`,
          label: period.label,
          left: clipped.left,
          width: clipped.width,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  })

  const todayVisible = isWithinInterval(today, range)
  const todayLeft = dateToPercent(today)

  const groupedTasks = useMemo(() => {
    const groups = new Map<OwnerGroup, Task[]>()
    for (const group of OWNER_GROUPS) groups.set(group, [])
    for (const task of [...tasks].sort((a, b) => a.sortOrder - b.sortOrder)) {
      groups.get(getOwnerGroup(task.owner))!.push(task)
    }
    return OWNER_GROUPS.map((owner) => ({
      owner,
      tasks: groups.get(owner) ?? [],
    })).filter((group) => group.tasks.length > 0)
  }, [tasks])

  const activeCategories = useMemo(() => {
    const used = new Set(tasks.map((task) => task.category))
    return TASK_CATEGORIES.filter((category) => used.has(category.value))
  }, [tasks])

  const createFromPointer = (event: React.MouseEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    onCreateAt(format(addDays(range.start, Math.floor(ratio * totalDays)), 'yyyy-MM-dd'))
  }

  useEffect(() => {
    if (!focusTodayToken || !todayVisible) return
    requestAnimationFrame(() => {
      const viewport = scrollRef.current
      const canvas = canvasRef.current
      if (!viewport || !canvas || typeof viewport.scrollTo !== 'function') return
      viewport.scrollTo({
        left: Math.max(
          0,
          (todayLeft / 100) * canvas.getBoundingClientRect().width - viewport.clientWidth / 2,
        ),
        behavior: 'smooth',
      })
    })
  }, [boardWidth, focusTodayToken, todayLeft, todayVisible])

  useEffect(() => {
    if (focusTodayToken) return
    requestAnimationFrame(() => {
      const viewport = scrollRef.current
      const canvas = canvasRef.current
      if (!viewport || !canvas || !todayVisible || typeof viewport.scrollTo !== 'function') return
      viewport.scrollTo({
        left: Math.max(
          0,
          (todayLeft / 100) * canvas.getBoundingClientRect().width - viewport.clientWidth / 3,
        ),
        behavior: 'auto',
      })
    })
  }, [boardWidth, focusTodayToken, todayLeft, todayVisible, viewScope])

  return (
    <section className="gantt-shell" aria-label="家庭计划">
      <div
        className={`gantt-scroll${fitMonth ? ' is-month' : ''}`}
        ref={scrollRef}
      >
        <div
          ref={canvasRef}
          className={`gantt-canvas zoom-period${showYearRow ? '' : ' header-compact'}${
            fitMonth ? ' is-month' : ''
          }`}
          style={boardWidth ? { width: boardWidth } : undefined}
        >
          <div className="gantt-header">
            {showYearRow && (
              <div className="year-row">
                {yearBlocks.map((block) => (
                  <div
                    className="header-block year-block"
                    key={block.year}
                    style={{ left: `${block.left}%`, width: `${block.width}%` }}
                  >
                    {block.year}年
                  </div>
                ))}
              </div>
            )}
            <div className="month-row">
              {monthBlocks.map((block) => (
                <div
                  className="header-block month-block"
                  key={block.key}
                  style={{ left: `${block.left}%`, width: `${block.width}%` }}
                >
                  {block.label}
                </div>
              ))}
            </div>
            <div className="period-row">
              {periodBlocks.map((block) => (
                <div
                  className="header-block period-block"
                  key={block.key}
                  style={{ left: `${block.left}%`, width: `${block.width}%` }}
                >
                  {block.label}
                </div>
              ))}
            </div>
          </div>

          <div className="gantt-body">
            <div className="timeline-guides" aria-hidden="true">
              {periodBlocks.map((block) => (
                <i
                  className="guide-line"
                  key={block.key}
                  style={{ left: `${block.left}%` }}
                />
              ))}
              {monthBlocks.map((block) => (
                <i
                  className="guide-line month-guide"
                  key={`month-${block.key}`}
                  style={{ left: `${block.left}%` }}
                />
              ))}
            </div>
            {todayVisible && (
              <div className="today-line" style={{ left: `${todayLeft}%` }} aria-hidden="true" />
            )}

            {groupedTasks.map((group) => {
              const visibleTasks = group.tasks.filter((task) => {
                const position = getTaskPosition(task, range)
                return (
                  position.width > 0 &&
                  position.left < 1 &&
                  position.left + position.width > 0
                )
              })
              if (visibleTasks.length === 0) return null
              return (
              <div className="owner-group" key={group.owner}>
                <div
                  className="owner-group-label"
                  data-owner={group.owner}
                  aria-label={`负责人 ${group.owner}`}
                >
                  <span className="owner-mark" aria-hidden="true">
                    <OwnerMarkIcon kind={getOwnerMarkKind(group.owner)} />
                  </span>
                  <span className="owner-name">{group.owner}</span>
                </div>
                {visibleTasks.map((task) => {
                  const position = getTaskPosition(task, range)
                  const clip = getTaskBarClip(task, range)
                  const status = getTaskStatus(task, today)
                  const progress = getTaskProgress(task, today)
                  const categoryLabel = CATEGORY_LABELS[task.category]
                  const density =
                    task.type === 'milestone'
                      ? 'normal'
                      : getBarDensity(
                          position.width,
                          boardWidth ? position.width * boardWidth : undefined,
                        )
                  const densityClass =
                    density === 'tight'
                      ? ' is-tight'
                      : density === 'narrow'
                        ? ' is-narrow'
                        : ''
                  const clipClass = `${clip.clipStart ? ' clip-start' : ''}${
                    clip.clipEnd ? ' clip-end' : ''
                  }`
                  return (
                    <div className="gantt-lane" key={task.id} onDoubleClick={createFromPointer}>
                      <button
                        type="button"
                        className={`task-mark category-${task.category} status-${status} ${task.type}${densityClass}${clipClass}`}
                        style={{
                          left: `${position.left * 100}%`,
                          width:
                            task.type === 'milestone' ? undefined : `${position.width * 100}%`,
                        }}
                        title={task.title}
                        aria-label={`编辑 ${task.title}，${categoryLabel}，${STATUS_LABELS[status]}，进度 ${progress}%`}
                        onClick={() => onEdit(task)}
                      >
                        {task.type !== 'milestone' && (
                          <span
                            className="task-progress"
                            style={{ width: `${progress}%` }}
                            aria-hidden="true"
                          />
                        )}
                        {status === 'completed' && <Check size={14} aria-hidden="true" />}
                        {task.type === 'milestone' ? (
                          <span className="milestone-label">
                            <span>{task.title}</span>
                            <small>
                              {categoryLabel} · {STATUS_LABELS[status]}
                            </small>
                          </span>
                        ) : (
                          <span className="task-label">
                            <span className="task-title">{task.title}</span>
                            <small className="task-meta">
                              <span className="task-meta-tag">{categoryLabel}</span>
                              <span className="task-meta-tag">{STATUS_LABELS[status]}</span>
                              <span className="task-pct">{progress}%</span>
                            </small>
                          </span>
                        )}
                        {task.isOngoing && <span className="ongoing-edge" aria-hidden="true" />}
                      </button>
                    </div>
                  )
                })}
              </div>
              )
            })}

            <button
              className="quick-lane"
              type="button"
              onDoubleClick={createFromPointer}
              aria-label="双击时间轴创建事项"
            />
          </div>
        </div>
      </div>

      {activeCategories.length > 0 && (
        <div className="status-legend" aria-label="分类图例">
          {activeCategories.map((category) => (
            <span key={category.value}>
              <i className={`legend-dot category-${category.value}`} />
              {category.label}
            </span>
          ))}
          <span className="footer-spacer" />
          <span>颜色按分类 · 进度在条上</span>
        </div>
      )}
    </section>
  )
}
