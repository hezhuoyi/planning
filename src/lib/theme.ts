import {
  DEFAULT_THEME_ID,
  getTheme,
  resolveThemeId,
  type ThemeId,
} from '../domain/themes'

const THEME_STORAGE_KEY = 'planning.theme.v1'

export function readStoredThemeId(): ThemeId {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME_ID
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return resolveThemeId(stored)
  } catch {
    return DEFAULT_THEME_ID
  }
}

export function writeStoredThemeId(id: ThemeId): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    // Ignore quota / private-mode failures; in-memory theme still applies.
  }
}

export function applyTheme(id: ThemeId): void {
  if (typeof document === 'undefined') return
  const theme = getTheme(id)
  const root = document.documentElement
  root.dataset.theme = theme.id
  for (const [name, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(name, value)
  }

  const surface = theme.tokens['--surface']
  if (surface) {
    root.style.backgroundColor = surface
    if (document.body) document.body.style.backgroundColor = surface
  }

  const themeColor = surface ?? theme.tokens['--primary']
  if (themeColor) {
    const metas = document.querySelectorAll('meta[name="theme-color"]')
    if (metas.length === 0) {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = themeColor
      document.head.appendChild(meta)
    } else {
      metas.forEach((meta) => meta.setAttribute('content', themeColor))
    }
  }
}

export function initTheme(): ThemeId {
  const id = readStoredThemeId()
  applyTheme(id)
  return id
}

export function setTheme(id: ThemeId): ThemeId {
  const next = getTheme(id).id
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.theme-fade-overlay').forEach((node) => node.remove())
    const root = document.documentElement
    const surface =
      getComputedStyle(root).getPropertyValue('--surface').trim() ||
      root.style.backgroundColor
    const overlay = document.createElement('div')
    overlay.className = 'theme-fade-overlay'
    if (surface) overlay.style.background = surface
    document.body.appendChild(overlay)
    requestAnimationFrame(() => {
      overlay.classList.add('is-out')
    })
    window.setTimeout(() => overlay.remove(), 420)
  }
  writeStoredThemeId(next)
  applyTheme(next)
  return next
}
