import { useEffect, useState } from 'react'
import { Check, Flag, Save, Trash2, X } from 'lucide-react'
import { TASK_CATEGORIES } from '../domain/categories'
import { normalizeOwner, TASK_OWNERS, type TaskOwner } from '../domain/owners'
import type { Task, TaskCategory, TaskType } from '../domain/types'
import { useDialogMotion } from '../hooks/useDialogMotion'

interface TaskDialogProps {
  task: Task | null
  initialDate: string
  nextSortOrder: number
  onClose: () => void
  onSave: (task: Task) => void
  onDelete: (id: string) => void
}

function makeDraft(task: Task | null, initialDate: string, nextSortOrder: number): Task {
  const now = new Date().toISOString()
  return (
    task ?? {
      id: crypto.randomUUID(),
      title: '',
      startDate: initialDate,
      endDate: initialDate,
      owner: '一起',
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
  const [shakeToken, setShakeToken] = useState(0)
  const { leaving, requestClose } = useDialogMotion(onClose)

  useEffect(() => {
    setDraft(makeDraft(task, initialDate, nextSortOrder))
    setError('')
  }, [initialDate, nextSortOrder, task])

  const setType = (type: TaskType) => {
    setDraft((current) => ({
      ...current,
      type,
      isOngoing: type === 'milestone' ? false : current.isOngoing,
      endDate: type === 'milestone' ? current.startDate : current.endDate,
    }))
  }

  const fail = (message: string) => {
    setError(message)
    setShakeToken((value) => value + 1)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.title.trim()) {
      fail('请输入任务名称')
      return
    }
    if (draft.type === 'range' && !draft.isOngoing && !draft.endDate) {
      fail('请设置结束日期')
      return
    }
    if (!draft.isOngoing && draft.endDate && draft.endDate < draft.startDate) {
      fail('结束日期不能早于开始日期')
      return
    }

    const owner = normalizeOwner(draft.owner)
    if (!owner) {
      fail('请选择负责人')
      return
    }

    onSave({
      ...draft,
      title: draft.title.trim(),
      owner,
      endDate: draft.isOngoing ? null : draft.type === 'milestone' ? draft.startDate : draft.endDate,
      updatedAt: new Date().toISOString(),
    })
    requestClose()
  }

  return (
    <div
      className={`dialog-backdrop ${leaving ? 'is-leaving' : ''}`}
      role="presentation"
      onMouseDown={requestClose}
    >
      <dialog
        open
        className={`task-dialog ${leaving ? 'is-leaving' : ''}`}
        aria-labelledby="task-dialog-title"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <p className="eyebrow">小事一桩</p>
            <h2 id="task-dialog-title">{task ? '改一改安排' : '记一件新事'}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={requestClose}
            aria-label="关闭"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form className={shakeToken ? 'is-shaking' : undefined} key={shakeToken} onSubmit={submit}>
          <label className="field full-field field-delay-1">
            <span>任务名称</span>
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="例如：准备三亚行程"
            />
          </label>

          <div className="mode-switch field-delay-2" aria-label="事项类型">
            <button
              type="button"
              className={draft.type === 'range' ? 'active' : ''}
              aria-pressed={draft.type === 'range'}
              onClick={() => setType('range')}
            >
              <Flag size={15} aria-hidden="true" />一段时间
            </button>
            <button
              type="button"
              className={draft.type === 'milestone' ? 'active' : ''}
              aria-pressed={draft.type === 'milestone'}
              onClick={() => setType('milestone')}
            >
              <Check size={15} aria-hidden="true" />某一天
            </button>
          </div>

          <div className="form-grid field-delay-3">
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
              <select
                value={normalizeOwner(draft.owner) ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    owner: (event.target.value || null) as TaskOwner | null,
                  })
                }
              >
                <option value="" disabled>
                  请选择
                </option>
                {TASK_OWNERS.map((owner) => (
                  <option value={owner} key={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>分类</span>
              <select
                value={draft.category}
                onChange={(event) =>
                  setDraft({ ...draft, category: event.target.value as TaskCategory })
                }
              >
                {TASK_CATEGORIES.map((category) => (
                  <option value={category.value} key={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {draft.type === 'range' && (
            <label className="check-row field-delay-4">
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
          <label className="check-row field-delay-4">
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

          <footer className="dialog-actions field-delay-5">
            {task && (
              <button
                className="button danger-button"
                type="button"
                onClick={() => {
                  if (window.confirm(`删除“${task.title}”？`)) {
                    onDelete(task.id)
                    requestClose()
                  }
                }}
              >
                <Trash2 size={16} aria-hidden="true" />删除
              </button>
            )}
            <button className="button" type="button" onClick={requestClose}>
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
