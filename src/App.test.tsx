// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format } from 'date-fns'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('Planning', () => {
  it('opens on the gantt dashboard with month summary copy', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Planning' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '计划概览' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '月' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('本月速览')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '家庭计划' })).toBeInTheDocument()
  })

  it('switches to the all-tasks timeline scope', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: '全部' }))

    expect(screen.getByRole('tab', { name: '全部' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('全部计划')).toBeInTheDocument()
    expect(screen.getByLabelText('整体时间范围')).toBeInTheDocument()
  })

  it('can move the month view to the next month', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '下个月' }))

    const next = new Date()
    next.setMonth(next.getMonth() + 1)
    expect(screen.getByLabelText('切换月份')).toHaveTextContent(
      `${next.getFullYear()}年${next.getMonth() + 1}月`,
    )
  })

  it('opens a compact task form from the primary add action', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '新增事项' }))

    expect(screen.getByRole('dialog', { name: '记一件新事' })).toBeInTheDocument()
    expect(screen.getByLabelText('任务名称')).toBeInTheDocument()
    expect(screen.getByLabelText('开始日期')).toBeInTheDocument()
  })

  it('closes the task dialog with Escape', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '新增事项' }))
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '记一件新事' })).not.toBeInTheDocument()
    })
  })

  it('restores an end date when ongoing is turned off', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '新增事项' }))
    const ongoing = screen.getByRole('checkbox', { name: '持续进行' })
    const endDate = screen.getByLabelText('结束日期')

    await user.click(ongoing)
    await user.click(ongoing)

    expect(endDate).toBeEnabled()
    expect(endDate).toHaveValue(format(new Date(), 'yyyy-MM-dd'))
  })
})
