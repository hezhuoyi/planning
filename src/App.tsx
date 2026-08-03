import { useRef, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import {
  CalendarDays,
  Cloud,
  CloudOff,
  Download,
  LocateFixed,
  Plus,
  Upload,
} from 'lucide-react'
import './App.css'
import { GanttBoard, type ZoomLevel } from './components/GanttBoard'
import { SyncDialog } from './components/SyncDialog'
import { TaskDialog } from './components/TaskDialog'
import type { Task } from './domain/types'
import { useTaskStore, type SyncState } from './hooks/useTaskStore'

const SYNC_LABELS: Record<SyncState, string> = {
  local: '仅本机',
  connecting: '连接中',
  synced: '已同步',
  offline: '离线',
  error: '同步异常',
}

const ZOOM_OPTIONS: Array<{ value: ZoomLevel; label: string }> = [
  { value: 'period', label: '旬' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false
  const task = value as Partial<Task>
  return Boolean(
    task.id &&
      task.title &&
      task.startDate &&
      task.category &&
      task.type &&
      typeof task.sortOrder === 'number',
  )
}

function App() {
  const {
    tasks,
    saveTask,
    deleteTask,
    importTasks,
    session,
    syncState,
    syncError,
    isConfigured,
    sendMagicLink,
    signOut,
  } = useTaskStore()
  const [zoom, setZoom] = useState<ZoomLevel>('period')
  const [focusTodayToken, setFocusTodayToken] = useState(0)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [dialogDate, setDialogDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

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

  const shiftTask = (task: Task, days: number) => {
    void saveTask({
      ...task,
      startDate: format(addDays(parseISO(task.startDate), days), 'yyyy-MM-dd'),
      endDate: task.endDate
        ? format(addDays(parseISO(task.endDate), days), 'yyyy-MM-dd')
        : null,
      updatedAt: new Date().toISOString(),
    })
  }

  const exportTasks = () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `planning-${format(new Date(), 'yyyy-MM-dd')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setNotice('备份已导出')
  }

  const importBackup = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!Array.isArray(parsed) || !parsed.every(isTask)) throw new Error('备份格式不正确')
      await importTasks(parsed)
      setNotice(`已导入 ${parsed.length} 项`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导入失败')
    }
  }

  const nextSortOrder = Math.max(0, ...tasks.map((task) => task.sortOrder)) + 10

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
          <button className="button today-button" type="button" onClick={() => setFocusTodayToken((value) => value + 1)}>
            <LocateFixed size={16} aria-hidden="true" />今天
          </button>
          <button className="button primary-button" type="button" onClick={() => openNewTask()}>
            <Plus size={17} aria-hidden="true" />新增事项
          </button>
        </div>
      </header>

      <section className="workspace-bar" aria-label="视图工具">
        <div className="view-heading">
          <strong>生活时间轴</strong>
          <span>{tasks.length} 项</span>
        </div>

        <div className="toolbar">
          <div className="zoom-switch" aria-label="时间粒度">
            {ZOOM_OPTIONS.map((option) => (
              <button
                type="button"
                className={zoom === option.value ? 'active' : ''}
                aria-pressed={zoom === option.value}
                key={option.value}
                onClick={() => setZoom(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <span className="toolbar-divider" />
          <button className="icon-button" type="button" onClick={exportTasks} aria-label="导出备份" title="导出备份">
            <Download aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => importRef.current?.click()} aria-label="导入备份" title="导入备份">
            <Upload aria-hidden="true" />
          </button>
          <input
            ref={importRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importBackup(file)
              event.target.value = ''
            }}
          />
          <button
            className={`sync-button state-${syncState}`}
            type="button"
            onClick={() => setSyncDialogOpen(true)}
          >
            {syncState === 'offline' || syncState === 'error' ? (
              <CloudOff size={15} aria-hidden="true" />
            ) : (
              <Cloud size={15} aria-hidden="true" />
            )}
            {SYNC_LABELS[syncState]}
          </button>
        </div>
      </section>

      <GanttBoard
        tasks={tasks}
        zoom={zoom}
        focusTodayToken={focusTodayToken}
        onEdit={openEditTask}
        onCreateAt={openNewTask}
        onShift={shiftTask}
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

      {notice && (
        <button className="toast" type="button" onClick={() => setNotice('')} aria-live="polite">
          {notice}
        </button>
      )}

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

      {syncDialogOpen && (
        <SyncDialog
          session={session}
          isConfigured={isConfigured}
          syncError={syncError}
          onClose={() => setSyncDialogOpen(false)}
          onSendMagicLink={sendMagicLink}
          onSignOut={signOut}
        />
      )}
    </main>
  )
}

export default App
