import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { addMonths, addWeeks, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  LoaderCircle,
  LocateFixed,
  Plus,
} from 'lucide-react'
import './App.css'
import { GanttBoard } from './components/GanttBoard'
import { MonthNavPicker } from './components/MonthNavPicker'
import { SyncDialog } from './components/SyncDialog'
import { TaskDialog } from './components/TaskDialog'
import { getPlanSummary, getTimelineRange, type SummaryScope } from './domain/timeline'
import type { Task } from './domain/types'
import { useTaskStore, type SyncState } from './hooks/useTaskStore'
import { useTheme } from './hooks/useTheme'

const SYNC_LABELS: Record<SyncState, string> = {
  local: '同步',
  connecting: '同步中',
  synced: '已同步',
  offline: '离线',
  error: '同步异常',
}

const CONFETTI_COLORS = [
  'var(--primary)',
  'var(--accent)',
  'var(--cat-growth)',
  'var(--cat-home)',
  'var(--cat-travel)',
  'var(--cat-career)',
]

const CONFETTI_PIECES = Array.from({ length: 32 }, (_, index) => {
  const column = index % 16
  const row = Math.floor(index / 16)
  return {
    id: index,
    x: `${6 + column * 5.8 + (row % 2) * 2.4}%`,
    delay: `${index * 16}ms`,
    duration: `${1.15 + (index % 5) * 0.12}s`,
    dx: `${(index % 2 === 0 ? -1 : 1) * (12 + (index % 7) * 8)}px`,
    spin: `${(index % 2 === 0 ? 1 : -1) * (540 + (index % 6) * 90)}deg`,
    width: `${6 + (index % 4)}px`,
    height: `${9 + (index % 5)}px`,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    shape: index % 5 === 0 ? 'round' : index % 3 === 0 ? 'strip' : 'rect',
  }
})

