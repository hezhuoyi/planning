import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { addMonths, addWeeks, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  LocateFixed,
  Plus,
} from 'lucide-react'
import './App.css'
import { GanttBoard } from './components/GanttBoard'
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
    window.setTimeout(() => setToast(null), 1800)
  }

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
    (!unlocked || syncState === 'offline' || syncState === 'error')

  return (
    <main className="app-shell">
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
            <p>
              {format(today, 'M月d日')}
              {unlocked && syncState !== 'offline' && syncState !== 'error'
                ? ' · 已同步'
                : ''}
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
              {unlocked && (syncState === 'offline' || syncState === 'error') ? (
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
          <div className="summary-switch" role="tablist" aria-label="时间轴范围">
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
              <strong>
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
              <strong>{format(viewMonth, 'yyyy年M月')}</strong>
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
              <strong>{allRangeLabel}</strong>
              <span className="month-nav-spacer" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="summary-copy">
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
        onEdit={openEditTask}
        onCreateAt={openNewTask}
      />

      {taskDialogOpen && (
        <TaskDialog
          task={editingTask}
          initialDate={dialogDate}
          nextSortOrder={nextSortOrder}
          onClose={() => setTaskDialogOpen(false)}
          onSave={(task) => {
            void saveTask(task)
            const justCompleted = Boolean(task.completedAt) && !editingTask?.completedAt
            showToast(
              justCompleted ? '完成啦' : editingTask ? '已更新安排' : '记好啦',
            )
          }}
          onDelete={(id) => {
            void deleteTask(id)
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
          <button className="toast" type="button" onClick={() => setToast(null)}>
            {toast}
          </button>,
          document.body,
        )}
    </main>
  )
}

export default App
