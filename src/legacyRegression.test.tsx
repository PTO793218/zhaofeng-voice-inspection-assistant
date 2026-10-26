import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import type { ToolRun, ToolSource } from './domain/workflow'

type PrototypeBridge = {
  getState: () => { records: unknown[]; draft: unknown; selectedId: string | null }
  execute: (toolId: string, payload?: Record<string, unknown>, source?: ToolSource) => Promise<ToolRun>
}

function bridge() {
  return (window as unknown as { __zfReactPrototype: PrototypeBridge }).__zfReactPrototype
}

async function submit(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByLabelText('文字指令')
  await user.clear(input)
  await user.type(input, text)
  await user.click(screen.getByRole('button', { name: '执行' }))
}

async function openRunningReportDraft(user: ReturnType<typeof userEvent.setup>) {
  await submit(user, '打开 GP26030719')
  await user.click(await screen.findByRole('button', { name: /候选 02/ }))
  await screen.findByRole('heading', { name: '回火工序任务' })
  await user.click(await screen.findByRole('button', { name: '生产报工' }))
  await screen.findByRole('heading', { name: '完工报工草稿' })
}

describe('8.07 旧版页面主链路与异常链路回归', () => {
  beforeEach(() => sessionStorage.clear())

  it('主链路：查询、选第二项、查看进度、保存并继续当前任务报工', async () => {
    const user = userEvent.setup()
    render(<App />)

    await submit(user, '打开 GP26030719')
    await user.click(await screen.findByRole('button', { name: /候选 02/ }))
    await screen.findByRole('heading', { name: '回火工序任务' })
    await user.click(screen.getByRole('button', { name: '查询进度' }))
    expect(await screen.findAllByText(/计划 6480只.*还剩 4985只/)).not.toHaveLength(0)

    await user.click(await screen.findByRole('button', { name: '生产报工' }))
    await screen.findByRole('heading', { name: '完工报工草稿' })
    await user.type(screen.getByLabelText('本次完工数'), '18')
    await user.type(screen.getByLabelText('本次报废数'), '0')
    await waitFor(() => expect(screen.getByRole('button', { name: '检查并确认' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '检查并确认' }))
    await user.click(await screen.findByRole('button', { name: '确认保存' }))

    expect(await screen.findByRole('heading', { name: '报工记录已保存' })).toBeVisible()
    expect(bridge().getState().records).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: '继续报这个任务' }))
    expect(await screen.findByRole('heading', { name: '完工报工草稿' })).toBeVisible()
    expect(screen.getByLabelText('本次完工数')).toHaveValue(null)
    expect(screen.getByLabelText('本次报废数')).toHaveValue(null)
  })

  it('草稿保护：重新选任务只打开弹窗，保留草稿后任务与数量不变', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openRunningReportDraft(user)
    await user.type(screen.getByLabelText('本次完工数'), '18')
    await user.type(screen.getByLabelText('本次报废数'), '0')

    await user.click(screen.getByRole('button', { name: '重新选择任务' }))
    expect(await screen.findByRole('dialog', { name: '当前报工草稿尚未确认' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '保留草稿' }))

    expect(screen.getByRole('heading', { name: '回火工序任务' })).toBeVisible()
    expect(screen.getByLabelText('本次完工数')).toHaveValue(18)
    expect(screen.getByLabelText('本次报废数')).toHaveValue(0)
  })

  it('受限动作：麦克风授权、放弃草稿和最终保存不能被工具入口绕过', async () => {
    render(<App />)
    await waitFor(() => expect(bridge()).toBeDefined())

    for (const toolId of ['enable_microphone', 'discard_draft_and_continue', 'save_report']) {
      let run: ToolRun | undefined
      await act(async () => {
        run = await bridge().execute(toolId)
      })
      expect(run).toMatchObject({
        toolId,
        phase: 'blocked',
        error: { code: 'MANUAL_ACTION_REQUIRED' },
      })
    }
    expect(bridge().getState().records).toHaveLength(0)
  })

  it('关闭任务：直接创建草稿仍被拒绝，但页面可进入可报工任务选择', async () => {
    const user = userEvent.setup()
    render(<App />)
    await submit(user, '打开 GP26060002 粗磨沟道大挡边 关闭')

    expect(await screen.findByRole('heading', { name: '粗磨沟道大挡边工序任务' })).toBeVisible()
    const reportButton = screen.getByRole('button', { name: '生产报工' })
    expect(reportButton).toBeEnabled()
    expect(reportButton).toHaveAttribute('title', '当前任务不可报工，点击后进入可报工任务选择')
    let run: ToolRun | undefined
    await act(async () => {
      run = await bridge().execute('start_report_draft')
    })
    expect(run).toMatchObject({ phase: 'blocked', error: { code: 'TASK_NOT_REPORTABLE' } })
    expect(bridge().getState().draft).toBeNull()
    await user.click(reportButton)
    expect(await screen.findByRole('heading', { name: '查找可报工任务' })).toBeVisible()
  })

  it('数量歧义：只说数字时拒绝修改，并要求说明完工数或报废数', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openRunningReportDraft(user)

    await submit(user, '18')
    expect(await screen.findAllByText('数字归属不明确，请说明是完工数还是报废数')).not.toHaveLength(0)
    expect(screen.getByLabelText('本次完工数')).toHaveValue(null)
    expect(screen.getByLabelText('本次报废数')).toHaveValue(null)
  })
})
