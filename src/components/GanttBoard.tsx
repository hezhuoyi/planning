import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getDate,
  isWithinInterval,
  startOfMonth,
} from 'date-fns'
import { Check } from 'lucide-react'
import { getOwnerGroup, OWNER_GROUPS, type OwnerGroup } from '../domain/owners'
import { getTaskPosition, getTaskStatus, getTimelineRange } from '../domain/timeline'
import type { Task, TaskStatus } from '../domain/types'

interface GanttBoardProps {
  tasks: Task[]
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

const PIXELS_PER_DAY_DESKTOP = 5.2
const PIXELS_PER_DAY_MOBILE = 8
const MIN_BOARD_WIDTH_DESKTOP = 760
const MIN_BOARD_WIDTH_MOBILE = 480

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

export function GanttBoard({
  tasks,
  focusTodayToken,
  onEdit,
  onCreateAt,
}: GanttBoardProps) {
  const today = useMemo(() => new Date(), [])
  const narrow = useNarrowScreen()
  const range = useMemo(() => getTimelineRange(tasks, today), [tasks, today])
  const months = useMemo(() => eachMonthOfInterval(range), [range])
  const totalDays = differenceInCalendarDays(range.end, range.start) + 1
  const pixelsPerDay = narrow ? PIXELS_PER_DAY_MOBILE : PIXELS_PER_DAY_DESKTOP
  const minBoardWidth = narrow ? MIN_BOARD_WIDTH_MOBILE : MIN_BOARD_WIDTH_DESKTOP
  const boardWidth = Math.max(minBoardWidth, Math.round(totalDays * pixelsPerDay))
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const dateToPercent = (date: Date) =>
    (differenceInCalendarDays(date, range.start) / totalDays) * 100

  const monthBlocks = months.map((month) => {
    const monthEnd = endOfMonth(month)
    return {
      key: format(month, 'yyyy-MM'),
      label: `${format(month, 'M')}月`,
      year: format(month, 'yyyy'),
      left: dateToPercent(startOfMonth(month)),
      width:
        ((differenceInCalendarDays(monthEnd, startOfMonth(month)) + 1) / totalDays) * 100,
      month,
    }
  })

  const yearBlocks = Array.from(new Set(monthBlocks.map((block) => block.year))).map((year) => {
    const blocks = monthBlocks.filter((block) => block.year === year)
    return {
      year,
      left: blocks[0].left,
      width: blocks.reduce((sum, block) => sum + block.width, 0),
    }
  })

  const periodBlocks = monthBlocks.flatMap((block) => {
    const lastDay = getDate(endOfMonth(block.month))
    return [
      { label: '上', start: 1, length: 10 },
      { label: '中', start: 11, length: 10 },
      { label: '下', start: 21, length: lastDay - 20 },
    ].map((period) => ({
      key: `${block.key}-${period.label}`,
      label: period.label,
      left: dateToPercent(new Date(block.month.getFullYear(), block.month.getMonth(), period.start)),
      width: (period.length / totalDays) * 100,
    }))
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
      if (!viewport || !canvas) return
      viewport.scrollTo({
        left: Math.max(0, (todayLeft / 100) * canvas.getBoundingClientRect().width - viewport.clientWidth / 2),
        behavior: 'smooth',
      })
    })
  }, [boardWidth, focusTodayToken, todayLeft, todayVisible])

  return (
    <section className="gantt-shell" aria-label="家庭计划">
      <div className="gantt-scroll" ref={scrollRef}>
        <div ref={canvasRef} className="gantt-canvas zoom-period" style={{ width: boardWidth }}>
          <div className="gantt-header">
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
              <div className="today-line" style={{ left: `${todayLeft}%` }} aria-label="今天">
                <span>今天</span>
              </div>
            )}

            {groupedTasks.map((group) => (
              <div className="owner-group" key={group.owner}>
                <div className="owner-group-label" aria-label={`负责人 ${group.owner}`}>
                  <span>{group.owner}</span>
                </div>
                {group.tasks.map((task) => {
                  const position = getTaskPosition(task, range)
                  const status = getTaskStatus(task, today)
                  return (
                    <div className="gantt-lane" key={task.id} onDoubleClick={createFromPointer}>
                      <button
                        type="button"
                        className={`task-mark category-${task.category} status-${status} ${task.type}`}
                        style={{
                          left: `${position.left * 100}%`,
                          width: task.type === 'milestone' ? undefined : `${position.width * 100}%`,
                        }}
                        aria-label={`编辑 ${task.title}，${STATUS_LABELS[status]}`}
                        onClick={() => onEdit(task)}
                      >
                        {status === 'completed' && <Check size={14} aria-hidden="true" />}
                        {task.type === 'milestone' ? (
                          <span className="milestone-label">
                            <span>{task.title}</span>
                          </span>
                        ) : (
                          <span className="task-label">
                            <span>{task.title}</span>
                          </span>
                        )}
                        {task.isOngoing && <span className="ongoing-edge" aria-hidden="true" />}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}

            <button
              className="quick-lane"
              type="button"
              onDoubleClick={createFromPointer}
              aria-label="双击时间轴创建事项"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
