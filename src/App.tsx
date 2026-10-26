import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, Mic, MicOff, Volume2 } from 'lucide-react'
import { clearSession, loadSession, saveSession } from './adapters/session'
import {
  buildFeedback,
  buildRestoreFeedback,
  hasRestorableBusinessState,
  type InteractionNotice,
} from './domain/feedback'
import { parseCommand, parseConditionChanges, parseReportChanges, parseSelectionIndex } from './domain/parser'
import { LINES, PRODUCTS, PROCESSES } from './domain/tasks'
import { INSPECTION_RECORDS } from './domain/inspection'
import {
  VoiceController,
  type RecognitionConstructor,
  type SynthesisLike,
  type UtteranceLike,
  type VoiceSnapshot,
} from './voice/voiceController'
import {
  confirmMeasurementByManualClick,
  discardUnconfirmedByManualClick,
  executeTool,
  getDraftValidation,
  getSelectedTask,
  getTaskCapabilities,
  getToolDefinitions,
  saveDemoRecordByManualClick,
  type Conditions,
  type PrototypeState,
  type ToolResult,
  type ToolSource,
} from './domain/workflow'

const phaseLabels = {
  ready: '准备执行',
  running: '正在执行',
  succeeded: '执行成功',
  awaiting_manual_confirmation: '等待人工确认',
  blocked: '已拦截',
}

const sectionLabels = {
  voice: '语音入口',
  understanding: '智能理解',
  candidates: '候选任务',
  'current-task': '当前任务',
  report: '报工草稿',
  inspection: '检测录入',
  complete: '完成结果',
}

