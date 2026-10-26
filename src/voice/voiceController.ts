export type VoiceMode = 'off' | 'wake' | 'command' | 'idle' | 'speaking' | 'unavailable'

export interface VoiceSnapshot {
  mode: VoiceMode
  enabled: boolean
  listening: boolean
  ttsEnabled: boolean
  status: string
  transcript: string
}

interface RecognitionResultLike extends ArrayLike<{ transcript?: string; confidence?: number }> {
  isFinal?: boolean
}

export interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: unknown) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
  onspeechstart: (() => void) | null
  onspeechend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export type RecognitionConstructor = new () => RecognitionLike

export interface UtteranceLike {
  lang: string
  rate: number
  onend: (() => void) | null
  onerror: (() => void) | null
}

export interface SynthesisLike {
  speak(utterance: UtteranceLike): void
  cancel(): void
}

export interface VoiceControllerOptions {
  recognitionCtor: RecognitionConstructor | null
  getUserMedia?: () => Promise<{ getTracks(): Array<{ stop(): void }> }>
  synthesis?: SynthesisLike | null
  createUtterance?: ((text: string) => UtteranceLike) | null
  onState?: (snapshot: VoiceSnapshot) => void
  onTranscript?: (text: string) => void
  onCommand?: (command: string, transcript: string) => void
  onWake?: () => void
  onFeedback?: (tone: 'idle' | 'success' | 'error', message: string) => void
}

type FinishReason = 'final' | 'manual' | 'pause' | 'maximum' | 'silence' | 'error' | 'ended'
const WAKE_WORD_PATTERN = /你好[\s,，。！!、:：-]*小[\s,，。！!、:：-]*we/i
const COMMAND_PAUSE_MS = 1800

export class VoiceController {
  private readonly options: VoiceControllerOptions
  private recognition: RecognitionLike | null = null
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private commandPauseTimer: ReturnType<typeof setTimeout> | null = null
  private session = 0
  private disposed = false
  private enabled = false
  private ttsEnabled = false
  private mode: VoiceMode = 'off'
  private status = '首次使用需要点击授权'
  private commandText = ''
  private commandConfidence = 1
  private transcript = ''
  private activeUtterance: UtteranceLike | null = null

  constructor(options: VoiceControllerOptions) {
    this.options = options
    this.emitState()
  }

  getSnapshot(): VoiceSnapshot {
    return {
      mode: this.mode,
      enabled: this.enabled,
      listening: this.mode === 'wake' || this.mode === 'command',
      ttsEnabled: this.ttsEnabled,
      status: this.status,
      transcript: this.transcript,
    }
  }

  async enable() {
    if (!this.options.recognitionCtor || !this.options.getUserMedia) {
      this.markUnavailable('当前 Edge 未提供可用的语音识别或麦克风接口')
      return false
    }
    try {
      this.setMode('idle', '正在请求麦克风权限…')
      const stream = await this.options.getUserMedia()
      stream.getTracks().forEach((track) => track.stop())
      if (this.disposed) return false
      this.enabled = true
      this.options.onFeedback?.('success', '麦克风授权成功')
      this.startWakeListening()
      return true
    } catch (error) {
      const denied = (error as { name?: string })?.name === 'NotAllowedError'
      this.markUnavailable(denied ? '麦克风权限被拒绝' : '麦克风不可用，请检查设备和权限')
      return false
    }
  }

  toggleCommandListening() {
    if (!this.enabled) {
      this.options.onFeedback?.('error', '请先点击启用语音')
      return false
    }
    if (this.mode === 'command') this.finishCommand('manual')
    else this.startCommandListening()
    return true
  }

  setTtsEnabled(enabled: boolean) {
    if (enabled && (!this.options.synthesis || !this.options.createUtterance)) {
      this.ttsEnabled = false
      this.options.onFeedback?.('error', '当前浏览器语音播报不可用')
      this.emitState()
      return false
    }
    this.ttsEnabled = enabled
    if (!enabled) {
      this.cancelSpeechSilently()
      if (this.mode === 'speaking' && this.enabled) this.startWakeListening()
    }
    this.emitState()
    return true
  }

