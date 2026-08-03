import { useEffect, useState } from 'react'
import { Check, Flag, Save, Trash2, X } from 'lucide-react'
import type { Task, TaskCategory, TaskType } from '../domain/types'

interface TaskDialogProps {
  task: Task | null
  initialDate: string
  nextSortOrder: number
  onClose: () => void
  onSave: (task: Task) => void
  onDelete: (id: string) => void
}

const categories: Array<{ value: TaskCategory; label: string }> = [
  { value: 'health', label: '健康' },
  { value: 'growth', label: '成长' },
  { value: 'career', label: '事业' },
  { value: 'home', label: '生活规划' },
  { value: 'travel', label: '出行' },
]

function makeDraft(task: Task | null, initialDate: string, nextSortOrder: number): Task {
  const now = new Date().toISOString()
  return (
    task ?? {
      id: crypto.randomUUID(),
      title: '',
      startDate: initialDate,
      endDate: initialDate,
      owner: null,
      category: 'growth',
      type: 'range',
      isOngoing: false,
      completedAt: null,
      sortOrder: nextSortOrder,
      createdAt: now,
      updatedAt: now,
    }
  )
}

export function TaskDialog({
  task,
  initialDate,
  nextSortOrder,
  onClose,
  onSave,
  onDelete,
}: TaskDialogProps) {
  const [draft, setDraft] = useState(() => makeDraft(task, initialDate, nextSortOrder))
  const [error, setError] = useState('')

  useEffect(() => {
    setDraft(makeDraft(task, initialDate, nextSortOrder))
    setError('')
  }, [initialDate, nextSortOrder, task])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const setType = (type: TaskType) => {
    setDraft((current) => ({
      ...current,
      type,
      isOngoing: type === 'milestone' ? false : current.isOngoing,
      endDate: type === 'milestone' ? current.startDate : current.endDate,
    }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) {
      setError('请输入任务名称')
      return
    }
    if (draft.type === 'range' && !draft.isOngoing && !draft.endDate) {
      setError('请设置结束日期')
      return
    }
    if (!draft.isOngoing && draft.endDate && draft.endDate < draft.startDate) {
      setError('结束日期不能早于开始日期')
      return
    }

    onSave({
      ...draft,
      title: draft.title.trim(),
      owner: draft.owner?.trim() || null,
      endDate: draft.isOngoing ? null : draft.type === 'milestone' ? draft.startDate : draft.endDate,
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <dialog
        open
        className="task-dialog"
        aria-labelledby="task-dialog-title"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <p className="eyebrow">事项</p>
            <h2 id="task-dialog-title">{task ? '编辑事项' : '新增事项'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit}>
          <label className="field full-field">
            <span>任务名称</span>
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="例如：准备三亚行程"
            />
          </label>

          <div className="mode-switch" aria-label="事项类型">
            <button
              type="button"
              className={draft.type === 'range' ? 'active' : ''}
              aria-pressed={draft.type === 'range'}
              onClick={() => setType('range')}
            >
              <Flag size={15} aria-hidden="true" />持续事项
            </button>
            <button
              type="button"
              className={draft.type === 'milestone' ? 'active' : ''}
              aria-pressed={draft.type === 'milestone'}
              onClick={() => setType('milestone')}
            >
              <Check size={15} aria-hidden="true" />单点事项
            </button>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>开始日期</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    startDate: event.target.value,
                    endDate: draft.type === 'milestone' ? event.target.value : draft.endDate,
                  })
                }
              />
            </label>
            <label className="field">
              <span>结束日期</span>
              <input
                type="date"
                value={draft.endDate ?? ''}
                disabled={draft.isOngoing || draft.type === 'milestone'}
                onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
              />
            </label>
            <label className="field">
              <span>负责人</span>
              <input
                value={draft.owner ?? ''}
                onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
                placeholder="选填"
              />
            </label>
            <label className="field">
              <span>分类</span>
              <select
                value={draft.category}
                onChange={(event) =>
                  setDraft({ ...draft, category: event.target.value as TaskCategory })
                }
              >
                {categories.map((category) => (
                  <option value={category.value} key={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {draft.type === 'range' && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={draft.isOngoing}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    isOngoing: event.target.checked,
                    endDate: event.target.checked ? null : draft.startDate,
                  })
                }
              />
              <span>持续进行，暂不设置结束日期</span>
            </label>
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={Boolean(draft.completedAt)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  completedAt: event.target.checked ? new Date().toISOString() : null,
                })
              }
            />
            <span>已完成</span>
          </label>

          {error && <p className="form-error">{error}</p>}

          <footer className="dialog-actions">
            {task && (
              <button
                className="button danger-button"
                type="button"
                onClick={() => {
                  if (window.confirm(`删除“${task.title}”？`)) onDelete(task.id)
                }}
              >
                <Trash2 size={16} aria-hidden="true" />删除
              </button>
            )}
            <span className="action-spacer" />
            <button className="button" type="button" onClick={onClose}>
              取消
            </button>
            <button className="button primary-button" type="submit">
              <Save size={16} aria-hidden="true" />保存
            </button>
          </footer>
        </form>
      </dialog>
    </div>
  )
}
