import { useEffect, useState } from 'react'
import { Cloud, LogOut, Mail, Save, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseConfig, storeSupabaseConfig } from '../lib/supabase'

interface SyncDialogProps {
  session: Session | null
  isConfigured: boolean
  syncError: string | null
  onClose: () => void
  onSendMagicLink: (email: string) => Promise<void>
  onSignOut: () => Promise<void>
}

export function SyncDialog({
  session,
  isConfigured,
  syncError,
  onClose,
  onSendMagicLink,
  onSignOut,
}: SyncDialogProps) {
  const existing = getSupabaseConfig()
  const [url, setUrl] = useState(existing?.url ?? '')
  const [anonKey, setAnonKey] = useState(existing?.anonKey ?? '')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const saveConfig = () => {
    if (!url.trim() || !anonKey.trim()) {
      setMessage('请填写项目 URL 和 anon key')
      return
    }
    storeSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() })
    window.location.reload()
  }

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
            <h2 id="sync-dialog-title">Supabase</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X aria-hidden="true" />
          </button>
        </header>

        {!isConfigured ? (
          <div className="sync-section">
            <label className="field">
              <span>项目 URL</span>
              <input value={url} onChange={(event) => setUrl(event.target.value)} />
            </label>
            <label className="field">
              <span>Anon key</span>
              <textarea rows={4} value={anonKey} onChange={(event) => setAnonKey(event.target.value)} />
            </label>
            <button className="button primary-button" type="button" onClick={saveConfig}>
              <Save size={16} aria-hidden="true" />保存并连接
            </button>
          </div>
        ) : session ? (
          <div className="account-row">
            <Cloud aria-hidden="true" />
            <div>
              <strong>已连接</strong>
              <span>{session.user.email}</span>
            </div>
            <button className="button" type="button" onClick={() => void onSignOut()}>
              <LogOut size={16} aria-hidden="true" />退出
            </button>
          </div>
        ) : (
          <div className="sync-section">
            <label className="field">
              <span>登录邮箱</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <button
              className="button primary-button"
              type="button"
              onClick={async () => {
                try {
                  await onSendMagicLink(email)
                  setMessage('登录链接已发送，请检查邮箱')
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : '发送失败')
                }
              }}
            >
              <Mail size={16} aria-hidden="true" />发送登录链接
            </button>
          </div>
        )}

        {(message || syncError) && <p className="sync-message">{message || syncError}</p>}
      </dialog>
    </div>
  )
}