  speak(text: string) {
    if (!this.ttsEnabled || !text || !this.options.synthesis || !this.options.createUtterance) return false
    this.cancelSpeechSilently()
    this.stopRecognition()
    this.setMode('speaking', '正在播报')
    const utterance = this.options.createUtterance(text)
    this.activeUtterance = utterance
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    let finished = false
    const complete = (failed: boolean) => {
      if (finished || this.disposed) return
      finished = true
      if (this.activeUtterance === utterance) this.activeUtterance = null
      if (failed) this.options.onFeedback?.('error', '语音播报失败，已保留文字反馈')
      if (this.enabled) this.startWakeListening()
      else this.setMode('off', '语音未启用')
    }
    utterance.onend = () => complete(false)
    utterance.onerror = () => complete(true)
    try {
      this.options.synthesis.speak(utterance)
      return true
    } catch {
      complete(true)
      return false
    }
  }

  dispose() {
    this.disposed = true
    this.enabled = false
    this.ttsEnabled = false
    this.stopRecognition()
    this.cancelSpeechSilently()
    this.mode = 'off'
  }

  private cancelSpeechSilently() {
    if (this.activeUtterance) {
      this.activeUtterance.onend = null
      this.activeUtterance.onerror = null
      this.activeUtterance = null
    }
    this.options.synthesis?.cancel()
  }

  private emitState() {
    if (!this.disposed) this.options.onState?.(this.getSnapshot())
  }

  private setMode(mode: VoiceMode, status: string) {
    this.mode = mode
    this.status = status
    this.emitState()
  }

  private markUnavailable(message: string) {
    this.stopRecognition()
    this.enabled = false
    this.setMode('unavailable', message)
    this.options.onFeedback?.('error', message)
  }

