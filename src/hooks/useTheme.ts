import { useCallback, useState } from 'react'
import type { ThemeId } from '../domain/themes'
import { initTheme, setTheme as persistTheme } from '../lib/theme'

export function useTheme() {
  const [themeId, setThemeId] = useState<ThemeId>(() => initTheme())

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(persistTheme(id))
  }, [])

  return { themeId, setTheme }
}
