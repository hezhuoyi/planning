// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID } from '../domain/themes'
import {
  applyTheme,
  initTheme,
  readStoredThemeId,
  setTheme,
  writeStoredThemeId,
} from './theme'

const STORAGE_KEY = 'planning.theme.v1'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.cssText = ''
})

afterEach(() => {
  localStorage.clear()
})

describe('theme persistence', () => {
  it('defaults to apricot when nothing is stored', () => {
    expect(readStoredThemeId()).toBe(DEFAULT_THEME_ID)
  })

  it('reads a valid stored theme id', () => {
    localStorage.setItem(STORAGE_KEY, 'mist')
    expect(readStoredThemeId()).toBe('mist')
  })

  it('falls back when stored value is invalid', () => {
    localStorage.setItem(STORAGE_KEY, 'neon')
    expect(readStoredThemeId()).toBe(DEFAULT_THEME_ID)
  })

  it('applies css tokens and persists selection', () => {
    const id = setTheme('mint')
    expect(id).toBe('mint')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('mint')
    expect(document.documentElement.dataset.theme).toBe('mint')
    expect(document.documentElement.style.getPropertyValue('--primary').trim()).toBe(
      '#5aa88a',
    )
  })

  it('syncs page chrome colors with the active theme', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#e08a55" />'
    applyTheme('mist')
    const surface = document.documentElement.style.getPropertyValue('--surface').trim()
    expect(surface).toBe('#eef3f8')
    expect(document.documentElement.style.backgroundColor).toBeTruthy()
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      surface,
    )
  })

  it('keeps category colors stable across themes', () => {
    applyTheme('apricot')
    const apricotHealth = document.documentElement.style.getPropertyValue('--cat-health')
    applyTheme('peach')
    expect(document.documentElement.style.getPropertyValue('--cat-health')).toBe(
      apricotHealth,
    )
  })

  it('maps legacy theme ids to the nearest preset', () => {
    localStorage.setItem(STORAGE_KEY, 'dusk')
    expect(readStoredThemeId()).toBe('peach')
  })

  it('initTheme restores the stored preference', () => {
    writeStoredThemeId('inktea')
    expect(initTheme()).toBe('inktea')
    expect(document.documentElement.dataset.theme).toBe('inktea')
  })
})
