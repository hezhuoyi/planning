import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
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
import { AlertTriangle, Briefcase, Check, Heart, HeartPulse, Home, Mars, Plane, Sprout, Venus } from 'lucide-react'
import { CATEGORY_LABELS, TASK_CATEGORIES } from '../domain/categories'
import { getOwnerGroup, getOwnerMarkKind, OWNER_GROUPS, type OwnerGroup, type OwnerMarkKind } from '../domain/owners'
import { sortTasksForDisplay } from '../domain/taskSort'
import {
  getTaskBarClip,
  getTaskPosition,
  getTaskProgress,
  getTaskStatus,
  getTimelineRange,
  shiftTaskByDays,
  type SummaryScope,
} from '../domain/timeline'
import type { Task, TaskCategory, TaskStatus } from '../domain/types'

interface GanttBoardProps {
  tasks: Task[]
  viewScope: SummaryScope
  viewMonth: Date
  focusTodayToken: number
  enteringTaskId?: string | null
  exitingTaskIds?: string[]
  showSkeleton?: boolean
  onEdit: (task: Task) => void
  onCreateAt: (date: string) => void
  onReschedule?: (task: Task) => void
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  ongoing: '持续',
  overdue: '已逾期',
  completed: '已完成',
}

const DRAG_THRESHOLD_PX = 10
const LONG_PRESS_MS = 480

function getBarDensity(
  widthRatio: number,
  approxPx?: number,
): 'tight' | 'narrow' | 'normal' {
  if (widthRatio <= 0) return 'normal'
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

function CategoryIcon({ category }: { category: TaskCategory }) {
  const props = { size: 12, strokeWidth: 2.4, 'aria-hidden': true as const }
  switch (category) {
    case 'health':
      return <HeartPulse {...props} />
    case 'growth':
      return <Sprout {...props} />
    case 'career':
      return <Briefcase {...props} />
    case 'home':
      return <Home {...props} />
    case 'travel':
      return <Plane {...props} />
  }
}

function TaskMarkButton({
  task,
  status,
  progress,
  categoryLabel,
  densityClass,
  clipClass,
  barDelay,
  left,
  width,
  dayWidthPx,
  isEntering,
  isExiting,
  labelEnd = false,
  onEdit,
  onReschedule,
  onPreview,
}: {
  task: Task
  status: TaskStatus
  progress: number
  categoryLabel: string
  densityClass: string
  clipClass: string
  barDelay: number
  left: string
  width?: string
  dayWidthPx: number
  isEntering: boolean
  isExiting: boolean
  labelEnd?: boolean
  onEdit: (task: Task) => void
  onReschedule?: (task: Task) => void
  onPreview: (task: Task | null) => void
}) {
  const suppressClickRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const dragDaysRef = useRef(0)
  const draggingRef = useRef(false)
  const previewOpenedRef = useRef(false)
  const longPressTimerRef = useRef<number | null>(null)
  const suppressTimerRef = useRef<number | null>(null)
  const [dragOffsetPx, setDragOffsetPx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current)
      }
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current)
      }
    }
  }, [])

  const suppressNextClick = () => {
    suppressClickRef.current = true
    if (suppressTimerRef.current !== null) {
      window.clearTimeout(suppressTimerRef.current)
    }
    // 部分移动端松手后不一定派发 click，超时后清掉，避免下次要点两下
    suppressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false
      suppressTimerRef.current = null
    }, 450)
  }

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    clearLongPress()
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null

    if (draggingRef.current) {
      const days = dragDaysRef.current
      draggingRef.current = false
      setIsDragging(false)
      setDragOffsetPx(0)
      dragDaysRef.current = 0
      suppressNextClick()
      onPreview(null)
      if (days !== 0 && onReschedule) {
        onReschedule(shiftTaskByDays(task, days))
      }
      return
    }

    dragDaysRef.current = 0
    setDragOffsetPx(0)
    setIsDragging(false)

    // 长按已打开预览：吞掉这次松手带来的 click，不打开编辑弹窗
    if (previewOpenedRef.current) {
      previewOpenedRef.current = false
      suppressNextClick()
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isExiting) return
    pointerIdRef.current = event.pointerId
    startXRef.current = event.clientX
    draggingRef.current = false
    previewOpenedRef.current = false
    dragDaysRef.current = 0
    setDragOffsetPx(0)
    event.currentTarget.setPointerCapture(event.pointerId)

    clearLongPress()
    longPressTimerRef.current = window.setTimeout(() => {
      if (draggingRef.current) return
      previewOpenedRef.current = true
      suppressNextClick()
      onPreview(task)
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    const deltaX = event.clientX - startXRef.current
    if (!draggingRef.current && Math.abs(deltaX) < DRAG_THRESHOLD_PX) return

    clearLongPress()
    previewOpenedRef.current = false
    onPreview(null)
    if (!draggingRef.current) {
      draggingRef.current = true
      setIsDragging(true)
      suppressNextClick()
    }

    const dayPx = Math.max(dayWidthPx, 1)
    const days = Math.round(deltaX / dayPx)
    dragDaysRef.current = days
    setDragOffsetPx(days * dayPx)
  }

  return (
    <button
      type="button"
      className={`task-mark category-${task.category} status-${status} ${task.type}${densityClass}${clipClass}${
        isEntering ? ' is-drop-in' : ''
      }${isExiting ? ' is-exiting' : ''}${isDragging ? ' is-dragging' : ''}${
        labelEnd ? ' is-label-end' : ''
      }`}
      style={
        {
          left,
          width,
          ['--bar-delay' as string]: `${barDelay}ms`,
          transform: dragOffsetPx ? `translateX(${dragOffsetPx}px)` : undefined,
        } as CSSProperties
      }
      title={task.title}
      aria-label={`编辑 ${task.title}，${categoryLabel}，${STATUS_LABELS[status]}，进度 ${progress}%`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          if (suppressTimerRef.current !== null) {
            window.clearTimeout(suppressTimerRef.current)
            suppressTimerRef.current = null
          }
          return
        }
        onEdit(task)
      }}
    >
      {task.type !== 'milestone' && (
        <span
          className="task-progress"
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />
      )}
      {status === 'completed' && (
        <span className="task-check" aria-hidden="true">
          <Check size={14} />
        </span>
      )}
      {status === 'overdue' && (
        <span className="task-overdue-flag" aria-hidden="true">
          <AlertTriangle size={12} strokeWidth={2.6} />
          <span>逾期</span>
        </span>
      )}
      {task.type === 'milestone' ? (
        <span className="milestone-label">
          <span className="task-cat-icon" aria-hidden="true">
            <CategoryIcon category={task.category} />
          </span>
          <span>{task.title}</span>
          <small>{STATUS_LABELS[status]}</small>
        </span>
      ) : (
        <span className="task-label">
          <span className="task-cat-icon" aria-hidden="true">
            <CategoryIcon category={task.category} />
          </span>
          <span className="task-title">{task.title}</span>
          <small className="task-meta">
            {status !== 'overdue' && (
              <span className="task-meta-tag">{STATUS_LABELS[status]}</span>
            )}
            <span className="task-pct">{progress}%</span>
          </small>
        </span>
      )}
      {task.isOngoing && <span className="ongoing-edge" aria-hidden="true" />}
    </button>
  )
}

