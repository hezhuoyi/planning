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
}

export function initTheme(): ThemeId {
  const id = readStoredThemeId()
  applyTheme(id)
  return id
}

export function setTheme(id: ThemeId): ThemeId {
  const next = getTheme(id).id
  writeStoredThemeId(next)
  applyTheme(next)
  return next
}