  private schedule(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      callback()
    }, delay)
    this.timers.add(timer)
    return timer
  }

  private clearTimers() {
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers.clear()
    this.silenceTimer = null
    this.commandPauseTimer = null
  }

  private clearSilenceTimer() {
    if (!this.silenceTimer) return
    clearTimeout(this.silenceTimer)
    this.timers.delete(this.silenceTimer)
    this.silenceTimer = null
  }

  private scheduleCommandPause() {
    if (this.commandPauseTimer) {
      clearTimeout(this.commandPauseTimer)
      this.timers.delete(this.commandPauseTimer)
    }
    this.commandPauseTimer = this.schedule(() => {
      this.commandPauseTimer = null
      this.finishCommand('pause')
    }, COMMAND_PAUSE_MS)
  }

  private stopRecognition() {
    this.session += 1
    this.clearTimers()
    const recognition = this.recognition
    this.recognition = null
    if (!recognition) return
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    recognition.onspeechstart = null
    recognition.onspeechend = null
    try { recognition.abort() } catch { /* 浏览器可能已自行结束 */ }
  }

  private makeRecognition() {
    const Recognition = this.options.recognitionCtor
    if (!Recognition) return null
    const recognition = new Recognition()
    recognition.lang = 'zh-CN'
    recognition.maxAlternatives = 1
    return recognition
  }

  private startWakeListening() {
    if (!this.enabled || this.disposed) return
    this.stopRecognition()
    const recognition = this.makeRecognition()
    if (!recognition) return this.markUnavailable('当前 Edge 未提供语音识别接口')
    recognition.continuous = true
    recognition.interimResults = false
    const token = this.session
    this.recognition = recognition
    this.setMode('wake', '等待“你好小we”')
    recognition.onresult = (event) => {
      if (token !== this.session || this.mode !== 'wake') return
      const items = this.readResults(event)
      for (const item of items) {
        const transcript = item.text.trim()
        const wakeMatch = transcript.match(WAKE_WORD_PATTERN)
        if (!wakeMatch) continue
        const command = transcript.slice((wakeMatch.index ?? 0) + wakeMatch[0].length).replace(/^[\s,，。！!、:：-]+/, '').trim()
        this.options.onWake?.()
        this.stopRecognition()
        if (command) {
          this.transcript = command
          this.options.onTranscript?.(command)
          const normalized = item.confidence < 0.65 ? `低置信度：${command}` : command
          this.setMode('idle', '正在处理语音指令')
          this.options.onCommand?.(normalized, command)
          this.schedule(() => this.startWakeListening(), 300)
        } else {
          this.transcript = ''
          this.setMode('idle', '已唤醒，请说指令')
          this.startCommandListening()
        }
        return
      }
    }
    recognition.onerror = (event) => {
      if (token !== this.session) return
      const error = (event as { error?: string })?.error
      if (error === 'not-allowed' || error === 'service-not-allowed') this.markUnavailable('麦克风或语音服务权限不可用')
    }
    recognition.onend = () => {
      if (token !== this.session || this.mode !== 'wake' || !this.enabled) return
      this.recognition = null
      this.schedule(() => this.startWakeListening(), 300)
    }
    try { recognition.start() } catch { this.schedule(() => this.startWakeListening(), 500) }
  }

  private startCommandListening() {
    if (!this.enabled || this.disposed) return
    this.stopRecognition()
    const recognition = this.makeRecognition()
    if (!recognition) return this.markUnavailable('当前 Edge 未提供语音识别接口')
    recognition.continuous = true
    recognition.interimResults = true
    this.commandText = ''
    this.commandConfidence = 1
    this.transcript = ''
    const token = this.session
    this.recognition = recognition
    this.setMode('command', '正在听，请说出需求')
    this.silenceTimer = this.schedule(() => this.finishCommand('silence'), 3000)
    this.schedule(() => this.finishCommand('maximum'), 15000)
    recognition.onspeechstart = () => {
      if (token !== this.session) return
      this.clearSilenceTimer()
      this.setMode('command', '已检测到说话')
    }
    recognition.onspeechend = () => {
      if (token === this.session) this.scheduleCommandPause()
    }
    recognition.onresult = (event) => {
      if (token !== this.session || this.mode !== 'command') return
      const items = this.readResults(event)
      this.commandText = items.map((item) => item.text).join('').trim()
      this.commandConfidence = items.reduce((value, item) => Math.min(value, item.confidence), 1)
      if (!this.commandText) return
      this.transcript = this.commandText
      this.clearSilenceTimer()
      this.options.onTranscript?.(this.commandText)
      this.emitState()
      this.scheduleCommandPause()
    }
    recognition.onerror = (event) => {
      if (token !== this.session) return
      const error = (event as { error?: string })?.error
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        this.markUnavailable('麦克风或语音服务权限不可用')
        return
      }
      this.commandText = ''
      this.finishCommand('error')
    }
    recognition.onend = () => {
      if (token === this.session && this.mode === 'command') this.finishCommand('ended')
    }
    try { recognition.start() } catch {
      this.options.onFeedback?.('error', '语音启动失败，请使用文字输入')
      this.finishCommand('error')
    }
  }

  private finishCommand(reason: FinishReason) {
    if (this.mode !== 'command') return
    const transcript = this.commandText.trim()
    const confidence = this.commandConfidence
    this.stopRecognition()
    if (transcript && reason !== 'error' && reason !== 'silence') {
      this.setMode('idle', '正在处理语音指令')
      const command = confidence < 0.65 ? `低置信度：${transcript}` : transcript
      this.options.onCommand?.(command, transcript)
      this.schedule(() => this.startWakeListening(), 300)
    } else {
      const message = reason === 'silence'
        ? '本次没有执行。3秒内未检测到说话，请重新说一遍。'
        : reason === 'error'
          ? '本次没有执行。语音识别失败，请重新说一遍。'
          : '本次没有执行。没有识别到有效内容，请重新说一遍。'
      this.setMode('idle', '本次没有执行')
      this.options.onFeedback?.(reason === 'error' ? 'error' : 'idle', message)
      if (!this.speak(message)) this.schedule(() => this.startWakeListening(), 300)
    }
  }

  private readResults(event: unknown) {
    const source = event as { results?: ArrayLike<RecognitionResultLike> }
    const results = source.results ? Array.from(source.results) : []
    return results.map((result) => {
      const alternative = result[0]
      return {
        text: alternative?.transcript?.trim() ?? '',
        confidence: alternative?.confidence || 1,
        isFinal: Boolean(result.isFinal),
      }
    }).filter((item) => item.text)
  }
}
