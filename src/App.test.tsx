import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

class BrowserRecognitionFake {
  static instances: BrowserRecognitionFake[] = []
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  onspeechstart: (() => void) | null = null
  onspeechend: (() => void) | null = null
  aborted = false
  constructor() { BrowserRecognitionFake.instances.push(this) }
  start() {}
  stop() {}
  abort() { this.aborted = true }
  emit(text: string, confidence = 1) {
    const result = Object.assign([{ transcript: text, confidence }], { isFinal: true })
    this.onresult?.({ resultIndex: 0, results: [result] })
  }
}

class BrowserUtteranceFake {
  lang = ''
  rate = 1
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public text: string) {}
}

function installVoiceBrowserFakes() {
  BrowserRecognitionFake.instances = []
  const utterances: BrowserUtteranceFake[] = []
  const synthesis = { speak: vi.fn(), cancel: vi.fn() }
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }))
  const oscillatorStart = vi.fn()
  const oscillatorStop = vi.fn()
  const audioContextClose = vi.fn(async () => undefined)
  class AudioContextFake {
    currentTime = 0
    destination = {}
    createOscillator() {
      return { type: 'sine', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: oscillatorStart, stop: oscillatorStop }
    }
    createGain() {
      return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }
    }
    close = audioContextClose
  }
  Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, writable: true, value: BrowserRecognitionFake })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: synthesis })
  Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: AudioContextFake })
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    configurable: true,
    writable: true,
    value: class extends BrowserUtteranceFake {
      constructor(text: string) {
        super(text)
        utterances.push(this)
      }
    },
  })
  return { synthesis, utterances, getUserMedia, oscillatorStart, oscillatorStop, audioContextClose }
}

