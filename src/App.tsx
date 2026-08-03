import { useState } from 'react'
import { format } from 'date-fns'
import {
  CalendarDays,
  Cloud,
  CloudOff,
  LocateFixed,
  Plus,
} from 'lucide-react'
import './App.css'
import { GanttBoard } from './components/GanttBoard'
import { SyncDialog } from './components/SyncDialog'
import { TaskDialog } from './components/TaskDialog'
import type { Task } from './domain/types'
import { useTaskStore, type SyncState } from './hooks/useTaskStore'

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
  const [focusTodayToken, setFocusTodayToken] = useState(0)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [dialogDate, setDialogDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)

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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <CalendarDays size={19} />
          </span>
          <div>
            <h1>Planning</h1>
            <p>{format(new Date(), 'yyyy年M月d日')}</p>
          </div>
        </div>

        <div className="primary-actions">
          <button
            className="button today-button"
            type="button"
            onClick={() => setFocusTodayToken((value) => value + 1)}
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
        </div>
      </header>

      <section className="workspace-bar" aria-label="视图工具">
        <div className="view-heading">
          <strong>生活时间轴</strong>
          <span>{tasks.length} 项</span>
        </div>

        <div className="toolbar">
          {isConfigured && (
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
              <span className="sync-label">{syncLabel}</span>
            </button>
          )}
        </div>
      </section>

      <GanttBoard
        tasks={tasks}
        focusTodayToken={focusTodayToken}
        onEdit={openEditTask}
        onCreateAt={openNewTask}
      />

      <footer className="status-legend" aria-label="任务状态图例">
        <span><i className="legend-dot status-not-started" />未开始</span>
        <span><i className="legend-dot status-in-progress" />进行中</span>
        <span><i className="legend-dot status-ongoing" />持续</span>
        <span><i className="legend-dot status-overdue" />已逾期</span>
        <span><i className="legend-dot status-completed" />已完成</span>
        <span className="footer-spacer" />
        <span>数据范围随事项自动延伸</span>
      </footer>

      {taskDialogOpen && (
        <TaskDialog
          task={editingTask}
          initialDate={dialogDate}
          nextSortOrder={nextSortOrder}
          onClose={() => setTaskDialogOpen(false)}
          onSave={(task) => {
            void saveTask(task)
            setTaskDialogOpen(false)
          }}
          onDelete={(id) => {
            void deleteTask(id)
            setTaskDialogOpen(false)
          }}
        />
      )}

      {syncDialogOpen && isConfigured && (
        <SyncDialog
          unlocked={unlocked}
          syncError={syncError}
          onClose={() => setSyncDialogOpen(false)}
          onUnlock={unlockWithPasscode}
          onLock={lockSync}
        />
      )}
    </main>
  )
}

export default App
