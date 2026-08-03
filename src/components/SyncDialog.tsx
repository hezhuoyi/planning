import { useEffect, useState } from 'react'
import { Cloud, Lock, Unlock, X } from 'lucide-react'

interface SyncDialogProps {
  unlocked: boolean
  syncError: string | null
  onClose: () => void
  onUnlock: (passcode: string) => void
  onLock: () => void
}

export function SyncDialog({
  unlocked,
  syncError,
  onClose,
  onUnlock,
  onLock,
}: SyncDialogProps) {
  const [passcode, setPasscode] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <dialog
        open
        className="task-dialog sync-dialog"
        aria-labelledby="sync-dialog-title"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <p className="eyebrow">云同步</p>
            <h2 id="sync-dialog-title">{unlocked ? '已解锁' : '输入口令'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X aria-hidden="true" />
          </button>
        </header>

        {unlocked ? (
          <div className="account-row">
            <Cloud aria-hidden="true" />
            <div>
              <strong>家人共用一份计划</strong>
              <span>口令正确，正在与云端同步</span>
            </div>
            <button className="button" type="button" onClick={onLock}>
              <Lock size={16} aria-hidden="true" />锁定
            </button>
          </div>
        ) : (
          <form
            className="sync-section"
            onSubmit={(event) => {
              event.preventDefault()
              try {
                onUnlock(passcode)
                setMessage('')
                onClose()
              } catch (error) {
                setMessage(error instanceof Error ? error.message : '口令不正确')
              }
            }}
          >
            <label className="field">
              <span>家庭口令</span>
              <input
                autoFocus
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="输入口令后开启同步"
                autoComplete="current-password"
              />
            </label>
            <button className="button primary-button" type="submit">
              <Unlock size={16} aria-hidden="true" />解锁并同步
            </button>
          </form>
        )}

        {(message || syncError) && <p className="sync-message">{message || syncError}</p>}
      </dialog>
    </div>
  )
}