describe('网商语音助手 React 页面', () => {
  beforeEach(() => sessionStorage.clear())

  afterEach(() => {
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, writable: true, value: undefined })
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, writable: true, value: undefined })
    Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: undefined })
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: undefined })
  })

  async function openReportDraft(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('文字指令'), '打开 GP26030719')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await user.click(await screen.findByRole('button', { name: /候选 02/ }))
    await screen.findByRole('heading', { name: '回火工序任务' })
    await user.click(await screen.findByRole('button', { name: '生产报工' }))
    await screen.findByRole('heading', { name: '完工报工草稿' })
  }

  it('查询、选择、编辑草稿并保留草稿', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('文字指令'), '打开 GP26030719')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findAllByRole('button', { name: /候选/ })).toHaveLength(6)

    await user.click(screen.getByRole('button', { name: /候选 02/ }))
    await screen.findByRole('heading', { name: '回火工序任务' })
    await user.click(await screen.findByRole('button', { name: '生产报工' }))
    await screen.findByRole('heading', { name: '完工报工草稿' })
    await user.type(screen.getByLabelText('本次完工数'), '18')
    await user.type(screen.getByLabelText('本次报废数'), '0')
    await user.click(screen.getByRole('button', { name: '重新选择任务' }))

    expect(await screen.findByRole('dialog', { name: '当前报工草稿尚未确认' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '保留草稿' }))
    expect(screen.getByLabelText('本次完工数')).toHaveValue(18)
    expect(screen.getByLabelText('本次报废数')).toHaveValue(0)
  })

  it('语音或文字说确认时只聚焦人工确认按钮', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('文字指令'), '打开 GP26030719')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await user.click(await screen.findByRole('button', { name: /候选 02/ }))
    await screen.findByRole('heading', { name: '回火工序任务' })
    await user.click(await screen.findByRole('button', { name: '生产报工' }))
    await screen.findByRole('heading', { name: '完工报工草稿' })
    await user.type(screen.getByLabelText('本次完工数'), '18')
    await user.type(screen.getByLabelText('本次报废数'), '0')
    await user.clear(screen.getByLabelText('文字指令'))
    await user.type(screen.getByLabelText('文字指令'), '确认')
    await user.click(screen.getByRole('button', { name: '执行' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '检查并确认' })).toHaveFocus())
    expect(screen.queryByRole('dialog', { name: '确认保存报工记录？' })).not.toBeInTheDocument()
  })

  it('查询、选任务和开始报工后自动定位并聚焦新区域', async () => {
    const user = userEvent.setup()
    const scrolled: Element[] = []
    Element.prototype.scrollIntoView = function scrollIntoView() {
      scrolled.push(this)
    }
    render(<App />)

    await user.type(screen.getByLabelText('文字指令'), '打开 GP26030719')
    await user.click(screen.getByRole('button', { name: '执行' }))
    const firstCandidate = await screen.findByRole('button', { name: /候选 01/ })
    const candidateSection = screen.getByRole('heading', { name: /候选任务/ }).closest('section')!
    await waitFor(() => expect(scrolled.at(-1)).toBe(candidateSection))
    expect(firstCandidate).toHaveFocus()

    await user.click(screen.getByRole('button', { name: /候选 02/ }))
    const taskSection = (await screen.findByRole('heading', { name: '回火工序任务' })).closest('section')!
    await waitFor(() => expect(scrolled.at(-1)).toBe(taskSection))
    expect(screen.getByRole('button', { name: '生产报工' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: '生产报工' }))
    const reportSection = (await screen.findByRole('heading', { name: '完工报工草稿' })).closest('section')!
    await waitFor(() => expect(scrolled.at(-1)).toBe(reportSection))
    expect(screen.getByLabelText('本次完工数')).toHaveFocus()
  })

  it('报工数字可以直接删除为空并重新触发必填校验', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openReportDraft(user)

    const completeInput = screen.getByLabelText('本次完工数')
    await user.type(completeInput, '18')
    expect(completeInput).toHaveValue(18)
    await user.clear(completeInput)

    expect(completeInput).toHaveValue(null)
    expect(screen.getByText('完工数和报废数必须填写非负整数')).toBeVisible()
  })

  it('最终保存后发布执行成功轨迹并定位成功区域', async () => {
    const user = userEvent.setup()
    const scrolled: Element[] = []
    Element.prototype.scrollIntoView = function scrollIntoView() {
      scrolled.push(this)
    }
    render(<App />)
    await openReportDraft(user)
    await user.type(screen.getByLabelText('本次完工数'), '18')
    await user.type(screen.getByLabelText('本次报废数'), '0')
    await user.click(screen.getByRole('button', { name: '检查并确认' }))
    await user.click(await screen.findByRole('button', { name: '确认保存' }))

    const successHeading = await screen.findByRole('heading', { name: '报工记录已保存' })
    const successSection = successHeading.closest('section')!
    await waitFor(() => expect(scrolled.at(-1)).toBe(successSection))
    await user.click(screen.getByText('运行信息'))
    const toolCard = screen.getByText('准备人工确认').closest('.tool-card')!
    expect(within(toolCard as HTMLElement).getByText('执行成功')).toBeVisible()
    expect(within(toolCard as HTMLElement).getByText('用户已完成最终点击确认')).toBeVisible()
  })

  it('保存报工后切换到其他任务不会把旧成功记录显示在新任务上', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openReportDraft(user)
    await user.type(screen.getByLabelText('本次完工数'), '18')
    await user.type(screen.getByLabelText('本次报废数'), '0')
    await user.click(screen.getByRole('button', { name: '检查并确认' }))
    await user.click(await screen.findByRole('button', { name: '确认保存' }))
    expect(await screen.findByRole('heading', { name: '报工记录已保存' })).toBeVisible()

    await user.clear(screen.getByLabelText('文字指令'))
    await user.type(screen.getByLabelText('文字指令'), '打开 GP26060001 粗磨沟道大挡边')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect((await screen.findAllByText('GP26060001-2')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: '报工记录已保存' })).not.toBeInTheDocument()
  })

  it('草稿保护弹窗支持 Escape、背景隔离和关闭后焦点恢复', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openReportDraft(user)
    await user.type(screen.getByLabelText('本次完工数'), '18')

    const reselectButton = screen.getByRole('button', { name: '重新选择任务' })
    await user.click(reselectButton)
    expect(await screen.findByRole('dialog', { name: '当前报工草稿尚未确认' })).toBeVisible()
    expect(document.querySelector('main')).toHaveAttribute('inert')
    const keepDraftButton = screen.getByRole('button', { name: '保留草稿' })
    const discardDraftButton = screen.getByRole('button', { name: '放弃草稿' })
    expect(keepDraftButton).toHaveFocus()
    await user.tab({ shift: true })
    expect(discardDraftButton).toHaveFocus()
    await user.tab()
    expect(keepDraftButton).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: '当前报工草稿尚未确认' })).not.toBeInTheDocument()
    expect(document.querySelector('main')).not.toHaveAttribute('inert')
    await waitFor(() => expect(reselectButton).toHaveFocus())
  })

  it('清空查询条件后移除候选并安全聚焦智能理解区域', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('文字指令'), '打开 GP26030719')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findAllByRole('button', { name: /候选/ })).toHaveLength(6)

    await user.clear(screen.getByLabelText('文字指令'))
    await user.type(screen.getByLabelText('文字指令'), '清空条件')
    await user.click(screen.getByRole('button', { name: '执行' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: /候选任务/ })).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('heading', { name: '智能理解' }).closest('aside')).toHaveFocus())
  })

  it('页面先显示工具准备阶段，并在终态历史中保留完整阶段轨迹', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('文字指令'), '打开 GP26030719')

    const execution = user.click(screen.getByRole('button', { name: '执行' }))
    await user.click(await screen.findByText('运行信息'))
    const toolCard = screen.getByText('最近工具动作').closest('.tool-card')!
    await waitFor(() => expect(within(toolCard as HTMLElement).getByText('准备执行')).toBeVisible())
    await execution
    await screen.findAllByRole('button', { name: /候选/ })

    await user.click(screen.getByText('详细记录'))
    const phases = within(screen.getByText('详细记录').closest('details')!).getAllByRole('listitem')
    expect(phases.slice(0, 3).map((item) => item.textContent)).toEqual([
      expect.stringContaining('执行成功'),
      expect.stringContaining('正在执行'),
      expect.stringContaining('准备执行'),
    ])
  })

  it('工具阶段执行期间锁定重复操作，终态后恢复执行按钮', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText('文字指令'), '打开 GP26030719')

    const executeButton = screen.getByRole('button', { name: '执行' })
    const execution = user.click(executeButton)
    await waitFor(() => expect(executeButton).toBeDisabled())
    await execution
    await screen.findAllByRole('button', { name: /候选/ })
    await waitFor(() => expect(executeButton).toBeEnabled())
  })

  it('唯一候选自动打开任务详情，不再要求用户点击一次候选', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('文字指令'), '打开 GP26060001 精磨沟道大挡边')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '精磨沟道大挡边工序任务' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: /候选任务/ })).not.toBeInTheDocument()
  })

  it('组合指令在用户选定候选后自动创建并填写报工草稿', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('文字指令'), '打开 GP26030719，完工18，报废0')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await user.click(await screen.findByRole('button', { name: /候选 02/ }))

    expect(await screen.findByRole('heading', { name: '完工报工草稿' })).toBeVisible()
    expect(screen.getByLabelText('本次完工数')).toHaveValue(18)
    expect(screen.getByLabelText('本次报废数')).toHaveValue(0)
  })

  it('条件纠错沿用现有查询条件，并在唯一命中后打开正确工序', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '打开 GP26060001')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await user.clear(input)
    await user.type(input, '工序不是粗磨沟道大挡边，是精磨沟道大挡边')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '精磨沟道大挡边工序任务' })).toBeVisible()
    expect(screen.getByText('查询条件已从空改为精磨沟道大挡边')).toBeVisible()
  })

  it('候选过多时用真实候选值追问，并让筛选器同步当前条件', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('文字指令'), '运行')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '请补充要查看的产品' })).toBeVisible()
    expect(screen.getByRole('button', { name: '2MHM0200506' })).toBeVisible()
    const manualSummary = screen.getByText('手动输入与筛选')
    await user.click(manualSummary)
    expect(screen.getByLabelText('数据记录状态')).toHaveValue('运行')
  })

  it('模糊查询显示需要补充信息，并在保留最近输入的同时清空编辑框', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '运行')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByText('需要补充信息')).toBeVisible()
    expect(screen.getByText('找到 11 个候选任务，还需要确认产品。')).toBeVisible()
    expect(input).toHaveValue('')
    expect(within(screen.getByRole('heading', { name: '智能理解' }).closest('aside')!).getByText('运行', { selector: 'p' })).toBeVisible()
  })

  it('精确查询成功后清空编辑框，未识别指令则保留并选中原文', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令') as HTMLInputElement

    await user.type(input, '打开 GP26060001 精磨沟道大挡边')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await screen.findByRole('heading', { name: '精磨沟道大挡边工序任务' })
    expect(input).toHaveValue('')

    await user.type(input, '帮我处理一下')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByText('未识别可执行意图')).toBeVisible()
    expect(screen.getByText('本次未执行操作；当前任务仍保留。')).toBeVisible()
    expect(input).toHaveValue('帮我处理一下')
    await waitFor(() => expect(input).toHaveFocus())
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe('帮我处理一下'.length)
    expect(screen.getByText('最近工具动作')).not.toBeVisible()
    await user.click(screen.getByText('运行信息'))
    expect(screen.getByText('上一条')).toBeVisible()
  })

  it('草稿保护拦截指令时保留原文，等待用户决定是否放弃草稿', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openReportDraft(user)
    const input = screen.getByLabelText('文字指令') as HTMLInputElement

    await user.type(input, '重新选任务')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('dialog', { name: '当前报工草稿尚未确认' })).toBeVisible()
    expect(input).toHaveValue('重新选任务')
  })

  it('旧指令异步失败时不覆盖用户已经开始输入的新指令', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令') as HTMLInputElement

    await user.type(input, '打开麦克风')
    await user.click(screen.getByRole('button', { name: '执行' }))
    fireEvent.change(input, { target: { value: '下一条新指令' } })

    await screen.findByText('操作未执行')
    expect(input).toHaveValue('下一条新指令')
  })

  it('确认弹窗打开后显示等待最终确认，返回修改后恢复草稿已校验', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openReportDraft(user)
    await user.type(screen.getByLabelText('本次完工数'), '18')
    await user.type(screen.getByLabelText('本次报废数'), '0')

    await user.click(screen.getByRole('button', { name: '检查并确认' }))
    expect(await screen.findByRole('dialog', { name: '确认保存报工记录？' })).toBeVisible()
    expect(screen.getByText('等待最终确认')).toBeVisible()
    expect(screen.queryByText('草稿校验通过，请点击“检查并确认”')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回修改' }))
    const feedback = (await screen.findByText('草稿已校验')).closest('.assistant-feedback')!
    expect(within(feedback as HTMLElement).getByText(/点击“检查并确认”/)).toBeVisible()
  })

  it('刷新式重挂载后恢复操作人、最近输入、候选与当前筛选', async () => {
    const user = userEvent.setup()
    const view = render(<App />)
    await user.clear(screen.getByLabelText('操作人'))
    await user.type(screen.getByLabelText('操作人'), '张三')
    await user.type(screen.getByLabelText('文字指令'), '打开 GP26060001')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findAllByRole('button', { name: /候选/ })).toHaveLength(5)

    view.unmount()
    render(<App />)

    expect(screen.getByLabelText('操作人')).toHaveValue('张三')
    expect(screen.getByText('打开 GP26060001')).toBeVisible()
    expect(await screen.findAllByRole('button', { name: /候选/ })).toHaveLength(5)
    await user.click(screen.getByText('手动输入与筛选'))
    expect(screen.getByLabelText('数据记录状态')).toHaveValue('')
    expect(screen.getByText('已恢复候选任务')).toBeVisible()
    expect(screen.getByText('已恢复 5 个候选任务，尚未选定具体任务。')).toBeVisible()
  })

  it('“重说”保留业务状态并回到输入，“返回”按当前层级退出', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')
    await user.type(input, '打开 GP26030719')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await user.click(await screen.findByRole('button', { name: /候选 02/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: '生产报工' })).toHaveFocus())

    await user.clear(input)
    await user.type(input, '重说')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(screen.getByRole('heading', { name: '回火工序任务' })).toBeVisible()
    await waitFor(() => expect(input).toHaveFocus())

    await user.clear(input)
    await user.type(input, '返回')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: '回火工序任务' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: /候选任务/ })).toBeVisible()
  })

  it('使用“你好小we”唤醒时，同句指令自动进入现有业务流程', async () => {
    const user = userEvent.setup()
    const { oscillatorStart } = installVoiceBrowserFakes()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '启用语音' }))
    await waitFor(() => expect(screen.getByText('等待“你好小we”')).toBeVisible())
    expect(BrowserRecognitionFake.instances[0]).toMatchObject({ continuous: true, interimResults: false })

    BrowserRecognitionFake.instances[0].emit('你好小we 打开 GP26030719')
    expect(await screen.findAllByRole('button', { name: /候选/ })).toHaveLength(6)
    expect(oscillatorStart).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('语音识别内容')).toHaveTextContent('打开 GP26030719')
    expect(screen.getByLabelText('语音识别内容')).not.toHaveTextContent('你好小we')
    expect(screen.getByLabelText('文字指令')).toHaveValue('')
  })

  it('手动输入与筛选默认收起，语音错误不会自动展开', async () => {
    const user = userEvent.setup()
    installVoiceBrowserFakes()
    render(<App />)

    const summary = screen.getByText('手动输入与筛选')
    const details = summary.closest('details')!
    expect(details).not.toHaveAttribute('open')
    expect(within(details).getByLabelText('文字指令')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '启用语音' }))
    BrowserRecognitionFake.instances[0].onerror?.({ error: 'no-speech' })
    expect(details).not.toHaveAttribute('open')
  })

  it('开启播报后播报工具结果，结束后恢复唤醒，卸载时释放识别器', async () => {
    const user = userEvent.setup()
    const { synthesis, utterances } = installVoiceBrowserFakes()
    const view = render(<App />)
    await user.click(screen.getByRole('button', { name: '启用语音' }))
    await waitFor(() => expect(BrowserRecognitionFake.instances).toHaveLength(1))

    await user.click(screen.getByRole('button', { name: '语音播报：关闭' }))
    await waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(1))
    expect(utterances[0].text).toContain('语音播报已开启')
    utterances[0].onend?.()
    await waitFor(() => expect(screen.getByText('等待“你好小we”')).toBeVisible())

    await user.type(screen.getByLabelText('文字指令'), '打开 GP26060001 精磨沟道大挡边')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await screen.findByRole('heading', { name: '精磨沟道大挡边工序任务' })
    await waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(2))
    expect(utterances[1].text).toContain('查询完成')

    const activeRecognition = BrowserRecognitionFake.instances.at(-1)!
    view.unmount()
    expect(activeRecognition.aborted).toBe(true)
  })

  it('开启播报后，语音指令未识别时主动说明本次没有执行', async () => {
    const user = userEvent.setup()
    const { synthesis, utterances } = installVoiceBrowserFakes()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '启用语音' }))
    await user.click(screen.getByRole('button', { name: '语音播报：关闭' }))
    await waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(1))
    utterances[0].onend?.()
    await waitFor(() => expect(screen.getByText('等待“你好小we”')).toBeVisible())

    BrowserRecognitionFake.instances.at(-1)!.emit('你好小we 帮我处理一下')

    expect(await screen.findByText('未识别可执行意图')).toBeVisible()
    await waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(2))
    expect(utterances[1].text).toContain('本次没有执行')
    expect(utterances[1].text).toContain('请重新说一遍')
  })

  it('开启播报后，语音识别失败时主动说明本次没有执行', async () => {
    const user = userEvent.setup()
    const { synthesis, utterances } = installVoiceBrowserFakes()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '启用语音' }))
    await user.click(screen.getByRole('button', { name: '语音播报：关闭' }))
    await waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(1))
    utterances[0].onend?.()
    await waitFor(() => expect(screen.getByText('等待“你好小we”')).toBeVisible())
    await user.click(screen.getByRole('button', { name: '点击开始说话' }))

    BrowserRecognitionFake.instances.at(-1)!.onerror?.({ error: 'network' })

    await waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(2))
    expect(utterances[1].text).toContain('本次没有执行')
    expect(screen.getByText('本次未执行')).toBeVisible()
    expect(screen.getByText(/语音识别失败/)).toBeVisible()
  })

  it('通过兜底文字指令选择第二个候选并进入对应任务', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText('文字指令')
    await user.type(input, '打开 GP26030719')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await screen.findAllByRole('button', { name: /候选/ })
    await user.type(input, '选择第二个')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '回火工序任务' })).toBeVisible()
  })

  it('“打开第二个”与“选择第二个”一样选择当前候选', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText('文字指令')
    await user.type(input, '打开 GP26030719')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await screen.findAllByRole('button', { name: /候选/ })
    await user.type(input, '打开第二个')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '回火工序任务' })).toBeVisible()
  })

  it('默认收起运行信息，用户逐层展开后再显示详细记录', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText('文字指令'), '查回火工序')
    const execution = user.click(screen.getByRole('button', { name: '执行' }))
    const runSummary = await screen.findByText('运行信息')
    const runDetails = runSummary.closest('details')
    expect(runDetails).not.toHaveAttribute('open')
    expect(screen.getByText('最近工具动作')).not.toBeVisible()

    await user.click(runSummary)
    const technicalSummary = screen.getByText('详细记录')
    const technicalDetails = technicalSummary.closest('details')
    expect(technicalDetails).not.toHaveAttribute('open')
    expect(screen.getByText('工具 ID')).not.toBeVisible()
    expect(screen.getByText('错误码')).not.toBeVisible()

    await user.click(technicalSummary)

    expect(screen.getByText('工具 ID')).toBeVisible()
    expect(screen.getByText('错误码')).toBeVisible()
    await execution
  })

  it('选定任务后收起候选列表，重新选择时恢复', async () => {
    const user = userEvent.setup()
    render(<App />)

    const input = screen.getByLabelText('文字指令')
    await user.type(input, '打开 GP26030719')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findByRole('heading', { level: 2, name: /候选任务/ })).toBeVisible()

    await user.type(input, '选择第二个')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findByRole('heading', { name: '回火工序任务' })).toBeVisible()
    expect(screen.queryByRole('heading', { level: 2, name: /候选任务/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重新选择任务' }))
    expect(await screen.findByRole('heading', { level: 2, name: /候选任务/ })).toBeVisible()
  })

  it('保存后第 4 步显示完成，继续报工时恢复进行中', async () => {
    const user = userEvent.setup()
    render(<App />)
    await openReportDraft(user)
    await user.type(screen.getByLabelText('本次完工数'), '18')
    await user.type(screen.getByLabelText('本次报废数'), '0')
    await user.click(screen.getByRole('button', { name: '检查并确认' }))
    await user.click(await screen.findByRole('button', { name: '确认保存' }))
    await screen.findByRole('heading', { name: '报工记录已保存' })

    const stepFour = within(screen.getByLabelText('当前步骤')).getByText('人工确认').closest('.step')!
    expect(stepFour).toHaveClass('done')
    expect(stepFour).not.toHaveClass('active')
    expect(within(stepFour as HTMLElement).getByText('✓')).toBeVisible()

    await user.click(screen.getByRole('button', { name: '继续报这个任务' }))
    await screen.findByRole('heading', { name: '完工报工草稿' })
    expect(stepFour).toHaveClass('active')
    expect(stepFour).not.toHaveClass('done')
  })

  it('通过同一文字与语音入口进入检测场景并加载 20 条 TF13 项目', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '打开 GP22010599')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect((await screen.findAllByText('GP22010599-6')).length).toBeGreaterThan(0)

    await user.type(input, '检测录入')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '智能检测录入' })).toBeVisible()
    expect(screen.getByText('检验记录已加载')).toBeVisible()
    expect(within(screen.getByRole('table', { name: 'TF13 检验项目' })).getAllByRole('row')).toHaveLength(21)
    expect(screen.getByText('φ87.4(-0.05～0)')).toBeVisible()
  })

  it('一句话检测指令只生成待确认单元格，点击后保存到页面会话', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '打开 GP22010599')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect((await screen.findAllByText('GP22010599-6')).length).toBeGreaterThan(0)
    await user.type(input, '检测录入，外径 D1，第 2 列，87.39')
    await user.click(screen.getByRole('button', { name: '执行' }))

    const pending = await screen.findByRole('region', { name: '检测值待确认' })
    expect(pending).toHaveTextContent('外径D1')
    expect(pending).toHaveTextContent('第 2 列')
    expect(pending).toHaveTextContent('87.39')
    await user.click(within(pending).getByRole('button', { name: '确认本次检测值' }))

    expect(await screen.findByText('检测值已确认')).toBeVisible()
    expect(screen.queryByRole('region', { name: '检测值待确认' })).not.toBeInTheDocument()

    const reportButton = screen.getByRole('button', { name: '生产报工' })
    expect(reportButton).toBeEnabled()
    await user.click(reportButton)

    expect(await screen.findByRole('heading', { name: '查找可报工任务' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '重新选择任务' })).not.toBeInTheDocument()
  })

  it('一个任务关联两张 TF13 记录时先选择记录，不默认取最新记录', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '打开 GP22010401')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect((await screen.findAllByText('GP22010401-6')).length).toBeGreaterThan(0)
    await user.type(input, '检测录入')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '请选择检验记录' })).toBeVisible()
    expect(screen.queryByRole('table', { name: 'TF13 检验项目' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /2022-08-31 15:00:17/ }))
    expect(await screen.findByRole('table', { name: 'TF13 检验项目' })).toBeVisible()
    expect(screen.getByText('记录时间：2022-08-31 15:00:17')).toBeVisible()
  })

  it('生产任务没有检验记录时禁用检测录入并保持当前操作', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '打开 GP26030719 回火')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findByRole('heading', { name: '回火工序任务' })).toBeVisible()
    expect(screen.getByRole('button', { name: '检测录入' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '检测录入' })).toHaveAttribute('title', '当前任务没有可用检验记录')
    expect(screen.getByRole('button', { name: '生产报工' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: '查找生产任务' })).toBeVisible()
  })

  it('历史检测任务不可直接报工但允许进入报工任务选择', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '打开 GP22010599')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('button', { name: '检测录入' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '生产报工' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '生产报工' })).toHaveAttribute('title', '当前任务不可报工，点击后进入可报工任务选择')
  })

  it('智能检测操作查询回火时不打开无检验记录的生产任务', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '检测录入')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findByRole('heading', { name: '查找可检测任务' })).toBeVisible()

    await user.type(input, '查回火工序')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByText('找到了符合“回火”的生产任务，但这些任务没有可用检验记录。当前仍保持智能检测录入。')).toBeVisible()
    expect(screen.getByRole('status', { name: '助手反馈' })).toHaveTextContent('当前任务不可检测录入')
    expect(screen.queryByRole('heading', { name: '回火工序任务' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '查找可检测任务' })).toBeVisible()
  })

  it('只进入检测操作时保持真实流程状态并继续引导查询任务', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '检测录入')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '查找可检测任务' })).toBeVisible()
    expect(screen.getByText('选择任务').closest('.step')).not.toHaveClass('done')
    expect(screen.getByText('选择操作').closest('.step')).toHaveClass('done')
    expect(screen.getByText('人工确认').closest('.step')).not.toHaveClass('active')
    expect(screen.getByLabelText('文字指令')).toHaveAttribute('placeholder', '输入产品、工序、产线或任务号')
    const fallback = screen.getByText('手动输入与筛选').closest('details')!
    expect(fallback).not.toHaveAttribute('open')
    expect(within(fallback).getByLabelText('文字指令')).not.toBeVisible()
    expect(within(fallback).queryByRole('button', { name: '查 C-007 工序' })).not.toBeInTheDocument()
    await user.click(screen.getByText('手动输入与筛选'))
    expect(fallback).toHaveAttribute('open')
    expect(within(fallback).getByLabelText('文字指令')).toBeVisible()
    expect(screen.queryByRole('button', { name: '外径 D1，第 1 列，87.38' })).not.toBeInTheDocument()
  })

  it('未选任务进入生产报工时不提前引导录入数量', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '生产报工')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '查找可报工任务' })).toBeVisible()
    expect(input).toHaveAttribute('placeholder', '输入产品、工序、产线或任务号')
    const fallback = screen.getByText('手动输入与筛选').closest('details')!
    expect(fallback).not.toHaveAttribute('open')
    expect(within(fallback).getByLabelText('文字指令')).not.toBeVisible()
    expect(within(fallback).queryByRole('button', { name: '查回火工序' })).not.toBeInTheDocument()
    await user.click(screen.getByText('手动输入与筛选'))
    expect(fallback).toHaveAttribute('open')
    expect(within(fallback).getByLabelText('文字指令')).toBeVisible()
    expect(screen.queryByRole('button', { name: '完工 18，报废 0' })).not.toBeInTheDocument()
  })

  it('候选状态下说第一个可直接选择当前第一条任务', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '检测录入')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await waitFor(() => expect(input).toHaveValue(''))
    await user.type(input, '查 C-007 工序')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findAllByRole('button', { name: /候选 \d+ C-007/ })).toHaveLength(3)

    await waitFor(() => expect(input).toHaveValue(''))
    await user.type(input, '第一个')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: 'C-007工序任务' })).toBeVisible()
    expect(screen.getAllByText('GP22010401-6').length).toBeGreaterThan(0)
  })

  it('多轮查询在页面上保留上一轮条件并补充新线索', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '查回火工序')
    await user.click(screen.getByRole('button', { name: '执行' }))
    await waitFor(() => expect(input).toHaveValue(''))
    await user.type(input, '三厂 OE 机加 3 号线')
    await user.click(screen.getByRole('button', { name: '执行' }))

    const understanding = screen.getByRole('heading', { name: '智能理解' }).closest('aside')!
    expect(within(understanding).getByText('回火')).toBeVisible()
    expect(await within(understanding).findByText('三厂OE机加3号线')).toBeVisible()
  })

  it('当前任务正文直接说明两项操作的可用性与原因', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '打开 GP26030719 回火')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByText('生产报工可用')).toBeVisible()
    expect(screen.getByText('检测录入不可用：当前任务没有可用检验记录')).toBeVisible()
  })

  it('检测操作的同工序候选显示不同逻辑工序号供人工区分', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '检测录入')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findByRole('heading', { name: '查找可检测任务' })).toBeVisible()
    await user.type(input, '查 C-007 工序')
    await user.click(screen.getByRole('button', { name: '执行' }))

    const candidates = await screen.findAllByRole('button', { name: /候选 \d+ C-007/ })
    expect(candidates).toHaveLength(3)
    const taskIds = candidates.map((candidate) => candidate.textContent?.match(/GP\d{8}-\d+/)?.[0])
    expect(new Set(taskIds).size).toBe(3)
  })

  it('业务界面不显示内部英文标签和跨操作规则说明', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByText('VOICE FIRST')).not.toBeInTheDocument()
    expect(screen.queryByText('TASK FLOW')).not.toBeInTheDocument()
    expect(screen.queryByText('SYSTEM UNDERSTANDING')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '网商语音助手' })).toBeVisible()
    expect(screen.queryByText('兆丰语音操作助手')).not.toBeInTheDocument()
    expect(screen.queryByText('语音助手', { selector: '.voice-panel .eyebrow' })).not.toBeInTheDocument()
    expect(screen.queryByText('产品、工序、产线或任务号')).not.toBeInTheDocument()
    expect(screen.queryByText('从真实候选中确认')).not.toBeInTheDocument()
    expect(screen.queryByText('生产报工或检测录入')).not.toBeInTheDocument()
    expect(screen.queryByText('最终动作必须真实点击')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '智能理解' })).not.toBeInTheDocument()

    const input = screen.getByLabelText('文字指令')
    await user.type(input, '检测录入，GP22010599')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '录入检验结果' })).toBeVisible()
    expect(screen.queryByText(/需要报工时请明确说/)).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '智能检测录入' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '完工报工草稿' })).not.toBeInTheDocument()
  })

  it('首屏只保留主任务和语音入口，解析与反馈在输入后才出现', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: '查找生产任务' })).toBeVisible()
    const voiceCommandBar = screen.getByRole('group', { name: '语音指令' })
    expect(voiceCommandBar).toBeVisible()
    expect(within(voiceCommandBar).getByRole('button', { name: '启用语音' })).toBeVisible()
    expect(within(voiceCommandBar).getByText('语音未启用')).toBeVisible()
    expect(screen.queryByText(/可说[：:]/)).not.toBeInTheDocument()
    expect(document.querySelector('.workspace')).not.toHaveClass('with-understanding')
    expect(screen.queryByText('全局任务选择、生产报工与智能检测录入')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('当前业务操作')).not.toBeInTheDocument()
    expect(screen.queryByText('等待输入')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('语音识别内容')).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '助手反馈' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '智能理解' })).not.toBeInTheDocument()
    expect(screen.queryByText('产品、工序、产线或任务号')).not.toBeInTheDocument()
    expect(screen.queryByText('首次使用需手动授权麦克风')).not.toBeInTheDocument()
    expect(screen.queryByText('首次使用需要点击授权')).not.toBeInTheDocument()

    const manualSummary = screen.getByText('手动输入与筛选')
    await user.click(manualSummary)
    await user.type(screen.getByLabelText('文字指令'), '查回火工序')
    await user.click(screen.getByRole('button', { name: '执行' }))

    const understanding = await screen.findByRole('heading', { name: '智能理解' })
    expect(understanding).toBeVisible()
    expect(screen.queryByRole('heading', { name: '小we理解' })).not.toBeInTheDocument()
    const understandingPanel = understanding.closest('aside')!
    expect(await within(understandingPanel).findByText('回火')).toBeVisible()
    expect(within(understandingPanel).getByText('我听到')).toBeVisible()
    expect(document.querySelector('.workspace')).toHaveClass('with-understanding')
    expect(await screen.findByRole('status', { name: '助手反馈' })).toBeVisible()
    expect(manualSummary.closest('details')).not.toHaveAttribute('open')
  })

  it('语音主按钮统一承担授权与监听，并显示连续状态反馈', async () => {
    const user = userEvent.setup()
    installVoiceBrowserFakes()
    render(<App />)

    const voiceCommandBar = screen.getByRole('group', { name: '语音指令' })
    expect(voiceCommandBar).toHaveAttribute('data-voice-state', 'off')

    await user.click(within(voiceCommandBar).getByRole('button', { name: '启用语音' }))
    await waitFor(() => expect(voiceCommandBar).toHaveAttribute('data-voice-state', 'wake'))
    expect(within(voiceCommandBar).getByText('等待“你好小we”')).toBeVisible()
    expect(screen.queryByRole('button', { name: '启用语音' })).not.toBeInTheDocument()

    await user.click(within(voiceCommandBar).getByRole('button', { name: '点击开始说话' }))
    await waitFor(() => expect(voiceCommandBar).toHaveAttribute('data-voice-state', 'listening'))
    expect(within(voiceCommandBar).getByText('正在听，请说出需求')).toBeVisible()
  })

  it('按工序查询任务时保持未选择操作，不把查询当成业务场景', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    expect(screen.getByRole('heading', { name: '查找生产任务' })).toBeVisible()
    await user.type(input, '查回火工序')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '回火工序任务' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '查找生产任务' })).toBeVisible()
    expect(screen.queryByText(/切换口令：任务查询/)).not.toBeInTheDocument()
  })

  it('生产报工组合指令完成任务绑定并直接创建本地草稿', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '生产报工，GP26030719，回火')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '完工报工草稿' })).toBeVisible()
    expect(screen.getAllByText('GP26030719-6').length).toBeGreaterThan(0)
  })

  it('检测录入组合指令先应用新任务线索，不被旧任务的无关联状态阻断', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('文字指令')

    await user.type(input, '打开 GP26030719 回火')
    await user.click(screen.getByRole('button', { name: '执行' }))
    expect(await screen.findByRole('heading', { name: '回火工序任务' })).toBeVisible()

    await user.type(input, '检测录入，GP22010599')
    await user.click(screen.getByRole('button', { name: '执行' }))

    expect(await screen.findByRole('heading', { name: '智能检测录入' })).toBeVisible()
    expect(screen.getAllByText('GP22010599-6').length).toBeGreaterThan(0)
  })
})