export function GanttBoard({
  tasks,
  viewScope,
  viewMonth,
  focusTodayToken,
  enteringTaskId = null,
  exitingTaskIds = [],
  showSkeleton = false,
  onEdit,
  onCreateAt,
  onReschedule,
}: GanttBoardProps) {
  const now = new Date()
  const todayKey = format(now, 'yyyy-MM-dd')
  const today = useMemo(() => startOfDay(new Date()), [todayKey])
  const narrow = useNarrowScreen()
  const range = useMemo(
    () => getTimelineRange(tasks, today, viewScope, viewMonth),
    [tasks, today, viewMonth, viewScope],
  )
  const months = useMemo(() => eachMonthOfInterval(range), [range])
  const totalDays = differenceInCalendarDays(range.end, range.start) + 1
  const pixelsPerDay = narrow
    ? viewScope === 'month' || viewScope === 'week'
      ? 13
      : 5.5
    : viewScope === 'month' || viewScope === 'week'
      ? 22
      : 5.2
  const fitMonth = viewScope === 'month'
  const fitWeek = viewScope === 'week'
  const fitFixed = fitMonth || fitWeek
  const boardWidth = fitFixed
    ? undefined
    : Math.max(narrow ? 320 : 640, Math.round(totalDays * pixelsPerDay))
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const autoScrolledForRef = useRef<string | null>(null)
  const lastFocusTodayTokenRef = useRef(0)
  const [todayFlash, setTodayFlash] = useState(false)
  const [previewTask, setPreviewTask] = useState<Task | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(0)

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
        label: `${format(month, 'M')}月`,
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

  const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

  const periodBlocks = fitWeek
    ? WEEKDAY_LABELS.map((label, index) => {
        const date = addDays(startOfDay(range.start), index)
        return {
          key: `week-${format(date, 'yyyy-MM-dd')}`,
          label: `${format(date, 'd')} ${label}`,
          left: (index * 100) / 7,
          width: 100 / 7,
        }
      })
    : fitMonth
      ? (
          [
            { label: '月初', index: 0 },
            { label: '月中', index: 1 },
            { label: '月末', index: 2 },
          ] as const
        ).map((period) => ({
          key: period.label,
          label: period.label,
          left: (period.index * 100) / 3,
          width: 100 / 3,
        }))
      : monthBlocks.flatMap((block) => {
          const lastDay = getDate(endOfMonth(block.month))
          return [
            { label: '月初', start: 1, length: 10 },
            { label: '月中', start: 11, length: 10 },
            { label: '月末', start: 21, length: lastDay - 20 },
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

  const periodGuides = periodBlocks.filter((block) => block.left > 0.4)

  const dayProgress =
    (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400
  const todayLeft = dateToPercent(today) + (dayProgress * 100) / totalDays
  const todayVisible = isWithinInterval(today, { start: range.start, end: range.end })

  const groupedTasks = useMemo(() => {
    const groups = new Map<OwnerGroup, Task[]>()
    for (const group of OWNER_GROUPS) groups.set(group, [])
    for (const task of sortTasksForDisplay(tasks)) {
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

  const boardMotionKey = `${viewScope}-${format(viewMonth, 'yyyy-MM-dd')}`

  const visibleGroups = useMemo(() => {
    return groupedTasks
      .map((group) => ({
        ...group,
        tasks: group.tasks.filter((task) => {
          const position = getTaskPosition(task, range)
          return (
            position.width > 0 &&
            position.left < 1 &&
            position.left + position.width > 0
          )
        }),
      }))
      .filter((group) => group.tasks.length > 0)
  }, [groupedTasks, range])

  const createFromPointer = (event: React.MouseEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    onCreateAt(format(addDays(range.start, Math.floor(ratio * totalDays)), 'yyyy-MM-dd'))
  }

  const dayWidthPx = canvasWidth > 0 ? canvasWidth / totalDays : pixelsPerDay

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const update = () => setCanvasWidth(canvas.getBoundingClientRect().width)
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(canvas)
    return () => observer?.disconnect()
  }, [boardWidth, viewScope, boardMotionKey])

  useEffect(() => {
    if (!focusTodayToken || !todayVisible) return
    // 只在用户再次点击「今天」时滚动，避免 todayLeft 秒级变化反复拽回
    if (lastFocusTodayTokenRef.current === focusTodayToken) return
    lastFocusTodayTokenRef.current = focusTodayToken

    setTodayFlash(true)
    const timer = window.setTimeout(() => setTodayFlash(false), 1200)
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
    return () => window.clearTimeout(timer)
    // todayLeft 刻意不入依赖：仅消费点击当次的位置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardWidth, focusTodayToken, todayVisible])

  useEffect(() => {
    if (!todayVisible) return
    // 全部视图需等画布宽度就绪；周/月为自适应宽度可直接定位
    if (viewScope === 'all' && !boardWidth) return

    const scrollKey =
      viewScope === 'all' ? 'all' : `${viewScope}-${format(viewMonth, 'yyyy-MM-dd')}`
    // 每个视图只自动定位一次，避免用户划走后又被拽回今天
    if (autoScrolledForRef.current === scrollKey) return
    autoScrolledForRef.current = scrollKey

    requestAnimationFrame(() => {
      const viewport = scrollRef.current
      const canvas = canvasRef.current
      if (!viewport || !canvas || typeof viewport.scrollTo !== 'function') return
      viewport.scrollTo({
        left: Math.max(
          0,
          (todayLeft / 100) * canvas.getBoundingClientRect().width - viewport.clientWidth / 3,
        ),
        behavior: 'auto',
      })
    })
    // todayLeft 刻意不入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardWidth, todayVisible, viewScope, viewMonth])

  const canvasClassName = [
    'gantt-canvas',
    'zoom-period',
    fitFixed ? 'is-fit' : '',
    fitMonth ? 'is-month' : '',
    fitWeek ? 'is-week' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="gantt-shell" aria-label="家庭计划">
      <div
        className={`gantt-scroll${fitFixed ? ' is-fit' : ''}`}
        ref={scrollRef}
      >
        <div
          ref={canvasRef}
          className={canvasClassName}
          style={boardWidth ? { width: boardWidth } : undefined}
        >
          <div className="gantt-header is-motion" key={`header-${boardMotionKey}`}>
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
            {!fitFixed && (
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
            )}
            <div
              className="period-row"
              style={
                fitWeek
                  ? { ['--period-cols' as string]: 7 }
                  : fitMonth
                    ? { ['--period-cols' as string]: 3 }
                    : undefined
              }
            >
              {periodBlocks.map((block) => (
                <div
                  className="header-block period-block"
                  key={block.key}
                  style={
                    fitFixed
                      ? undefined
                      : { left: `${block.left}%`, width: `${block.width}%` }
                  }
                >
                  {block.label}
                </div>
              ))}
            </div>
          </div>

          <div className="gantt-body is-motion" key={boardMotionKey}>
            <div className="timeline-guides" aria-hidden="true">
              {periodGuides.map((block) => (
                <i
                  className="guide-line"
                  key={block.key}
                  style={{ left: `${block.left}%` }}
                />
              ))}
              {!fitFixed &&
                monthBlocks.map((block) => (
                  <i
                    className="guide-line month-guide"
                    key={`month-${block.key}`}
                    style={{ left: `${block.left}%` }}
                  />
                ))}
            </div>
            {todayVisible && (
              <div
                className={`today-line${todayFlash ? ' is-flash' : ''}`}
                style={{ left: `${todayLeft}%` }}
                aria-hidden="true"
              />
            )}

            {showSkeleton ? (
              <div className="gantt-skeleton" aria-busy="true" aria-label="加载中">
                {Array.from({ length: 5 }, (_, index) => (
                  <div className="gantt-skeleton-lane" key={index}>
                    <span
                      className="gantt-skeleton-bar"
                      style={{
                        left: `${8 + index * 7}%`,
                        width: `${28 + (index % 3) * 12}%`,
                        animationDelay: `${index * 90}ms`,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : visibleGroups.length === 0 ? (
              <div className="gantt-empty">
                <div className="gantt-empty-art is-draw" aria-hidden="true">
                  <span className="gantt-empty-bar is-a" />
                  <span className="gantt-empty-bar is-b" />
                  <span className="gantt-empty-bar is-c" />
                </div>
                <p className="gantt-empty-title">
                  {viewScope === 'week'
                    ? '这周还空着'
                    : viewScope === 'month'
                      ? '这个月还空着'
                      : '还没有安排'}
                </p>
                <p className="gantt-empty-copy">双击时间轴，或点右上角「新增」记一件事</p>
                <button
                  className="button primary-button gantt-empty-action"
                  type="button"
                  onClick={() =>
                    onCreateAt(
                      format(
                        viewScope === 'all' ? today : startOfDay(range.start),
                        'yyyy-MM-dd',
                      ),
                    )
                  }
                >
                  记一件事
                </button>
              </div>
            ) : (
              visibleGroups.map((group) => {
                let stagger = 0
                return (
                  <div className="owner-group" data-owner={group.owner} key={group.owner}>
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
                    {group.tasks.map((task) => {
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
                      const barDelay = Math.min(stagger, 18) * 52
                      stagger += 1
                      const milestoneCenter =
                        task.type === 'milestone'
                          ? (position.left + position.width / 2) * 100
                          : null
                      const labelEnd =
                        task.type === 'milestone' && milestoneCenter !== null
                          ? milestoneCenter > 72
                          : false
                      return (
                        <div
                          className="gantt-lane"
                          key={task.id}
                          onDoubleClick={createFromPointer}
                        >
                          <TaskMarkButton
                            task={task}
                            status={status}
                            progress={progress}
                            categoryLabel={categoryLabel}
                            densityClass={densityClass}
                            clipClass={clipClass}
                            barDelay={barDelay}
                            left={
                              milestoneCenter !== null
                                ? `calc(${milestoneCenter}% - var(--milestone-size) / 2)`
                                : `${position.left * 100}%`
                            }
                            width={
                              task.type === 'milestone'
                                ? undefined
                                : `${position.width * 100}%`
                            }
                            dayWidthPx={dayWidthPx}
                            isEntering={enteringTaskId === task.id}
                            isExiting={exitingTaskIds.includes(task.id)}
                            labelEnd={labelEnd}
                            onEdit={onEdit}
                            onReschedule={onReschedule}
                            onPreview={setPreviewTask}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}

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
              <i className={`legend-icon category-${category.value}`} aria-hidden="true">
                <CategoryIcon category={category.value} />
              </i>
              {category.label}
            </span>
          ))}
          <span className="footer-spacer" />
          <span>图标按分类 · 进度在条上</span>
        </div>
      )}

      {previewTask && (
        <div
          className="task-preview-layer"
          role="presentation"
          onPointerDown={() => setPreviewTask(null)}
        >
          <div
            className={`task-preview-card category-${previewTask.category}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <p className="task-preview-kicker">
              {CATEGORY_LABELS[previewTask.category]} ·{' '}
              {STATUS_LABELS[getTaskStatus(previewTask, today)]}
            </p>
            <h3>{previewTask.title}</h3>
            <p>
              {previewTask.startDate}
              {previewTask.endDate && previewTask.endDate !== previewTask.startDate
                ? ` → ${previewTask.endDate}`
                : previewTask.isOngoing
                  ? ' · 持续'
                  : ''}
            </p>
            <button
              className="button primary-button"
              type="button"
              onClick={() => {
                const task = previewTask
                setPreviewTask(null)
                onEdit(task)
              }}
            >
              编辑
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
