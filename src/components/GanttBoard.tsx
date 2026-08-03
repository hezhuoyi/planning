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
import { Check, MoveHorizontal } from 'lucide-react'
import { getTaskPosition, getTaskStatus, getTimelineRange } from '../domain/timeline'
import type { Task, TaskStatus } from '../domain/types'

export type ZoomLevel = 'period' | 'month' | 'year'

interface GanttBoardProps {
  tasks: Task[]
  zoom: ZoomLevel
  focusTodayToken: number
  onEdit: (task: Task) => void
  onCreateAt: (date: string) => void
  onShift: (task: Task, days: number) => void
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  ongoing: '持续',
  overdue: '已逾期',
  completed: '已完成',
}

const PIXELS_PER_DAY: Record<ZoomLevel, number> = {
  period: 5.2,
  month: 3.2,
  year: 1.45,
}

const MIN_BOARD_WIDTH: Record<ZoomLevel, number> = {
  period: 760,
  month: 620,
  year: 360,
}

export function GanttBoard({
  tasks,
  zoom,
  focusTodayToken,
  onEdit,
  onCreateAt,
  onShift,
}: GanttBoardProps) {
  const today = useMemo(() => new Date(), [])
  const range = useMemo(() => getTimelineRange(tasks, today), [tasks, today])
  const months = useMemo(() => eachMonthOfInterval(range), [range])
  const totalDays = differenceInCalendarDays(range.end, range.start) + 1
  const boardWidth = Math.max(MIN_BOARD_WIDTH[zoom], Math.round(totalDays * PIXELS_PER_DAY[zoom]))
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const movedRef = useRef(false)
  const [drag, setDrag] = useState<{ id: string; originX: number; days: number } | null>(null)

  const dateToPercent = (date: Date) =>
    (differenceInCalendarDays(date, range.start) / totalDays) * 100

  const monthBlocks = months.map((month) => {
    const monthEnd = endOfMonth(month)
    return {
      key: format(month, 'yyyy-MM'),
      label: `${getDate(month) === 1 ? format(month, 'M') : format(month, 'M')}月`,
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

  const createFromPointer = (event: React.MouseEvent<HTMLElement>) => {
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    onCreateAt(format(addDays(range.start, Math.floor(ratio * totalDays)), 'yyyy-MM-dd'))
  }

  const beginDrag = (event: React.PointerEvent<HTMLButtonElement>, task: Task) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    movedRef.current = false
    setDrag({ id: task.id, originX: event.clientX, days: 0 })
  }

  const updateDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    const pixelsPerDay = (canvasRef.current?.getBoundingClientRect().width ?? boardWidth) / totalDays
    const days = Math.round((event.clientX - drag.originX) / pixelsPerDay)
    if (Math.abs(event.clientX - drag.originX) > 4) movedRef.current = true
    setDrag({ ...drag, days })
  }

  const finishDrag = (task: Task) => {
    if (drag?.id === task.id && drag.days !== 0) onShift(task, drag.days)
    setDrag(null)
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
    <section className="gantt-shell" aria-label="家庭生活时间轴">
      <div className="gantt-scroll" ref={scrollRef}>
        <div ref={canvasRef} className={`gantt-canvas zoom-${zoom}`} style={{ width: boardWidth }}>
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
            {zoom === 'period' && (
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
            )}
          </div>

          <div className="gantt-body">
            <div className="timeline-guides" aria-hidden="true">
              {(zoom === 'period' ? periodBlocks : monthBlocks).map((block) => (
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

            {tasks.map((task) => {
              const position = getTaskPosition(task, range)
              const status = getTaskStatus(task, today)
              const dragDays = drag?.id === task.id ? drag.days : 0
              return (
                <div className="gantt-lane" key={task.id} onDoubleClick={createFromPointer}>
                  <button
                    type="button"
                    className={`task-mark category-${task.category} status-${status} ${task.type}`}
                    style={{
                      left: `${position.left * 100}%`,
                      width: task.type === 'milestone' ? undefined : `${position.width * 100}%`,
                      transform: `translateX(${
                        dragDays * ((canvasRef.current?.getBoundingClientRect().width ?? boardWidth) / totalDays)
                      }px)`,
                    }}
                    aria-label={`编辑 ${task.title}，${STATUS_LABELS[status]}`}
                    onClick={() => {
                      if (!movedRef.current) onEdit(task)
                      movedRef.current = false
                    }}
                    onPointerDown={(event) => beginDrag(event, task)}
                    onPointerMove={updateDrag}
                    onPointerUp={() => finishDrag(task)}
                  >
                    {status === 'completed' && <Check size={14} aria-hidden="true" />}
                    {task.type === 'milestone' ? (
                      <span className="milestone-label">
                        <span>{task.title}</span>
                        {task.owner && <small>· {task.owner}</small>}
                      </span>
                    ) : (
                      <span className="task-label">
                        <span>{task.title}</span>
                        {task.owner && <small>· {task.owner}</small>}
                      </span>
                    )}
                    {task.isOngoing && <span className="ongoing-edge" aria-hidden="true" />}
                    <MoveHorizontal className="drag-hint" size={13} aria-hidden="true" />
                  </button>
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
    </section>
  )
}
