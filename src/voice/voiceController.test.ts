import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VoiceController, type RecognitionLike, type VoiceSnapshot } from './voiceController'

class FakeRecognition implements RecognitionLike {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  onspeechstart: (() => void) | null = null
  onspeechend: (() => void) | null = null
  started = false
  stopped = false
  aborted = false

  constructor() {
    FakeRecognition.instances.push(this)
  }

  start() { this.started = true }
  stop() { this.stopped = true }
  abort() { this.aborted = true }

  emitResult(text: string, isFinal = true, confidence = 1) {
    const alternative = { transcript: text, confidence }
    const result = Object.assign([alternative], { isFinal })
    this.onresult?.({ resultIndex: 0, results: [result] })
  }
}

class FakeUtterance {
  lang = ''
  rate = 1
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public text: string) {}
}

function setupController() {
  const states: VoiceSnapshot[] = []
  const transcripts: string[] = []
  const commands: Array<{ command: string; transcript: string }> = []
  const feedback: Array<{ tone: string; message: string }> = []
  const track = { stop: vi.fn() }
  const getUserMedia = vi.fn(async () => ({ getTracks: () => [track] }))
  const synthesis = { speak: vi.fn(), cancel: vi.fn() }
  const utterances: FakeUtterance[] = []
  const onWake = vi.fn()
  const controller = new VoiceController({
    recognitionCtor: FakeRecognition,
    getUserMedia,
    synthesis,
    createUtterance: (text) => {
      const utterance = new FakeUtterance(text)
      utterances.push(utterance)
      return utterance
    },
    onState: (snapshot) => states.push(snapshot),
    onTranscript: (text) => transcripts.push(text),
    onCommand: (command, transcript) => commands.push({ command, transcript }),
    onWake,
    onFeedback: (tone, message) => feedback.push({ tone, message }),
  })
  return { controller, states, transcripts, commands, feedback, getUserMedia, track, synthesis, utterances, onWake }
}

describe('VoiceController', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeRecognition.instances = []
  })

  afterEach(() => vi.useRealTimers())

  it('只有手动授权成功后才进入持续唤醒监听', async () => {
    const { controller, getUserMedia, track, states } = setupController()

    await controller.enable()

    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(track.stop).toHaveBeenCalledOnce()
    expect(FakeRecognition.instances[0]).toMatchObject({
      lang: 'zh-CN',
      continuous: true,
      interimResults: false,
      started: true,
    })
    expect(states.at(-1)).toMatchObject({ mode: 'wake', enabled: true, status: '等待“你好小we”' })
  })

  it('听到单独唤醒词后立即提示并切换到单轮指令收音', async () => {
    const { controller, states, onWake } = setupController()
    await controller.enable()

    FakeRecognition.instances[0].emitResult('你好小we')

    expect(onWake).toHaveBeenCalledOnce()
    expect(FakeRecognition.instances[1]).toMatchObject({ continuous: true, interimResults: true, started: true })
    expect(states.at(-1)).toMatchObject({ mode: 'command', listening: true, status: '正在听，请说出需求' })
  })

  it('唤醒词后同句携带指令时直接提交，并自动回到唤醒监听', async () => {
    const { controller, commands, transcripts, states, onWake } = setupController()
    await controller.enable()

    FakeRecognition.instances[0].emitResult('你好小we 打开 GP26030719')

    expect(transcripts.at(-1)).toBe('打开 GP26030719')
    expect(commands).toEqual([{ command: '打开 GP26030719', transcript: '打开 GP26030719' }])
    expect(onWake).toHaveBeenCalledOnce()
    expect(states.at(-1)).toMatchObject({ mode: 'idle', status: '正在处理语音指令', transcript: '打开 GP26030719' })
    await vi.advanceTimersByTimeAsync(300)
    expect(states.at(-1)?.mode).toBe('wake')
    expect(FakeRecognition.instances.at(-1)?.continuous).toBe(true)
  })

  it('3 秒没有开始说话时不执行中间内容，并恢复唤醒监听', async () => {
    const { controller, commands, feedback, states } = setupController()
    await controller.enable()
    controller.toggleCommandListening()

    await vi.advanceTimersByTimeAsync(3000)

    expect(commands).toHaveLength(0)
    expect(feedback.at(-1)?.message).toContain('3秒内未检测到说话')
    await vi.advanceTimersByTimeAsync(300)
    expect(states.at(-1)?.mode).toBe('wake')
  })

  it('浏览器只返回中间转写时，等待1.8秒连续停顿后才提交指令', async () => {
    const { controller, commands } = setupController()
    await controller.enable()
    controller.toggleCommandListening()

    const commandRecognition = FakeRecognition.instances.at(-1)!
    commandRecognition.emitResult('打开 GP26060001', false, 0.9)

    await vi.advanceTimersByTimeAsync(1799)
    expect(commands).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)

    expect(commands).toEqual([{ command: '打开 GP26060001', transcript: '打开 GP26060001' }])
  })

  it('浏览器提前返回最终结果时不立即提交，并允许继续补充长句', async () => {
    const { controller, commands } = setupController()
    await controller.enable()
    controller.toggleCommandListening()

    const commandRecognition = FakeRecognition.instances.at(-1)!
    commandRecognition.onspeechstart?.()
    commandRecognition.emitResult('查三厂OE机加3号线', true, 0.9)

    expect(commands).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1200)
    commandRecognition.emitResult('查三厂OE机加3号线淬火工序正在运行的任务', false, 0.9)
    await vi.advanceTimersByTimeAsync(1799)
    expect(commands).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)

    expect(commands).toEqual([{
      command: '查三厂OE机加3号线淬火工序正在运行的任务',
      transcript: '查三厂OE机加3号线淬火工序正在运行的任务',
    }])
  })

  it('单轮最长 15 秒，到时提交已识别内容并结束收音', async () => {
    const { controller, commands } = setupController()
    await controller.enable()
    controller.toggleCommandListening()
    const commandRecognition = FakeRecognition.instances.at(-1)!
    commandRecognition.onspeechstart?.()
    commandRecognition.emitResult('打开 GP26060001', false, 0.9)

    await vi.advanceTimersByTimeAsync(15000)

    expect(commands).toEqual([{ command: '打开 GP26060001', transcript: '打开 GP26060001' }])
    expect(commandRecognition.aborted || commandRecognition.stopped).toBe(true)
  })

  it('播报期间停止识别，播报结束或失败后恢复唤醒监听', async () => {
    const { controller, synthesis, utterances, states } = setupController()
    await controller.enable()
    expect(controller.setTtsEnabled(true)).toBe(true)

    expect(controller.speak('查询完成')).toBe(true)
    expect(synthesis.speak).toHaveBeenCalledOnce()
    expect(states.at(-1)?.mode).toBe('speaking')
    utterances[0].onend?.()
    expect(states.at(-1)?.mode).toBe('wake')

    controller.speak('第二次播报')
    utterances[1].onerror?.()
    expect(states.at(-1)?.mode).toBe('wake')
  })

  it('新播报主动替换旧播报时不报告语音播报失败', async () => {
    const { controller, synthesis, utterances, feedback } = setupController()
    await controller.enable()
    controller.setTtsEnabled(true)

    controller.speak('已进入智能检测录入')
    synthesis.cancel.mockImplementation(() => utterances[0].onerror?.())
    controller.speak('已加载 GP22010599 检验记录')

    expect(feedback).toEqual([{ tone: 'success', message: '麦克风授权成功' }])
    expect(synthesis.speak).toHaveBeenCalledTimes(2)
  })
})
