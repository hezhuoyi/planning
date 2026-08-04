import { useState } from 'react'
import { Cloud, Lock, Unlock, X } from 'lucide-react'
import { THEMES, type ThemeId } from '../domain/themes'
import { useDialogMotion } from '../hooks/useDialogMotion'

interface SyncDialogProps {
  unlocked: boolean
  syncConfigured: boolean
  syncError: string | null
  themeId: ThemeId
  onThemeChange: (id: ThemeId) => void
  onClose: () => void
  onUnlock: (passcode: string) => void
  onLock: () => void
}

export function SyncDialog({
  unlocked,
  syncConfigured,
  syncError,
  themeId,
  onThemeChange,
  onClose,
  onUnlock,
  onLock,
}: SyncDialogProps) {
  const [passcode, setPasscode] = useState('')
  const [message, setMessage] = useState('')
  const [shakeToken, setShakeToken] = useState(0)
  const { leaving, requestClose } = useDialogMotion(onClose)

  const title = syncConfigured
    ? unlocked
      ? '已经连上啦'
      : '输入家庭口令'
    : '外观设置'

  return (
    <div
      className={`dialog-backdrop ${leaving ? 'is-leaving' : ''}`}
      role="presentation"
      onMouseDown={requestClose}
    >
      <dialog
        open
        className={`task-dialog sync-dialog ${leaving ? 'is-leaving' : ''}`}
        aria-labelledby="sync-dialog-title"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <p className="eyebrow">{syncConfigured ? '家人共用' : '个性化'}</p>
            <h2 id="sync-dialog-title">{title}</h2>
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

        {syncConfigured &&
          (unlocked ? (
            <div className="account-row">
              <Cloud aria-hidden="true" />
              <div>
                <strong>家人共用一份计划</strong>
                <span>改动会自动同步，点锁定可断开</span>
              </div>
              <button
                className="button"
                type="button"
                onClick={() => {
                  onLock()
                  requestClose()
                }}
              >
                <Lock size={16} aria-hidden="true" />锁定
              </button>
            </div>
          ) : (
            <form
              className={`sync-section ${shakeToken ? 'is-shaking' : ''}`}
              key={shakeToken}
              onSubmit={(event) => {
                event.preventDefault()
                try {
                  onUnlock(passcode)
                  setMessage('')
                  requestClose()
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : '口令不正确')
                  setShakeToken((value) => value + 1)
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
          ))}

        {(message || (syncConfigured && syncError)) && (
          <p className="sync-message pop-in">{message || syncError}</p>
        )}

        <section className="theme-section" aria-label="主题色">
          <div className="theme-section-copy">
            <strong>主题色</strong>
            <span>选一套喜欢的，只换主色，任务标签色不变</span>
          </div>
          <div className="theme-swatches" role="radiogroup" aria-label="主题预设">
            {THEMES.map((theme) => {
              const selected = theme.id === themeId
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`theme-swatch ${selected ? 'is-selected' : ''}`}
                  onClick={() => onThemeChange(theme.id)}
                  title={`${theme.label} · ${theme.description}`}
                >
                  <span
                    className="theme-swatch-dot"
                    style={{ background: theme.swatch }}
                    aria-hidden="true"
                  />
                  <span className="theme-swatch-text">
                    <strong>{theme.label}</strong>
                    <small>{theme.description}</small>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </dialog>
    </div>
  )
}