const THEME_PARTICLES = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 17) % 84)}%`,
  delay: `${index * 0.45}s`,
  duration: `${7 + (index % 5)}s`,
  size: `${4 + (index % 4)}px`,
}))

function formatAllRangeLabel(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameYear && start.getMonth() === end.getMonth()) {
    return format(start, 'yyyy年M月')
  }
  if (sameYear) {
    return `${format(start, 'yyyy年M月')}–${format(end, 'M月')}`
  }
  return `${format(start, 'yyyy年M月')}–${format(end, 'yyyy年M月')}`
}

function App() {
  const {
    tasks,
    saveTask,
    deleteTask,
    unlocked,
    syncState,
    syncError,
    isConfigured,
    unlockWithPasscode,
    lockSync,
    isHydrating,
  } = useTaskStore()
  const { themeId, setTheme } = useTheme()
  const [focusTodayToken, setFocusTodayToken] = useState(0)
  const [viewScope, setViewScope] = useState<SummaryScope>('month')
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()))
  const [viewWeek, setViewWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [dialogDate, setDialogDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [confettiKey, setConfettiKey] = useState<number | null>(null)
  const [enteringTaskId, setEnteringTaskId] = useState<string | null>(null)
  const [exitingTaskIds, setExitingTaskIds] = useState<string[]>([])
  const toastTimerRef = useRef<number | null>(null)
  const deleteTimersRef = useRef<Map<string, number>>(new Map())
  const confettiTimerRef = useRef<number | null>(null)
  const enterTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const toastTimer = toastTimerRef
    const confettiTimer = confettiTimerRef
    const enterTimer = enterTimerRef
    const deleteTimers = deleteTimersRef
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      if (confettiTimer.current !== null) window.clearTimeout(confettiTimer.current)
      if (enterTimer.current !== null) window.clearTimeout(enterTimer.current)
      deleteTimers.current.forEach((timer) => window.clearTimeout(timer))
      deleteTimers.current.clear()
    }
  }, [])

  const today = useMemo(() => new Date(), [])
  const viewAnchor = viewScope === 'week' ? viewWeek : viewMonth
  const summary = useMemo(
    () => getPlanSummary(tasks, today, viewScope, viewAnchor),
    [tasks, today, viewAnchor, viewScope],
  )
  const allRangeLabel = useMemo(() => {
    const range = getTimelineRange(tasks, today, 'all')
    return formatAllRangeLabel(range.start, range.end)
  }, [tasks, today])

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null
      setToast(null)
    }, 1800)
  }

  const burstConfetti = () => {
    const key = Date.now()
    setConfettiKey(key)
    if (confettiTimerRef.current !== null) window.clearTimeout(confettiTimerRef.current)
    confettiTimerRef.current = window.setTimeout(() => {
      confettiTimerRef.current = null
      setConfettiKey((current) => (current === key ? null : current))
    }, 1700)
  }

  const showSkeleton =
    isHydrating || (unlocked && syncState === 'connecting' && tasks.length === 0)

  const syncStatusClass =
    unlocked && syncState === 'connecting'
      ? 'is-syncing'
      : unlocked && syncState === 'synced'
        ? 'is-synced'
        : unlocked && (syncState === 'offline' || syncState === 'error')
          ? 'is-sync-bad'
          : ''

  const openNewTask = (date = format(new Date(), 'yyyy-MM-dd')) => {
    setEditingTask(null)
    setDialogDate(date)
    setTaskDialogOpen(true)
  }

  const openEditTask = (task: Task) => {
    setEditingTask(task)
    setDialogDate(task.startDate)
    setTaskDialogOpen(true)
  }

  const nextSortOrder = Math.max(0, ...tasks.map((task) => task.sortOrder)) + 10
  const syncLabel = unlocked ? SYNC_LABELS[syncState] : SYNC_LABELS.local
  const needsSyncAttention =
    isConfigured &&
    (!unlocked || syncState === 'offline' || syncState === 'error' || syncState === 'connecting')

  return (
    <main className="app-shell">
      <div className="theme-particles" aria-hidden="true">
        {THEME_PARTICLES.map((particle) => (
          <span
            key={particle.id}
            className="theme-particle"
            style={
              {
                left: particle.left,
                width: particle.size,
                height: particle.size,
                animationDelay: particle.delay,
                animationDuration: particle.duration,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <header className="topbar">
        <button
          type="button"
          className="brand brand-button"
          onClick={() => setSyncDialogOpen(true)}
          aria-label={
            isConfigured
              ? unlocked
                ? '打开设置与云同步'
                : '打开设置，输入口令开启云同步'
              : '打开外观设置'
          }
        >
          <span className="brand-mark" aria-hidden="true">
            <CalendarDays size={18} />
          </span>
          <div>
            <h1>Planning</h1>
            <p className={`brand-status ${syncStatusClass}`}>
              {format(today, 'M月d日')}
              {unlocked && syncState === 'connecting'
                ? ' · 同步中'
                : unlocked && syncState !== 'offline' && syncState !== 'error'
                  ? ' · 已同步'
                  : unlocked
                    ? ` · ${syncLabel}`
                    : ''}
              {unlocked && syncState === 'synced' ? (
                <Check size={12} className="brand-sync-check" aria-hidden="true" />
              ) : null}
            </p>
          </div>
        </button>

        <div className="primary-actions">
          <button
            className="button today-button"
            type="button"
            onClick={() => {
              const now = new Date()
              setViewMonth(startOfMonth(now))
              setViewWeek(startOfWeek(now, { weekStartsOn: 1 }))
              setFocusTodayToken((value) => value + 1)
            }}
            aria-label="定位到今天"
          >
            <LocateFixed size={16} aria-hidden="true" />
            <span className="button-label">今天</span>
          </button>
          <button
            className="button primary-button"
            type="button"
            onClick={() => openNewTask()}
            aria-label="新增事项"
          >
            <Plus size={17} aria-hidden="true" />
            <span className="button-label">新增</span>
          </button>
          {needsSyncAttention && (
            <button
              className={`sync-button state-${unlocked ? syncState : 'local'}`}
              type="button"
              onClick={() => setSyncDialogOpen(true)}
              title={unlocked ? syncLabel : '输入口令开启云同步'}
            >
              {unlocked && syncState === 'connecting' ? (
                <LoaderCircle size={15} className="sync-spin" aria-hidden="true" />
              ) : unlocked && (syncState === 'offline' || syncState === 'error') ? (
                <CloudOff size={15} aria-hidden="true" />
              ) : (
                <Cloud size={15} aria-hidden="true" />
              )}
              <span className="sync-label">{unlocked ? syncLabel : '口令'}</span>
            </button>
          )}
        </div>
      </header>

      <section className="plan-summary" aria-label="计划概览">
        <div className="summary-toolbar">
          <div
            className="summary-switch"
            role="tablist"
            aria-label="时间轴范围"
            data-scope={viewScope}
          >
            <span className="summary-switch-pill" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={viewScope === 'week'}
              className={viewScope === 'week' ? 'active' : ''}
              onClick={() => {
                setViewScope('week')
                setViewWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))
              }}
            >
              周
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewScope === 'month'}
              className={viewScope === 'month' ? 'active' : ''}
              onClick={() => {
                setViewScope('month')
                setViewMonth(startOfMonth(new Date()))
              }}
            >
              月
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewScope === 'all'}
              className={viewScope === 'all' ? 'active' : ''}
              onClick={() => setViewScope('all')}
            >
              全部
            </button>
          </div>

          {viewScope === 'week' && (
            <div className="month-nav" aria-label="切换周">
              <button
                type="button"
                className="icon-button"
                aria-label="上一周"
                onClick={() =>
                  setViewWeek((week) => startOfWeek(addWeeks(week, -1), { weekStartsOn: 1 }))
                }
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <strong className="month-nav-label">
                {format(viewWeek, 'M月d日')}
                –
                {format(endOfWeek(viewWeek, { weekStartsOn: 1 }), 'M月d日')}
              </strong>
              <button
                type="button"
                className="icon-button"
                aria-label="下一周"
                onClick={() =>
                  setViewWeek((week) => startOfWeek(addWeeks(week, 1), { weekStartsOn: 1 }))
                }
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {viewScope === 'month' && (
            <div className="month-nav" aria-label="切换月份">
              <button
                type="button"
                className="icon-button"
                aria-label="上个月"
                onClick={() => setViewMonth((month) => startOfMonth(addMonths(month, -1)))}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <MonthNavPicker value={viewMonth} onChange={setViewMonth} />
              <button
                type="button"
                className="icon-button"
                aria-label="下个月"
                onClick={() => setViewMonth((month) => startOfMonth(addMonths(month, 1)))}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {viewScope === 'all' && (
            <div className="month-nav is-readonly" aria-label="整体时间范围">
              <span className="month-nav-spacer" aria-hidden="true" />
              <strong className="month-nav-label">{allRangeLabel}</strong>
              <span className="month-nav-spacer" aria-hidden="true" />
            </div>
          )}
        </div>

        <div
          className="summary-copy"
          key={`${viewScope}-${format(viewAnchor, 'yyyy-MM-dd')}`}
        >
          <p className="summary-kicker">{summary.kicker}</p>
          <div className="summary-main">
            <h2>{summary.headline}</h2>
            {summary.total > 0 &&
              (summary.inFlight > 0 ||
                summary.upcoming > 0 ||
                summary.overdue > 0 ||
                summary.completed > 0) && (
                <ul className="summary-stats" aria-label="状态速览">
                  {summary.inFlight > 0 && (
                    <li className="is-progress">
                      <i aria-hidden="true" />
                      {summary.inFlight} 进行中
                    </li>
                  )}
                  {summary.upcoming > 0 && (
                    <li className="is-upcoming">
                      <i aria-hidden="true" />
                      {summary.upcoming} 待开始
                    </li>
                  )}
                  {summary.overdue > 0 && (
                    <li className="is-overdue">
                      <i aria-hidden="true" />
                      {summary.overdue} 已逾期
                    </li>
                  )}
                  {summary.completed > 0 && (
                    <li className="is-done">
                      <i aria-hidden="true" />
                      {summary.completed} 已完成
                    </li>
                  )}
                </ul>
              )}
          </div>
          {summary.detail ? <p>{summary.detail}</p> : null}
        </div>
      </section>

      <GanttBoard
        tasks={tasks}
        viewScope={viewScope}
        viewMonth={viewAnchor}
        focusTodayToken={focusTodayToken}
        enteringTaskId={enteringTaskId}
        exitingTaskIds={exitingTaskIds}
        showSkeleton={showSkeleton}
        onEdit={openEditTask}
        onCreateAt={openNewTask}
        onReschedule={(task) => {
          void saveTask(task)
          showToast('已调整日期')
        }}
      />

      {taskDialogOpen && (
        <TaskDialog
          task={editingTask}
          initialDate={dialogDate}
          nextSortOrder={nextSortOrder}
          onClose={() => setTaskDialogOpen(false)}
          onSave={(task) => {
            const isNew = !editingTask
            void saveTask(task)
            const justCompleted = Boolean(task.completedAt) && !editingTask?.completedAt
            if (justCompleted) burstConfetti()
            if (isNew) {
              setEnteringTaskId(task.id)
              if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current)
              enterTimerRef.current = window.setTimeout(() => {
                enterTimerRef.current = null
                setEnteringTaskId((current) => (current === task.id ? null : current))
              }, 700)
            }
            showToast(
              justCompleted ? '完成啦' : editingTask ? '已更新安排' : '记好啦',
            )
          }}
          onDelete={(id) => {
            if (deleteTimersRef.current.has(id)) return
            setExitingTaskIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
            const timer = window.setTimeout(() => {
              deleteTimersRef.current.delete(id)
              void deleteTask(id)
              setExitingTaskIds((ids) => ids.filter((item) => item !== id))
            }, 360)
            deleteTimersRef.current.set(id, timer)
            showToast('已删除')
          }}
        />
      )}

      {syncDialogOpen && (
        <SyncDialog
          unlocked={unlocked}
          syncConfigured={isConfigured}
          syncError={syncError}
          themeId={themeId}
          onThemeChange={(id) => {
            setTheme(id)
            showToast('主题已切换')
          }}
          onClose={() => setSyncDialogOpen(false)}
          onUnlock={(passcode) => {
            unlockWithPasscode(passcode)
            showToast('已解锁，开始同步')
          }}
          onLock={() => {
            lockSync()
            showToast('已锁定')
          }}
        />
      )}

      {toast &&
        createPortal(
          <button
            className={`toast${toast === '完成啦' ? ' is-celebrate' : ''}`}
            type="button"
            onClick={() => setToast(null)}
          >
            {toast}
          </button>,
          document.body,
        )}

      {confettiKey !== null &&
        createPortal(
          <div className="confetti-layer" key={confettiKey} aria-hidden="true">
            {CONFETTI_PIECES.map((piece) => (
              <span
                key={piece.id}
                className={`confetti-piece${
                  piece.shape === 'round'
                    ? ' is-round'
                    : piece.shape === 'strip'
                      ? ' is-strip'
                      : ''
                }`}
                style={
                  {
                    '--x': piece.x,
                    '--delay': piece.delay,
                    '--dur': piece.duration,
                    '--dx': piece.dx,
                    '--spin': piece.spin,
                    '--w': piece.width,
                    '--h': piece.height,
                    '--c': piece.color,
                  } as CSSProperties
                }
              />
            ))}
          </div>,
          document.body,
        )}
    </main>
  )
}

export default App
