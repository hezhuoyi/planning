// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import {
  OPEN_TIP_FLAVOR_COUNT,
  buildOpenTipContext,
  pickOpenTip,
  readRecentOpenTips,
  writeRecentOpenTip,
} from './openTips'

afterEach(() => {
  localStorage.clear()
})

describe('openTips', () => {
  it('builds context from summary and clock', () => {
    const ctx = buildOpenTipContext(
      { overdue: 1, inFlight: 2, upcoming: 3, completed: 4, total: 10 },
      new Date('2026-08-05T09:30:00'),
    )
    expect(ctx.overdue).toBe(1)
    expect(ctx.hour).toBe(9)
    expect(ctx.weekday).toBe(3)
  })

  it('avoids recently shown tips when possible', () => {
    const recent = Array.from({ length: 8 }, (_, index) => `recent-${index}`)
    const tip = pickOpenTip(
      {
        overdue: 0,
        inFlight: 0,
        upcoming: 0,
        completed: 0,
        total: 0,
        hour: 14,
        weekday: 3,
      },
      recent,
      () => 0.99,
    )
    expect(recent).not.toContain(tip)
    expect(tip.length).toBeGreaterThan(0)
  })

  it('persists recent tips for freshness', () => {
    writeRecentOpenTip('第一条提示')
    writeRecentOpenTip('第二条提示')
    expect(readRecentOpenTips()[0]).toBe('第二条提示')
    expect(readRecentOpenTips()).toContain('第一条提示')
  })

  it('has a sizable flavor pool for variety', () => {
    expect(OPEN_TIP_FLAVOR_COUNT).toBe(500)
  })
})
