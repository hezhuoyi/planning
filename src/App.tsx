import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { addMonths, format, startOfMonth } from 'date-fns'
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
import { getPlanSummary, type SummaryScope } from './domain/timeline'
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
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [dialogDate, setDialogDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const today = useMemo(() => new Date(), [])
  const summary = useMemo(
    () => getPlanSummary(tasks, today, viewScope, viewMonth),
    [tasks, today, viewMonth, viewScope],
  )

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
    (!unlocked ||
      syncState === 'connecting' ||
      syncState === 'offline' ||
      syncState === 'error')

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
              {unlocked && syncState === 'synced' ? ' · 已同步' : ''}
            </p>
          </div>
        </button>

        <div className="primary-actions">
          <button
            className="button today-button"
            type="button"
            onClick={() => {
              setViewMonth(startOfMonth(new Date()))
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
              aria-selected={viewScope === 'month'}
              className={viewScope === 'month' ? 'active' : ''}
              onClick={() => setViewScope('month')}
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
        </div>

        <div className="summary-copy">
          <p className="summary-kicker">{summary.kicker}</p>
          <h2>{summary.headline}</h2>
          <p>{summary.detail}</p>
        </div>
      </section>

      <GanttBoard
        tasks={tasks}
        viewScope={viewScope}
        viewMonth={viewMonth}
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
            showToast(editingTask ? '已更新安排' : '记好啦')
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