function parseOperationRequest(text: string) {
  const patterns = [
    { operation: 'inspection' as const, pattern: /(?:智能检测录入|开始检测录入|检测录入)/ },
    { operation: 'report' as const, pattern: /(?:生产报工|完工报工)/ },
  ]
  for (const candidate of patterns) {
    const match = text.match(candidate.pattern)
    if (!match || match.index === undefined) continue
    const trailingInput = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`
      .replace(/^[\s，,。；;：:]+|[\s，,。；;：:]+$/g, '')
    return { operation: candidate.operation, trailingInput }
  }
  return null
}

const sourceLabels = { voice: '语音', text: '文字', button: '页面按钮', system: '开发验证' }
const conditionLabels: Record<string, string> = {
  parent: '母任务号',
  product: '产品',
  process: '工序',
  line: '产线',
  status: '数据记录状态',
}

type PendingAction = { toolId: string; payload: Record<string, unknown>; source: ToolSource } | null
type RunToolUiOptions = { phaseDelayMs?: number; lockUi?: boolean; showIntermediate?: boolean }
const TOOL_PHASE_DELAY_MS = import.meta.env.MODE === 'test' ? 80 : 120

function playWakeCue() {
  const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!AudioContextCtor) return
  try {
    const context = new AudioContextCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, context.currentTime)
    gain.gain.setValueAtTime(0.12, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(context.currentTime)
    oscillator.stop(context.currentTime + 0.09)
    window.setTimeout(() => void context.close(), 140)
  } catch {
    // 浏览器限制提示音时，继续使用页面状态反馈。
  }
}

function App() {
  const [state, setState] = useState<PrototypeState>(loadSession)
  const stateRef = useRef(state)
  const [command, setCommand] = useState('')
  const commandRef = useRef('')
  const [interactionNotice, setInteractionNotice] = useState<InteractionNotice | null>(null)
  const [showRestoreFeedback, setShowRestoreFeedback] = useState(() => hasRestorableBusinessState(state))
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [toolBusy, setToolBusy] = useState(false)
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceSnapshot>({
    mode: 'off',
    enabled: false,
    listening: false,
    ttsEnabled: false,
    status: '首次使用需要点击授权',
    transcript: '',
  })
  const [understandingSessionStarted, setUnderstandingSessionStarted] = useState(
    () => Boolean(state.lastTranscript || state.activeToolRun),
  )
  const [filters, setFilters] = useState<Conditions>({ status: '运行' })
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const voiceControllerRef = useRef<VoiceController | null>(null)
  const draftUpdateQueueRef = useRef<Promise<void>>(Promise.resolve())
  const candidateSectionRef = useRef<HTMLElement>(null)
  const currentTaskSectionRef = useRef<HTMLElement>(null)
  const reportSectionRef = useRef<HTMLElement>(null)
  const inspectionSectionRef = useRef<HTMLElement>(null)
  const successSectionRef = useRef<HTMLElement>(null)
  const understandingSectionRef = useRef<HTMLElement>(null)
  const pendingDialogRef = useRef<HTMLElement>(null)
  const confirmationDialogRef = useRef<HTMLElement>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)
  const manualToolsRef = useRef<HTMLDetailsElement>(null)
  const modalTriggerRef = useRef<HTMLElement | null>(null)
  const modalOpen = Boolean(pendingAction || confirmationOpen)

  function updateCommand(value: string) {
    commandRef.current = value
    setCommand(value)
  }

  function focusAffectedSection(section: ToolResult['run']['affectedSection']) {
    const element = {
      candidates: candidateSectionRef.current,
      'current-task': currentTaskSectionRef.current,
      report: reportSectionRef.current,
      inspection: inspectionSectionRef.current,
      complete: successSectionRef.current,
      understanding: understandingSectionRef.current,
      voice: document.querySelector<HTMLElement>('.voice-panel'),
    }[section]
    if (!element) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    const active = document.activeElement as HTMLElement | null
    const editing = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)
    if (editing) return
    if (section === 'candidates') {
      const target = element.querySelector<HTMLElement>('.candidate-card')
        ?? element.querySelector<HTMLElement>('.clarification button')
      if (target) target.focus({ preventScroll: true })
      else element.focus({ preventScroll: true })
      return
    }
    const selector = section === 'current-task'
      ? '.btn.primary'
      : section === 'report'
          ? 'input'
          : section === 'inspection'
            ? 'button, [tabindex="-1"]'
          : section === 'complete'
            ? 'button'
            : section === 'voice'
              ? 'input'
              : null
    if (selector) element.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true })
    else element.focus({ preventScroll: true })
  }

  function restoreModalTrigger() {
    const trigger = modalTriggerRef.current
    modalTriggerRef.current = null
    requestAnimationFrame(() => trigger?.focus({ preventScroll: true }))
  }

  function closePendingDialog() {
    setPendingAction(null)
    restoreModalTrigger()
  }

  function closeConfirmationDialog() {
    setConfirmationOpen(false)
    restoreModalTrigger()
  }

  const applyState = (next: PrototypeState) => {
    stateRef.current = next
    setState(next)
  }

  useEffect(() => {
    stateRef.current = state
    saveSession(state)
  }, [state])

  useEffect(() => {
    if (state.lastTranscript || state.activeToolRun) setUnderstandingSessionStarted(true)
  }, [state.activeToolRun, state.lastTranscript])

  useEffect(() => {
    const recognitionCtor = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null) as RecognitionConstructor | null
    const synthesis = 'speechSynthesis' in window ? window.speechSynthesis as unknown as SynthesisLike : null
    const canCreateUtterance = typeof SpeechSynthesisUtterance !== 'undefined'
    const controller = new VoiceController({
      recognitionCtor,
      getUserMedia: navigator.mediaDevices?.getUserMedia
        ? () => navigator.mediaDevices.getUserMedia({ audio: true })
        : undefined,
      synthesis,
      createUtterance: canCreateUtterance
        ? (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike
        : null,
      onState: setVoiceSnapshot,
      onTranscript: (text) => {
        applyState({ ...stateRef.current, lastTranscript: text })
      },
      onCommand: (voiceCommand, transcript) => {
        void handleCommand('voice', voiceCommand, transcript)
      },
      onWake: playWakeCue,
      onFeedback: (tone, message) => {
        const notExecuted = /(?:没有执行|未执行)/.test(message)
        setShowRestoreFeedback(false)
        setInteractionNotice({
          tone: notExecuted ? 'error' : tone,
          title: notExecuted ? '本次未执行' : tone === 'error' ? '语音降级' : tone === 'success' ? '语音已启用' : '等待唤醒',
          result: message,
          next: notExecuted
            ? '请重新说一遍，或打开“手动输入与筛选”。'
            : tone === 'error'
              ? '继续使用文字输入或手动筛选。'
              : '说“你好小we”或点击麦克风。',
          invokedTool: false,
        })
      },
    })
    voiceControllerRef.current = controller
    controller.setTtsEnabled(stateRef.current.voiceReplyEnabled)
    return () => {
      controller.dispose()
      voiceControllerRef.current = null
    }
  }, [])

  useEffect(() => {
    setFilters({
      product: state.conditions.product,
      process: state.conditions.process,
      line: state.conditions.line,
      status: state.activeOperation === 'inspection' && state.conditions.status === undefined
        ? undefined
        : state.conditions.status === undefined
        ? (state.conditions.parent ? undefined : '运行')
        : state.conditions.status,
    })
  }, [state.activeOperation, state.conditions])

  useEffect(() => {
    const dialog = pendingDialogRef.current ?? confirmationDialogRef.current
    if (!dialog) return
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
    focusables()[0]?.focus({ preventScroll: true })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        pendingAction ? closePendingDialog() : closeConfirmationDialog()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog.addEventListener('keydown', handleKeyDown)
    return () => dialog.removeEventListener('keydown', handleKeyDown)
  }, [pendingAction, confirmationOpen])

  useEffect(() => {
    ;(window as any).__zfReactPrototype = {
      getState: () => structuredClone(stateRef.current),
      listTools: () => Object.keys(getToolDefinitions()),
      execute: async (toolId: string, payload: Record<string, unknown> = {}, source: ToolSource = 'system') => {
        const result = await executeTool(stateRef.current, toolId, payload, source, {
          onPhase: (intermediate) => applyState(intermediate.state),
          phaseDelayMs: TOOL_PHASE_DELAY_MS,
        })
        applyState(result.state)
        requestAnimationFrame(() => focusAffectedSection(result.run.affectedSection))
        return result.run
      },
    }
  }, [])

  const selectedTask = useMemo(() => getSelectedTask(state), [state])
  const taskCapabilities = useMemo(() => getTaskCapabilities(selectedTask), [selectedTask])
  const inspectionRecords = useMemo(
    () => state.inspectionContext.recordCandidates
      .map((masterGuid) => INSPECTION_RECORDS.find((record) => record.masterGuid === masterGuid))
      .filter((record): record is NonNullable<typeof record> => Boolean(record)),
    [state.inspectionContext.recordCandidates],
  )
  const selectedInspectionRecord = useMemo(
    () => INSPECTION_RECORDS.find((record) => record.masterGuid === state.inspectionContext.selectedRecordGuid) ?? null,
    [state.inspectionContext.selectedRecordGuid],
  )
  const validation = useMemo(() => getDraftValidation(state), [state])
  const latestRecord = state.records.at(-1)
  const flowComplete = Boolean(latestRecord && !state.draft && selectedTask && latestRecord.RJHguid === selectedTask.rjhguid)
  const hasQueryContext = Object.values(state.conditions).some(Boolean) || state.results.length > 0 || Boolean(selectedTask)
  const hasPendingConfirmation = Boolean(state.draft || state.inspectionContext.measurementDraft)
  const inspectionComplete = state.inspectionContext.confirmedMeasurements.length > 0
  const flowStepStates: Array<'done' | 'active' | 'pending'> = [
    hasQueryContext ? 'done' : 'active',
    selectedTask ? 'done' : hasQueryContext ? 'active' : 'pending',
    state.activeOperation ? 'done' : selectedTask ? 'active' : 'pending',
    flowComplete || inspectionComplete ? 'done' : hasPendingConfirmation ? 'active' : 'pending',
  ]
  const flowSteps = [
    ['说出任务线索', '产品、工序、产线或任务号'],
    ['选择任务', '从真实候选中确认'],
    ['选择操作', '生产报工或检测录入'],
    ['人工确认', '最终动作必须真实点击'],
  ]
  const feedback = useMemo(
    () => showRestoreFeedback
      ? buildRestoreFeedback(state)
      : buildFeedback(state, {
          confirmationOpen,
          pendingActionOpen: Boolean(pendingAction),
          notice: interactionNotice,
        }),
    [confirmationOpen, interactionNotice, pendingAction, showRestoreFeedback, state],
  )

  async function runTool(
    toolId: string,
    payload: Record<string, unknown> = {},
    source: ToolSource = 'button',
    uiOptions: RunToolUiOptions = {},
  ): Promise<ToolResult> {
    const lockUi = uiOptions.lockUi !== false
    const showIntermediate = uiOptions.showIntermediate !== false
    setShowRestoreFeedback(false)
    setInteractionNotice(null)
    if (lockUi) setToolBusy(true)
    try {
      const result = await executeTool(stateRef.current, toolId, payload, source, {
        onPhase: showIntermediate ? (intermediate) => {
          applyState(intermediate.state)
        } : undefined,
        phaseDelayMs: uiOptions.phaseDelayMs ?? TOOL_PHASE_DELAY_MS,
      })
      applyState(result.state)
      if (result.run.phase !== 'awaiting_manual_confirmation') {
        requestAnimationFrame(() => focusAffectedSection(result.run.affectedSection))
      }
      const spokenMessage = result.run.phase === 'blocked'
        ? `本次没有执行。${result.run.message}。请检查后重试。`
        : result.run.message
      voiceControllerRef.current?.speak(spokenMessage)
      return result
    } finally {
      if (lockUi) setToolBusy(false)
    }
  }

  async function runProtected(toolId: string, payload: Record<string, unknown> = {}, source: ToolSource = 'button') {
    const result = await runTool(toolId, payload, source)
    if (['DRAFT_PROTECTION_REQUIRED', 'MEASUREMENT_PROTECTION_REQUIRED'].includes(result.run.error?.code ?? '') && result.run.phase === 'awaiting_manual_confirmation') {
      modalTriggerRef.current = document.activeElement as HTMLElement | null
      setPendingAction({ toolId, payload, source })
    }
    return result
  }

  async function handleCommand(source: ToolSource = 'text', raw = command, displayText = raw) {
    const text = raw.trim()
    const submittedText = displayText.trim() || text
    const settleCommand = (accepted: boolean, focusOnFailure = true) => {
      if (commandRef.current.trim() !== submittedText) return
      if (accepted) {
        manualToolsRef.current?.removeAttribute('open')
        updateCommand('')
        return
      }
      updateCommand(submittedText)
      if (!focusOnFailure) return
      requestAnimationFrame(() => {
        manualInputRef.current?.focus()
        manualInputRef.current?.select()
      })
    }
    const runCommandTool = async (
      toolId: string,
      payload: Record<string, unknown> = {},
      protectedAction = false,
    ) => {
      const result = protectedAction
        ? await runProtected(toolId, payload, source)
        : await runTool(toolId, payload, source)
      const accepted = result.run.phase !== 'blocked' && !result.run.error
      settleCommand(accepted, result.run.error?.code !== 'DRAFT_PROTECTION_REQUIRED')
      return result
    }

    setShowRestoreFeedback(false)
    if (!text) {
      setInteractionNotice({
        tone: 'error',
        title: '缺少输入',
        result: '没有收到可执行内容。',
        next: '输入任务号、产品、工序或操作指令。',
        invokedTool: false,
      })
      return
    }
    const withTranscript = { ...stateRef.current, lastTranscript: submittedText }
    applyState(withTranscript)

    const operationRequest = parseOperationRequest(text)
    if (operationRequest) {
      const result = await runProtected('switch_operation', operationRequest, source)
      const protectionRequired = ['DRAFT_PROTECTION_REQUIRED', 'MEASUREMENT_PROTECTION_REQUIRED'].includes(result.run.error?.code ?? '')
      if (protectionRequired) {
        settleCommand(false, false)
        return
      }
      const taskSpecificBlock = ['INSPECTION_LINK_NOT_VERIFIED', 'HISTORICAL_INSPECTION_SAMPLE_NOT_REPORTABLE', 'TASK_NOT_REPORTABLE'].includes(result.run.error?.code ?? '')
      const switchedOrExplained = result.run.phase !== 'blocked' || taskSpecificBlock
      if (!switchedOrExplained) {
        settleCommand(false)
        return
      }
      if (operationRequest.trailingInput) {
        await handleCommand(source, operationRequest.trailingInput, submittedText)
        return
      }
      settleCommand(true)
      return
    }

    if (/(?:开启|打开|启用)语音播报/.test(text)) return void await runCommandTool('set_voice_reply_enabled', { enabled: true })
    if (/(?:关闭|停止)语音播报/.test(text)) return void await runCommandTool('set_voice_reply_enabled', { enabled: false })
    if (/启用语音|打开麦克风/.test(text)) return void await runCommandTool('enable_microphone')
    if (/最终保存|确认保存/.test(text)) return void await runCommandTool('save_report')
    if (/清空条件/.test(text)) return void await runCommandTool('clear_query_conditions', {}, true)
    if (/重新选任务|重选任务/.test(text)) return void await runCommandTool('reselect_task', {}, true)
    if (/重新输入|清空报工/.test(text) && stateRef.current.draft) return void await runCommandTool('reset_report_fields')
    if (/继续报这个任务|继续报工/.test(text) && stateRef.current.selectedId) return void await runCommandTool('continue_current_task_report')

    const selection = parseSelectionIndex(text)
    if (selection !== null) {
      if (stateRef.current.activeOperation === 'inspection' && !stateRef.current.inspectionContext.selectedRecordGuid && stateRef.current.inspectionContext.recordCandidates.length) {
        const masterGuid = stateRef.current.inspectionContext.recordCandidates[selection - 1]
        return void await runCommandTool('select_inspection_record', { masterGuid }, true)
      }
      return void await runCommandTool('select_task', { selectionIndex: selection, candidateVersion: stateRef.current.candidateVersion }, true)
    }
    if (/撤销/.test(text)) return void await runCommandTool('undo_report_change')
    if (/重说/.test(text)) {
      setInteractionNotice({
        tone: 'idle',
        title: '等待重说',
        result: '已保留当前任务和已确认内容。',
        next: '重新说出本轮需求。',
        invokedTool: false,
      })
      settleCommand(true)
      requestAnimationFrame(() => manualInputRef.current?.focus())
      return
    }
    if (/返回上一步|返回/.test(text)) {
      if (stateRef.current.draft) return void await runCommandTool('request_cancel_report_draft', {}, true)
      if (stateRef.current.selectedId) return void await runCommandTool('reselect_task')
      setInteractionNotice({
        tone: 'idle',
        title: '等待输入',
        result: '已经返回到查询起点。',
        next: '请说出需求或选择筛选条件。',
        invokedTool: false,
      })
      settleCommand(true)
      requestAnimationFrame(() => manualInputRef.current?.focus())
      return
    }
    if (/取消报工|取消/.test(text) && stateRef.current.draft) return void await runCommandTool('request_cancel_report_draft', {}, true)
    if (/确认/.test(text) && stateRef.current.draft) {
      const result = await runCommandTool('prepare_manual_confirmation')
      if (result.run.phase === 'awaiting_manual_confirmation') requestAnimationFrame(() => confirmButtonRef.current?.focus())
      return
    }
    if (/开始报工/.test(text) && stateRef.current.selectedId) return void await runCommandTool('start_report_draft')
    if (/还剩|还差|完成多少|进度/.test(text)) return void await runCommandTool('get_task_progress')

    const correction = parseConditionChanges(text)
    if (correction) return void await runCommandTool('update_query_conditions', correction, true)

    const conditions = parseCommand(text, { defaultStatus: stateRef.current.activeOperation === 'inspection' ? null : '运行' })
    const report = parseReportChanges(text, stateRef.current.lastChangedField)
    if (Object.keys(conditions).length) {
      const existingQuery = Object.values(stateRef.current.conditions).some(Boolean)
      const explicitNewQuery = /(?:查询|查找|查|打开|找一下|换一个)/.test(text)
      return void await runCommandTool('query_tasks', {
        conditions,
        mergeWithCurrent: existingQuery && !conditions.parent && !explicitNewQuery,
        pendingReport: Object.keys(report.changes).length ? { ...report, transcript: text } : null,
      }, true)
    }
    if (stateRef.current.activeOperation === 'inspection') {
      return void await runCommandTool('prepare_measurement', { transcript: text }, true)
    }
    if (report.ambiguous) return void await runCommandTool('update_report_draft', { ambiguous: true })
    if (Object.keys(report.changes).length) {
      if (!stateRef.current.draft) {
        const started = await runTool('start_report_draft', {}, source)
        if (started.run.phase === 'blocked') {
          settleCommand(false)
          return
        }
      }
      const result = await runTool('update_report_draft', {
        ...report.changes,
        lowConfidence: report.lowConfidence,
        transcript: text,
        draftId: stateRef.current.draft?.draftId,
        draftRevision: stateRef.current.draftRevision,
      }, source)
      settleCommand(result.run.phase !== 'blocked')
      return
    }
    setInteractionNotice({
      tone: 'error',
      title: '未识别可执行意图',
      result: '本次未执行操作。',
      next: stateRef.current.results.length || stateRef.current.selectedId
        ? '修改当前指令或直接选择候选。'
        : '请说任务号、产品、工序、产线，或使用手动筛选。',
      invokedTool: false,
    })
    if (source === 'voice') {
      voiceControllerRef.current?.speak('暂时无法理解这个指令，本次没有执行，请重新说一遍。')
    }
    settleCommand(false)
  }

  function updateDraftField(field: 'complete' | 'scrap', raw: string) {
    if ((raw !== '' && !/^\d+$/.test(raw)) || !stateRef.current.draft) return
    const value = raw === '' ? '' : Number(raw)
    draftUpdateQueueRef.current = draftUpdateQueueRef.current.then(async () => {
      const draft = stateRef.current.draft
      if (!draft) return
      await runTool('update_report_draft', {
        [field]: value,
        draftId: draft.draftId,
        draftRevision: stateRef.current.draftRevision,
      }, 'button', { phaseDelayMs: 0, lockUi: false, showIntermediate: false })
    })
    return draftUpdateQueueRef.current
  }

  async function discardDraft() {
    if (!pendingAction) return
    const trailingInput = stateRef.current.pendingOperationSwitch?.trailingInput ?? ''
    let next = discardUnconfirmedByManualClick(stateRef.current).state
    applyState(next)
    const action = pendingAction
    setPendingAction(null)
    modalTriggerRef.current = null
    if (action.toolId !== 'request_cancel_report_draft') {
      const result = await executeTool(next, action.toolId, action.payload, 'button', {
        onPhase: (intermediate) => applyState(intermediate.state),
        phaseDelayMs: TOOL_PHASE_DELAY_MS,
      })
      next = result.state
      applyState(next)
      setInteractionNotice(result.run.phase === 'blocked' ? {
        tone: 'error',
        title: '操作未执行',
        result: result.run.message,
        next: '请检查当前输入或条件后重试。',
        invokedTool: true,
      } : null)
      requestAnimationFrame(() => focusAffectedSection(result.run.affectedSection))
      if (trailingInput && result.run.phase !== 'blocked') {
        await handleCommand(action.source, trailingInput, commandRef.current || trailingInput)
      }
    } else {
      setInteractionNotice({
        tone: 'success',
        title: '草稿已放弃',
        result: '未保存任何报工记录。',
        next: '可继续查看任务或重新开始报工。',
        invokedTool: false,
      })
      requestAnimationFrame(() => focusAffectedSection('current-task'))
    }
  }

  function discardMeasurement() {
    const next = discardUnconfirmedByManualClick(stateRef.current).state
    applyState(next)
    setInteractionNotice({
      tone: 'idle',
      title: '检测值已放弃',
      result: '未保存本次待确认检测值，历史数据未改变。',
      next: '可继续说检验项目、目标列和测量值。',
      invokedTool: false,
    })
  }

  function confirmMeasurement() {
    const result = confirmMeasurementByManualClick(stateRef.current)
    if (result.error) {
      setInteractionNotice({ tone: 'error', title: '确认被拦截', result: result.error, next: '请重新录入检测值。', invokedTool: false })
      return
    }
    applyState(result.state)
    setInteractionNotice({
      tone: 'success',
      title: '检测值已确认',
      result: '已保存本次检测值；演示环境未写入 MES，也未改变历史记录。',
      next: '可继续录入下一个检测值。',
      invokedTool: false,
    })
    voiceControllerRef.current?.speak('本次检测值已确认，仅保存到页面会话')
    requestAnimationFrame(() => focusAffectedSection('inspection'))
  }

  async function openConfirmation() {
    const result = await runTool('prepare_manual_confirmation', {}, 'button')
    if (result.run.phase === 'awaiting_manual_confirmation') {
      modalTriggerRef.current = document.activeElement as HTMLElement | null
      setConfirmationOpen(true)
    }
  }

  function finalSave() {
    const result = saveDemoRecordByManualClick(stateRef.current)
    if (result.error) {
      setInteractionNotice({
        tone: 'error',
        title: '保存被拦截',
        result: result.error,
        next: '返回草稿检查数量。',
        invokedTool: false,
      })
      return
    }
    applyState(result.state)
    setConfirmationOpen(false)
    modalTriggerRef.current = null
    setInteractionNotice(null)
    voiceControllerRef.current?.speak(`报工已确认，完工 ${result.state.records.at(-1)?.complete ?? 0}，报废 ${result.state.records.at(-1)?.scrap ?? 0}`)
    requestAnimationFrame(() => focusAffectedSection('complete'))
  }

  async function enableVoice() {
    await voiceControllerRef.current?.enable()
  }

  function toggleListening() {
    voiceControllerRef.current?.toggleCommandListening()
  }

  async function handleVoicePrimary() {
    if (!voiceSnapshot.enabled) {
      await enableVoice()
      return
    }
    toggleListening()
  }

  async function toggleVoiceReply() {
    const enabled = !state.voiceReplyEnabled
    if (!voiceControllerRef.current?.setTtsEnabled(enabled) && enabled) return
    await runTool('set_voice_reply_enabled', { enabled }, 'button')
  }

  function resetDemo() {
    clearSession()
    const initial = loadSession()
    applyState(initial)
    updateCommand('')
    setPendingAction(null)
    setConfirmationOpen(false)
    setUnderstandingSessionStarted(false)
    setShowRestoreFeedback(false)
    setInteractionNotice({
      tone: 'idle',
      title: '等待输入',
      result: '本次记录已清除。',
      next: '请重新开始查询。',
      invokedTool: false,
    })
  }

  const activeRun = state.activeToolRun
  const activeDefinition = activeRun ? getToolDefinitions()[activeRun.toolId] : null
  const activeToolMessage = confirmationOpen && activeRun?.toolId === 'prepare_manual_confirmation'
    ? '草稿校验通过，正在等待最终确认'
    : activeRun?.message
  const needsTask = !selectedTask
  const hasCandidates = needsTask && state.results.length > 0
  const voiceHeading = hasCandidates
    ? state.activeOperation === 'inspection' ? '选择可检测任务' : state.activeOperation === 'report' ? '选择可报工任务' : '选择生产任务'
    : needsTask && state.activeOperation === 'inspection'
      ? '查找可检测任务'
      : needsTask && state.activeOperation === 'report'
        ? '查找可报工任务'
        : state.activeOperation === 'inspection'
          ? '录入检验结果'
          : state.activeOperation === 'report'
            ? '录入生产数量'
            : '查找生产任务'
  const inputPlaceholder = needsTask
    ? '输入产品、工序、产线或任务号'
    : state.activeOperation === 'inspection'
      ? '输入检验项目、列和测量值'
      : state.activeOperation === 'report'
        ? '输入完工数和报废数'
        : '输入查询或操作指令'
  const protectingMeasurement = pendingAction && state.activeToolRun?.error?.code === 'MEASUREMENT_PROTECTION_REQUIRED'
  const voiceEnabled = voiceSnapshot.enabled
  const listening = voiceSnapshot.mode === 'command'
  const conditionEntries = Object.entries(state.conditions).filter(([, value]) => value)
  const showUnderstanding = understandingSessionStarted
  const showTranscript = Boolean(voiceSnapshot.transcript || voiceSnapshot.mode === 'command')
  const showFeedback = feedback.tone !== 'idle'
  const voiceUiState = toolBusy
    ? activeRun?.phase === 'ready' ? 'analyzing' : 'working'
    : voiceSnapshot.mode === 'command' ? 'listening'
      : voiceSnapshot.mode === 'wake' ? 'wake'
        : voiceSnapshot.mode === 'speaking' ? 'speaking'
          : voiceSnapshot.mode === 'unavailable' ? 'unavailable'
            : voiceSnapshot.mode === 'idle' && /处理|请求/.test(voiceSnapshot.status) ? 'analyzing'
              : voiceSnapshot.mode
  const voiceUiLabel = toolBusy
    ? activeRun?.phase === 'ready' ? '正在理解你的指令' : activeToolMessage || '正在执行操作'
    : voiceSnapshot.mode === 'off' ? '语音未启用'
      : voiceSnapshot.mode === 'speaking' ? '正在播报结果'
        : voiceSnapshot.status
  const voiceButtonLabel = !voiceEnabled ? '启用语音' : listening ? '结束说话' : '点击开始说话'
  const newestCandidateId = state.results.reduce<string | null>((latestId, task) => {
    if (!latestId) return task.rjhguid
    const latest = state.results.find((candidate) => candidate.rjhguid === latestId)
    return !latest || task.date > latest.date ? task.rjhguid : latestId
  }, null)

  return (
    <div className="app-shell" aria-busy={toolBusy}>
      <header className="topbar" inert={modalOpen} aria-hidden={modalOpen || undefined}>
        <div className="brand">
          <img src="/assets/wangshang-logo.png" alt="网商公司 Logo" />
          <span className="brand-divider" />
          <div><h2>网商语音助手</h2></div>
        </div>
        <div className="top-status">
          <span className="status-dot" />
          <span><b>演示环境 · 不写入 MES</b></span>
          <label>操作人<input value={state.operator} onChange={(event) => applyState({ ...stateRef.current, operator: event.target.value })} /></label>
        </div>
      </header>

      <main className={`workspace ${showUnderstanding ? 'with-understanding' : ''}`} inert={modalOpen} aria-hidden={modalOpen || undefined}>
        <aside className="card step-card" aria-label="当前步骤">
          <h2>当前步骤</h2>
          <div className="step-list">
            {flowSteps.map(([title], index) => {
              const stepState = flowStepStates[index]
              const completed = stepState === 'done'
              const active = stepState === 'active'
              return (
                <div className={`step ${active ? 'active' : completed ? 'done' : ''}`} key={title}>
                  <span>{completed ? '✓' : index + 1}</span>
                  <div><b>{title}</b></div>
                </div>
              )
            })}
          </div>
        </aside>

        <div className="main-column">
          <section className="card voice-panel" aria-labelledby="voice-heading">
            <div className="section-head">
              <div><h1 id="voice-heading">{voiceHeading}</h1></div>
            </div>
            <div className="voice-command-bar" role="group" aria-label="语音指令" data-voice-state={voiceUiState}>
              <button className="microphone" onClick={() => void handleVoicePrimary()} aria-label={voiceButtonLabel} disabled={voiceSnapshot.mode === 'speaking' || toolBusy}>
                {voiceUiState === 'working' || voiceUiState === 'analyzing'
                  ? <LoaderCircle aria-hidden="true" />
                  : voiceUiState === 'unavailable' ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              </button>
              <div className="voice-state-copy" aria-label={showTranscript ? '语音识别内容' : undefined} aria-live="polite">
                <strong>{voiceUiLabel}</strong>
                {showTranscript && <span>{voiceSnapshot.transcript || '请开始说话'}</span>}
              </div>
              <button className="voice-reply-toggle" aria-label={`语音播报：${state.voiceReplyEnabled ? '开启' : '关闭'}`} aria-pressed={state.voiceReplyEnabled} onClick={() => void toggleVoiceReply()}>
                <Volume2 aria-hidden="true" /><span>播报</span><b>{state.voiceReplyEnabled ? '开' : '关'}</b>
              </button>
            </div>
            {showFeedback && <div className={`assistant-feedback ${feedback.tone}`} role="status" aria-label="助手反馈" aria-live="polite">
              <strong>{feedback.title}</strong><span>{feedback.result}</span><small>下一步：{feedback.next}</small>
            </div>}
            <details ref={manualToolsRef} className="filters manual-tools">
              <summary>手动输入与筛选</summary>
              <div className="manual-row">
                <label htmlFor="manual-command">文字指令</label>
                <input ref={manualInputRef} id="manual-command" aria-label="文字指令" value={command} onChange={(event) => updateCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleCommand('text') }} placeholder={inputPlaceholder} />
                <button className="btn primary" disabled={toolBusy} onClick={() => void handleCommand('text')}>执行</button>
              </div>
              <div className="filter-grid">
                <label>产品<select value={filters.product ?? ''} onChange={(event) => setFilters({ ...filters, product: event.target.value || undefined })}><option value="">全部产品</option>{PRODUCTS.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>工序<select value={filters.process ?? ''} onChange={(event) => setFilters({ ...filters, process: event.target.value || undefined })}><option value="">全部工序</option>{PROCESSES.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>产线<select value={filters.line ?? ''} onChange={(event) => setFilters({ ...filters, line: event.target.value || undefined })}><option value="">全部产线</option>{LINES.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>数据记录状态<select value={filters.status ?? ''} onChange={(event) => setFilters({ ...filters, status: (event.target.value || undefined) as Conditions['status'] })}><option value="">全部状态</option><option>运行</option><option>关闭</option></select></label>
              </div>
              <div className="button-row end"><button className="btn soft" disabled={toolBusy} onClick={() => setFilters({})}>清空筛选</button><button className="btn secondary" disabled={toolBusy} onClick={() => void runProtected('query_tasks', { conditions: filters }, 'button')}>查询任务</button></div>
            </details>
          </section>

          {!selectedTask && state.results.length > 0 && (
            <section ref={candidateSectionRef} className="card content-panel" aria-labelledby="candidate-heading">
              <div className="section-head"><div><span className="eyebrow">任务选择</span><h2 id="candidate-heading">候选任务 <em>{state.results.length} 个</em></h2></div><span className="data-chip">共 {state.results.length} 个</span></div>
              {state.clarification ? (
                <div className="clarification">
                  <h3>请补充要查看的{conditionLabels[state.clarification.field]}</h3>
                  <p>以下选项来自当前真实候选任务。</p>
                  <div className="button-row">
                    {state.clarification.values.slice(0, 10).map((value) => (
                      <button className="btn secondary" key={value} disabled={toolBusy} onClick={() => void runProtected('update_query_conditions', { field: state.clarification?.field, to: value }, 'button')}>{value}</button>
                    ))}
                  </div>
                </div>
              ) : null}
              {(!state.clarification || state.results.length <= 6) && <div className="candidate-grid">
                {state.results.map((task, index) => (
                  <button key={task.rjhguid} className={`candidate-card ${state.selectedId === task.rjhguid ? 'selected' : ''}`} aria-label={`候选 ${String(index + 1).padStart(2, '0')} ${task.process} ${task.product}`} disabled={toolBusy} onClick={() => void runProtected('select_task', { selectionIndex: index + 1, candidateVersion: state.candidateVersion }, 'button')}>
                    <span className="candidate-top"><b>候选 {String(index + 1).padStart(2, '0')}</b><span className="candidate-badges">{task.rjhguid === newestCandidateId && <em className="recent">最近记录</em>}<em className={task.status === '关闭' ? 'closed' : ''}>{task.status}</em></span></span>
                    <strong>{task.process}</strong><span>{task.product} · {task.name}</span><small>{task.line}</small><code>{task.rjhguid} · {task.date}</code>
                  </button>
                ))}
              </div>}
            </section>
          )}

          {selectedTask && (
            <section ref={currentTaskSectionRef} className="card content-panel current-task" aria-labelledby="task-heading">
              <div className="section-head"><div><span className="eyebrow">当前任务</span><h2 id="task-heading">{selectedTask.process}工序任务</h2></div><span className={`record-state ${selectedTask.status === '关闭' ? 'closed' : ''}`}>{selectedTask.status}</span></div>
              <div className="task-title"><strong>{selectedTask.product}</strong><span>{selectedTask.name}</span><code>{selectedTask.rjhguid}</code></div>
              {selectedTask.inspectionSample ? (
                <dl className="task-facts"><div><dt>母任务号</dt><dd>{selectedTask.parent}</dd></div><div><dt>逻辑工序号</dt><dd>{selectedTask.rjhguid}</dd></div><div><dt>数据来源</dt><dd>TF13</dd></div><div><dt>真实记录数</dt><dd>{inspectionRecords.length}</dd></div><div><dt>项目明细数</dt><dd>{inspectionRecords.reduce((count, record) => count + record.items.length, 0)}</dd></div><div><dt>最近记录时间</dt><dd>{inspectionRecords[0]?.recordTime ?? selectedTask.date}</dd></div></dl>
              ) : (
                <dl className="task-facts"><div><dt>母任务号</dt><dd>{selectedTask.parent}</dd></div><div><dt>产线</dt><dd>{selectedTask.line}</dd></div><div><dt>计划数</dt><dd>{selectedTask.plan.toLocaleString()}</dd></div><div><dt>累计完成</dt><dd>{selectedTask.done.toLocaleString()}</dd></div><div><dt>累计报废</dt><dd>{selectedTask.scrap.toLocaleString()}</dd></div><div><dt>剩余</dt><dd className="strong-number">{Math.max(0, selectedTask.plan - selectedTask.done).toLocaleString()} {selectedTask.unit}</dd></div></dl>
              )}
              <div className="operation-availability" aria-label="当前任务操作可用性">
                <p className={taskCapabilities.canReport ? 'available' : 'unavailable'}>{taskCapabilities.canReport ? '生产报工可用' : `生产报工不可用：${taskCapabilities.reportReason}`}</p>
                <p className={taskCapabilities.canInspect ? 'available' : 'unavailable'}>{taskCapabilities.canInspect ? '检测录入可用' : `检测录入不可用：${taskCapabilities.inspectionReason}`}</p>
              </div>
              <div className="button-row end">
                {!selectedTask.inspectionSample && <button className="btn soft" disabled={toolBusy} onClick={() => void runTool('get_task_progress', {}, 'button')}>查询进度</button>}
                <button className="btn secondary" disabled={toolBusy} onClick={() => void runProtected('reselect_task', {}, 'button')}>重新选择任务</button>
                <button className="btn secondary" title={taskCapabilities.inspectionReason || undefined} disabled={toolBusy || !taskCapabilities.canInspect || state.activeOperation === 'inspection'} onClick={() => void runProtected('switch_operation', { operation: 'inspection' }, 'button')}>{state.activeOperation === 'inspection' ? '检测录入中' : '检测录入'}</button>
                <button className="btn primary" title={state.inspectionContext.measurementDraft ? '请先确认或放弃当前检测值' : taskCapabilities.canReport ? undefined : '当前任务不可报工，点击后进入可报工任务选择'} disabled={toolBusy || Boolean(state.draft) || Boolean(state.inspectionContext.measurementDraft) || state.activeOperation === 'report'} onClick={() => void runProtected('switch_operation', { operation: 'report' }, 'button')}>{state.activeOperation === 'report' ? '生产报工中' : '生产报工'}</button>
              </div>
            </section>
          )}

          {state.activeOperation === 'inspection' && (
            <section ref={inspectionSectionRef} className="card content-panel inspection-panel" aria-labelledby="inspection-heading" tabIndex={-1}>
              {!selectedTask ? (
                <div className="inspection-empty"><span className="eyebrow">检测录入</span><h2 id="inspection-heading">请先查询并选择任务</h2><p>当前查询只显示有检验记录的任务。</p></div>
              ) : !inspectionRecords.length ? (
                <div className="inspection-empty blocked"><span className="eyebrow">无可用记录</span><h2 id="inspection-heading">当前任务不能检测录入</h2><p>请重新选择有检验记录的任务。</p></div>
              ) : !selectedInspectionRecord ? (
                <>
                  <div className="section-head"><div><span className="eyebrow">检验记录</span><h2 id="inspection-heading">请选择检验记录</h2></div><span className="data-chip warn">{inspectionRecords.length} 张记录</span></div>
                  <p className="section-note">同一逻辑工序存在多张真实记录。请按记录时间人工选择，系统不会默认取第一张或最新一张。</p>
                  <div className="inspection-record-grid">
                    {inspectionRecords.map((record) => (
                      <button key={record.masterGuid} className="inspection-record-card" disabled={toolBusy} onClick={() => void runProtected('select_inspection_record', { masterGuid: record.masterGuid }, 'button')}>
                        <span>{record.checkType === 'checker_check' ? '检验员检验' : '员工自检'}</span>
                        <strong>{record.recordTime}</strong>
                        <small>{record.items.length} 条项目 · 结果 {record.result}</small>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="section-head"><div><span className="eyebrow">检测录入</span><h2 id="inspection-heading">智能检测录入</h2></div><span className="data-chip verified">检验记录已加载</span></div>
                  <div className="inspection-meta"><span>任务：{selectedInspectionRecord.taskNo}</span><span>工序：{selectedInspectionRecord.process}</span><span>记录时间：{selectedInspectionRecord.recordTime}</span><span>项目：{selectedInspectionRecord.items.length} 条</span></div>
                  <p className="section-note">历史值保持只读；语音或文字仅准备一个目标单元格，真实点击确认后只保存到本次页面会话。</p>
                  <div className="inspection-table-wrap">
                    <table className="inspection-table" aria-label="TF13 检验项目">
                      <thead><tr><th>序号</th><th>检验项目</th><th>技术要求</th><th>MIN</th><th>MAX</th>{Array.from({ length: 10 }, (_, index) => <th key={index}>第{index + 1}列</th>)}</tr></thead>
                      <tbody>
                        {selectedInspectionRecord.items.map((item) => (
                          <tr key={item.detailGuid}>
                            <td>{item.sequence}</td><td><strong>{item.name}</strong><small>{item.itemNo}</small></td><td>{item.requirement || '—'}</td><td>{item.min ?? '—'}</td><td>{item.max ?? '—'}</td>
                            {item.values.map((historicalValue, index) => {
                              const confirmed = [...state.inspectionContext.confirmedMeasurements].reverse().find((entry) => entry.masterGuid === selectedInspectionRecord.masterGuid && entry.detailGuid === item.detailGuid && entry.column === index + 1)
                              return <td key={index} className={confirmed ? 'session-value' : historicalValue ? 'history-value' : ''}>{confirmed?.value ?? historicalValue ?? '—'}</td>
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {state.inspectionContext.measurementDraft && (
                    <section className="measurement-pending" role="region" aria-label="检测值待确认">
                      <div><span>检测值待确认</span><strong>{state.inspectionContext.measurementDraft.itemName} · 第 {state.inspectionContext.measurementDraft.column} 列</strong><small>原值：{state.inspectionContext.measurementDraft.previousValue ?? '空'} → 本次值：{state.inspectionContext.measurementDraft.value}</small></div>
                      <div className="button-row"><button className="btn secondary" onClick={discardMeasurement}>放弃本次检测值</button><button className="btn primary" onClick={confirmMeasurement}>确认本次检测值</button></div>
                    </section>
                  )}
                </>
              )}
            </section>
          )}

          {state.activeOperation === 'report' && state.draft && selectedTask && (
            <section ref={reportSectionRef} className="card content-panel report-panel" aria-labelledby="report-heading">
              <div className="section-head"><div><span className="eyebrow">生产报工</span><h2 id="report-heading">完工报工草稿</h2></div><span className="data-chip warn">待确认</span></div>
              <div className="draft-grid">
                <label>本次完工数<input type="number" min="0" aria-label="本次完工数" value={state.draft.complete} onChange={(event) => void updateDraftField('complete', event.target.value)} /></label>
                <label>本次报废数<input type="number" min="0" aria-label="本次报废数" value={state.draft.scrap} onChange={(event) => void updateDraftField('scrap', event.target.value)} /></label>
                <div className="calculation"><span>确认后预计累计完成</span><strong>{/^\d+$/.test(state.draft.complete) ? (selectedTask.done + Number(state.draft.complete)).toLocaleString() : '待计算'} <small>{selectedTask.unit}</small></strong><p>当前累计完成＋本次完工数，由程序计算。</p></div>
              </div>
              <p className={`validation ${validation ? 'error' : 'success'}`}>{validation || `将为 ${selectedTask.product} · ${selectedTask.process} 记录完工 ${state.draft.complete}${selectedTask.unit}、报废 ${state.draft.scrap}${selectedTask.unit}。`}</p>
              <div className="button-row split"><button className="btn ghost" disabled={toolBusy} onClick={() => void runProtected('request_cancel_report_draft', {}, 'button')}>取消报工</button><span><button className="btn soft" disabled={toolBusy} onClick={() => void runTool('undo_report_change', {}, 'button')}>撤销修改</button><button className="btn secondary" disabled={toolBusy} onClick={() => void runTool('reset_report_fields', {}, 'button')}>重新输入</button><button ref={confirmButtonRef} className="btn primary" disabled={toolBusy || Boolean(validation)} onClick={openConfirmation}>检查并确认</button></span></div>
            </section>
          )}

          {flowComplete && latestRecord && selectedTask && (
            <section ref={successSectionRef} className="card success-panel" aria-live="polite"><div className="success-mark">✓</div><div><h2>报工记录已保存</h2><p>{selectedTask.product} · {selectedTask.process}：完工 {latestRecord.complete}{selectedTask.unit}、报废 {latestRecord.scrap}{selectedTask.unit}；演示环境未写入 MES。</p></div><div className="button-row"><button className="btn soft" onClick={() => void runTool('continue_current_task_report', {}, 'button')}>继续报这个任务</button><button className="btn secondary" onClick={resetDemo}>清除本次记录</button></div></section>
          )}
        </div>

        {showUnderstanding && <aside ref={understandingSectionRef} className="card understanding-panel" aria-live="polite" tabIndex={-1}>
          <div className="eyebrow">指令解析</div><h2>智能理解</h2>
          <section><span className="under-label">我听到</span><p>{state.lastTranscript || voiceSnapshot.transcript || '等待本次指令'}</p></section>
          {conditionEntries.length > 0 && <section><span className="under-label">我理解为</span><div className="chips">{conditionEntries.map(([key, value]) => <span className="chip" key={key}><b>{conditionLabels[key]}</b>{value}</span>)}</div></section>}
          <details className="run-details">
            <summary>运行信息</summary>
            <section className={`tool-card phase-${activeRun?.phase ?? 'idle'}`}>
              <div className="tool-card-head"><span className="under-label">最近工具动作</span><em>{interactionNotice && !interactionNotice.invokedTool ? '上一条' : activeRun ? phaseLabels[activeRun.phase] : '等待输入'}</em></div>
              <h3>{activeDefinition?.label ?? '尚未执行操作'}</h3>
              {activeRun?.diff.length ? <div className="diff-list">{activeRun.diff.map((item) => <div key={item.label}><span>{item.label}</span><del>{item.before || '空'}</del><b>→</b><ins>{item.after || '空'}</ins></div>)}</div> : <p className="tool-message">{activeToolMessage ?? '执行后将在这里显示运行结果。'}</p>}
            </section>
            <details className="technical-details">
              <summary><span>详细记录</span></summary>
              <dl className="tool-summary"><div><dt>影响区域</dt><dd>{activeRun ? sectionLabels[activeRun.affectedSection] : '—'}</dd></div><div><dt>工具 ID</dt><dd>{activeRun?.toolId ?? '—'}</dd></div><div><dt>来源</dt><dd>{activeRun ? sourceLabels[activeRun.source] : '—'}</dd></div><div><dt>状态版本</dt><dd>{activeRun?.stateVersion ?? 0}</dd></div><div><dt>候选版本</dt><dd>{activeRun?.candidateVersion ?? 0}</dd></div><div><dt>草稿修订</dt><dd>{activeRun?.draftRevision ?? '—'}</dd></div><div><dt>错误码</dt><dd>{activeRun?.error?.code ?? '—'}</dd></div></dl>
              <div className="tool-history"><span className="under-label">最近调用轨迹</span><ol>{state.toolHistory.length ? state.toolHistory.map((run, index) => <li key={`${run.requestId}-${run.phase}-${index}`}><b>{run.requestId}</b><span>{run.toolId}</span><em>{phaseLabels[run.phase]}</em></li>) : <li className="placeholder">暂无调用记录</li>}</ol></div>
            </details>
          </details>
        </aside>}
      </main>

      {pendingAction && (
        <div className="dialog-backdrop">
          <section ref={pendingDialogRef} className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="draft-dialog-title">
            <span className="eyebrow">未确认内容</span><h2 id="draft-dialog-title">{protectingMeasurement ? '当前检测值尚未确认' : '当前报工草稿尚未确认'}</h2><p>继续操作将放弃当前{protectingMeasurement ? '检测值' : '草稿'}。是否继续？</p>
            <div className="button-row end"><button className="btn secondary" onClick={closePendingDialog}>保留{protectingMeasurement ? '检测值' : '草稿'}</button><button className="btn primary" onClick={() => void discardDraft()}>放弃{protectingMeasurement ? '检测值' : '草稿'}</button></div>
          </section>
        </div>
      )}

      {confirmationOpen && state.draft && selectedTask && (
        <div className="dialog-backdrop">
          <section ref={confirmationDialogRef} className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
            <span className="eyebrow">最终确认</span><h2 id="confirm-dialog-title">确认保存报工记录？</h2><p>{selectedTask.product} · {selectedTask.process} · {selectedTask.line} · 操作人：{state.operator}</p>
            <div className="confirm-data"><div><span>本次完工</span><strong>{state.draft.complete}{selectedTask.unit}</strong></div><div><span>本次报废</span><strong>{state.draft.scrap}{selectedTask.unit}</strong></div></div>
            <div className="button-row end"><button className="btn secondary" onClick={closeConfirmationDialog}>返回修改</button><button className="btn primary" onClick={finalSave}>确认保存</button></div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
