// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('Planning', () => {
  it('opens on the gantt dashboard with the seeded plan', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Planning' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '家庭计划' })).toBeInTheDocument()
    expect(screen.getByText('雅思考试')).toBeInTheDocument()
    expect(screen.getByText('准备三亚行程')).toBeInTheDocument()
  })

  it('opens a compact task form from the primary add action', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '新增事项' }))

    expect(screen.getByRole('dialog', { name: '新增事项' })).toBeInTheDocument()
    expect(screen.getByLabelText('任务名称')).toBeInTheDocument()
    expect(screen.getByLabelText('开始日期')).toBeInTheDocument()
  })

  it('closes the task dialog with Escape', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '新增事项' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: '新增事项' })).not.toBeInTheDocument()
  })

  it('restores an end date when ongoing is turned off', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '新增事项' }))
    const ongoing = screen.getByRole('checkbox', { name: '持续进行，暂不设置结束日期' })
    const endDate = screen.getByLabelText('结束日期')

    await user.click(ongoing)
    await user.click(ongoing)

    expect(endDate).toBeEnabled()
    expect(endDate).toHaveValue('2026-08-03')
  })
})
