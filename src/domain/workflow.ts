import { DATA_CUTOFF, DEFAULT_RANGE, TASKS, type ProductionTask } from './tasks'
import {
  getInspectionRecords,
  INSPECTION_RECORDS,
  parseMeasurementCommand,
  type InspectionRecord,
} from './inspection'

export type ToolPhase = 'ready' | 'running' | 'succeeded' | 'awaiting_manual_confirmation' | 'blocked'
export type ToolSource = 'voice' | 'text' | 'button' | 'system'
export type ToolSection = 'voice' | 'understanding' | 'candidates' | 'current-task' | 'report' | 'inspection' | 'complete'
export type Conditions = Partial<Pick<ProductionTask, 'parent' | 'product' | 'process' | 'line' | 'status'>>
export type ReportField = 'complete' | 'scrap'
export type OperationId = 'report' | 'inspection'

export interface MeasurementDraft {
  draftId: string
  taskNo: string
  masterGuid: string
  detailGuid: string
  itemName: string
  column: number
  value: string
  previousValue: string | null
  transcript: string
  createdAt: string
}

export interface ConfirmedMeasurement extends MeasurementDraft {
  confirmedAt: string
  demoOnly: true
}

export interface InspectionContext {
  recordCandidates: string[]
  selectedRecordGuid: string | null
  measurementDraft: MeasurementDraft | null
  confirmedMeasurements: ConfirmedMeasurement[]
  draftRevision: number
}

export interface PendingOperationSwitch {
  targetOperation: OperationId
  trailingInput: string
}

export interface DraftSnapshot {
  complete: string
  scrap: string
  lowConfidence?: Partial<Record<ReportField, string>>
}

export interface ReportDraft extends DraftSnapshot {
  draftId: string
  taskId: string
  rjhguid: string
  createdAt: string
  transcripts: string[]
}

export interface PendingReport {
  changes: Partial<Record<ReportField, number>>
  lowConfidence?: boolean
  ambiguous?: boolean
  description?: string
  transcript?: string
}

export interface Clarification {
  field: 'product' | 'process' | 'line'
  values: string[]
}

export interface DemoRecord {
  draftId: string
  RJHguid: string
  parent: string
  operator: string
  transcript: string
  conditions: Conditions
  queryRange: string
  dataCutoff: string
  taskSnapshot: ProductionTask
  complete: number
  scrap: number
  expectedTotal: number
  createdAt: string
  confirmedAt: string
  status: '已确认'
  demoOnly: true
}

export interface ToolDefinition {
  label: string
  level: 1 | 2 | 3
  section: ToolSection
}

export interface ToolRun {
  requestId: string
  toolId: string
  source: ToolSource
  phase: ToolPhase
  message: string
  affectedSection: ToolSection
  stateVersion: number
  candidateVersion: number
  draftRevision: number | null
  diff: Array<{ label: string; before: string; after: string }>
  data: Record<string, unknown> | null
  error: { code: string; message: string } | null
}

export interface PrototypeState {
  activeOperation: OperationId | null
  pendingOperationSwitch: PendingOperationSwitch | null
  inspectionContext: InspectionContext
  conditions: Conditions
  results: ProductionTask[]
  selectedId: string | null
  clarification: Clarification | null
  pendingReport: PendingReport | null
  draft: ReportDraft | null
  draftHistory: DraftSnapshot[]
  lowConfidence: Partial<Record<ReportField, string>>
  lastChangedField: ReportField | null
  records: DemoRecord[]
  operator: string
  lastTranscript: string
  voiceReplyEnabled: boolean
  stateVersion: number
  candidateVersion: number
  draftRevision: number
  toolSequence: number
  activeToolRun: ToolRun | null
  toolHistory: ToolRun[]
  queryRange: string
}

export interface ToolResult {
  state: PrototypeState
  run: ToolRun
}

export interface ToolExecutionOptions {
  onPhase?: (result: ToolResult) => void
  phaseDelayMs?: number
}

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  get_current_state: { label: '读取当前页面状态', level: 1, section: 'understanding' },
  query_tasks: { label: '查询生产任务', level: 1, section: 'candidates' },
  update_query_conditions: { label: '更新查询条件', level: 2, section: 'understanding' },
  select_task: { label: '选择候选任务', level: 2, section: 'current-task' },
  get_task_progress: { label: '查询任务进度', level: 1, section: 'current-task' },
  start_report_draft: { label: '创建报工草稿', level: 2, section: 'report' },
  update_report_draft: { label: '修改报工草稿', level: 3, section: 'report' },
  undo_report_change: { label: '撤销草稿修改', level: 2, section: 'report' },
  reset_report_fields: { label: '清空报工数量', level: 2, section: 'report' },
  request_cancel_report_draft: { label: '申请取消报工', level: 2, section: 'report' },
  reselect_task: { label: '重新选择任务', level: 2, section: 'candidates' },
  clear_query_conditions: { label: '清空查询条件', level: 1, section: 'understanding' },
  continue_current_task_report: { label: '继续当前任务报工', level: 2, section: 'report' },
  set_voice_reply_enabled: { label: '设置机器语音播报', level: 1, section: 'voice' },
  prepare_manual_confirmation: { label: '准备人工确认', level: 3, section: 'report' },
  switch_operation: { label: '切换业务操作', level: 2, section: 'understanding' },
  select_inspection_record: { label: '选择检验记录', level: 2, section: 'inspection' },
  prepare_measurement: { label: '准备检测值录入', level: 3, section: 'inspection' },
}

const RESTRICTED_TOOLS = new Set(['enable_microphone', 'discard_draft_and_continue', 'save_report', 'confirm_measurement'])
const activeRequestIds = new WeakMap<PrototypeState, string>()

export function getToolDefinitions() {
  return { ...TOOL_DEFINITIONS }
}

export function createInitialState(): PrototypeState {
  return {
    activeOperation: null,
    pendingOperationSwitch: null,
    inspectionContext: {
      recordCandidates: [],
      selectedRecordGuid: null,
      measurementDraft: null,
      confirmedMeasurements: [],
      draftRevision: 0,
    },
    conditions: {},
    results: [],
    selectedId: null,
    clarification: null,
    pendingReport: null,
    draft: null,
    draftHistory: [],
    lowConfidence: {},
    lastChangedField: null,
    records: [],
    operator: '演示账号',
    lastTranscript: '',
    voiceReplyEnabled: false,
    stateVersion: 0,
    candidateVersion: 0,
    draftRevision: 0,
    toolSequence: 0,
    activeToolRun: null,
    toolHistory: [],
    queryRange: DEFAULT_RANGE,
  }
}

function copyState(state: PrototypeState): PrototypeState {
  return structuredClone(state)
}

function selectedTask(state: PrototypeState) {
  return TASKS.find((task) => task.rjhguid === state.selectedId) ?? null
}

function selectedInspectionRecord(state: PrototypeState) {
  return INSPECTION_RECORDS.find((record) => record.masterGuid === state.inspectionContext.selectedRecordGuid) ?? null
}

export interface TaskCapabilities {
  canReport: boolean
  canInspect: boolean
  reportReason: string
  inspectionReason: string
}

export function getTaskCapabilities(task: ProductionTask | null | undefined): TaskCapabilities {
  if (!task) {
    return {
      canReport: false,
      canInspect: false,
      reportReason: '请先选择任务',
      inspectionReason: '请先选择任务',
    }
  }
  const canReport = task.status === '运行' && !task.inspectionSample
  const canInspect = getInspectionRecords(task.rjhguid).length > 0
  return {
    canReport,
    canInspect,
    reportReason: canReport ? '' : task.inspectionSample ? '历史检测任务不可生产报工' : '任务已关闭，不可生产报工',
    inspectionReason: canInspect ? '' : '当前任务没有可用检验记录',
  }
}

function syncInspectionContext(state: PrototypeState) {
  const task = selectedTask(state)
  const records = getInspectionRecords(task?.rjhguid)
  state.inspectionContext.recordCandidates = records.map((record) => record.masterGuid)
  state.inspectionContext.selectedRecordGuid = records.length === 1 ? records[0].masterGuid : null
  state.inspectionContext.measurementDraft = null
  state.inspectionContext.draftRevision = 0
  return records
}

function enterOperation(state: PrototypeState, operation: OperationId) {
  state.activeOperation = operation
  state.pendingOperationSwitch = null
  return operation === 'inspection' ? syncInspectionContext(state) : [] as InspectionRecord[]
}

export function getToolStateSnapshot(state: PrototypeState) {
  const task = selectedTask(state)
  const capabilities = getTaskCapabilities(task)
  return {
    stateVersion: state.stateVersion,
    candidateVersion: state.candidateVersion,
    draftRevision: state.draft ? state.draftRevision : null,
    conditions: { ...state.conditions },
    selectedId: state.selectedId,
    selectedTask: task ? {
      rjhguid: task.rjhguid,
      parent: task.parent,
      product: task.product,
      process: task.process,
      line: task.line,
      status: task.status,
    } : null,
    activeOperation: state.activeOperation,
    inspection: {
      selectedRecordGuid: state.inspectionContext.selectedRecordGuid,
      recordCandidateCount: state.inspectionContext.recordCandidates.length,
      measurementDraft: state.inspectionContext.measurementDraft ? structuredClone(state.inspectionContext.measurementDraft) : null,
      confirmedMeasurementCount: state.inspectionContext.confirmedMeasurements.length,
    },
    draft: state.draft ? structuredClone(state.draft) : null,
    allowedActions: {
      canSelectTask: state.results.length > 1 && !state.draft,
      canStartReport: capabilities.canReport && !state.draft,
      canStartInspection: capabilities.canInspect && !state.inspectionContext.measurementDraft,
      canEditDraft: Boolean(state.draft),
      canPrepareConfirmation: Boolean(state.draft && !validateDraft(state)),
      requiresManualSave: true,
    },
  }
}

function nextRun(
  state: PrototypeState,
  toolId: string,
  source: ToolSource,
  phase: ToolPhase,
  message: string,
  extras: Partial<Pick<ToolRun, 'affectedSection' | 'diff' | 'data' | 'error'>> = {},
): ToolRun {
  const definition = TOOL_DEFINITIONS[toolId]
  const requestId = activeRequestIds.get(state) ?? allocateRequestId(state)
  return {
    requestId,
    toolId,
    source,
    phase,
    message,
    affectedSection: extras.affectedSection ?? definition?.section ?? 'understanding',
    stateVersion: state.stateVersion,
    candidateVersion: state.candidateVersion,
    draftRevision: state.draft ? state.draftRevision : null,
    diff: extras.diff ?? [],
    data: extras.data ?? null,
    error: extras.error ?? null,
  }
}

function allocateRequestId(state: PrototypeState) {
  state.toolSequence += 1
  const requestId = `TOOL-${String(state.toolSequence).padStart(4, '0')}`
  activeRequestIds.set(state, requestId)
  return requestId
}

function publish(state: PrototypeState, run: ToolRun) {
  state.activeToolRun = { ...run }
  state.toolHistory = [state.activeToolRun, ...state.toolHistory].slice(0, 10)
  return state.activeToolRun
}

function blocked(state: PrototypeState, toolId: string, source: ToolSource, code: string, message: string, affectedSection?: ToolSection): ToolResult {
  const run = publish(state, nextRun(state, toolId, source, 'blocked', message, {
    affectedSection,
    error: { code, message },
  }))
  activeRequestIds.delete(state)
  return { state, run }
}

function succeeded(
  state: PrototypeState,
  toolId: string,
  source: ToolSource,
  message: string,
  extras: Partial<Pick<ToolRun, 'phase' | 'affectedSection' | 'diff' | 'data' | 'error'>> & { changed?: boolean } = {},
): ToolResult {
  if (extras.changed !== false) state.stateVersion += 1
  const run = publish(state, nextRun(state, toolId, source, extras.phase ?? 'succeeded', message, extras))
  activeRequestIds.delete(state)
  return { state, run }
}

function protectPendingMeasurement(state: PrototypeState, toolId: string, source: ToolSource) {
  if (!state.inspectionContext.measurementDraft) return null
  return succeeded(state, toolId, source, '当前检测值尚未确认，需要用户决定是否放弃', {
    phase: 'awaiting_manual_confirmation',
    affectedSection: 'inspection',
    error: { code: 'MEASUREMENT_PROTECTION_REQUIRED', message: '当前检测值尚未确认' },
    changed: false,
  })
}

function phaseResult(state: PrototypeState, run: ToolRun): ToolResult {
  const snapshot = copyState(state)
  return { state: snapshot, run: snapshot.activeToolRun ?? { ...run } }
}

function waitForPhase(milliseconds: number) {
  return milliseconds > 0
    ? new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
    : Promise.resolve()
}

function validateDraft(state: PrototypeState) {
  const task = selectedTask(state)
  const draft = state.draft
  if (!task || !draft) return '当前没有可确认的报工草稿'
  if (!state.operator.trim()) return '操作人不能为空'
  if (!/^\d+$/.test(draft.complete) || !/^\d+$/.test(draft.scrap)) return '完工数和报废数必须填写非负整数'
  if (Number(draft.complete) > Math.max(0, task.plan - task.done)) {
    return `本次完工数不能超过剩余数 ${Math.max(0, task.plan - task.done)}${task.unit}`
  }
  const fields = Object.keys(state.lowConfidence) as ReportField[]
  if (fields.length) return `低置信度字段：${fields.map((field) => field === 'complete' ? '完工数' : '报废数').join('、')}。请重说或手动修改后再确认`
  return ''
}

function createDraft(state: PrototypeState, task: ProductionTask) {
  state.draft = {
    draftId: `draft-${task.rjhguid}-${Date.now()}`,
    taskId: task.rjhguid,
    rjhguid: task.rjhguid,
    complete: '',
    scrap: '',
    createdAt: new Date().toISOString(),
    transcripts: [],
  }
  state.draftHistory = []
  state.lowConfidence = {}
  state.draftRevision = 1
}

function applyPendingReport(state: PrototypeState, task: ProductionTask) {
  const pending = state.pendingReport
  state.pendingReport = null
  if (!pending || task.status !== '运行') return false
  if (!state.draft) createDraft(state, task)
  if (!state.draft) return false
  for (const field of ['complete', 'scrap'] as const) {
    const value = pending.changes[field]
    if (value === undefined) continue
    state.draft[field] = String(value)
    state.lastChangedField = field
    if (pending.lowConfidence) state.lowConfidence[field] = pending.transcript || state.lastTranscript
  }
  if (pending.transcript) state.draft.transcripts.push(pending.transcript)
  state.draftRevision += 1
  state.activeOperation = 'report'
  return true
}

function filterTasks(state: PrototypeState) {
  const conditionMatches = TASKS.filter((task) => Object.entries(state.conditions)
    .every(([key, value]) => !value || task[key as keyof ProductionTask] === value))
  state.results = conditionMatches.filter((task) => {
    const capabilities = getTaskCapabilities(task)
    if (state.activeOperation === 'report') return capabilities.canReport
    if (state.activeOperation === 'inspection') return capabilities.canInspect
    return true
  })
  state.candidateVersion += 1
  state.clarification = state.results.length > 5 ? chooseClarificationDimension(state.results, state.conditions) : null
  return conditionMatches.length
}

export function chooseClarificationDimension(tasks: ProductionTask[], conditions: Conditions): Clarification | null {
  const fields: Clarification['field'][] = ['product', 'process', 'line']
  const choices = fields
    .filter((field) => !conditions[field])
    .map((field) => ({ field, values: [...new Set(tasks.map((task) => task[field]).filter(Boolean))] }))
    .filter((choice) => choice.values.length > 1)
  return choices.filter((choice) => choice.values.length <= 5).sort((a, b) => a.values.length - b.values.length)[0]
    ?? choices.filter((choice) => choice.values.length <= 10).sort((a, b) => a.values.length - b.values.length)[0]
    ?? choices.sort((a, b) => a.values.length - b.values.length)[0]
    ?? null
}

function resolveQueryOutcome(state: PrototypeState) {
  if (!state.results.length) {
    state.selectedId = null
    state.pendingReport = null
    if (state.activeOperation === 'inspection') syncInspectionContext(state)
    return { section: 'understanding' as ToolSection, drafted: false }
  }
  if (state.results.length === 1) {
    const task = state.results[0]
    state.selectedId = task.rjhguid
    if (state.activeOperation === 'inspection') syncInspectionContext(state)
    let drafted = applyPendingReport(state, task)
    if (!drafted && state.activeOperation === 'report' && task.status === '运行' && !task.inspectionSample) {
      createDraft(state, task)
      drafted = true
    }
    return { section: drafted ? 'report' as ToolSection : 'current-task' as ToolSection, drafted }
  }
  state.selectedId = null
  if (state.activeOperation === 'inspection') syncInspectionContext(state)
  return { section: 'candidates' as ToolSection, drafted: false }
}

export function discardDraftByManualClick(state: PrototypeState) {
  const next = copyState(state)
  next.draft = null
  next.draftHistory = []
  next.lowConfidence = {}
  next.draftRevision = 0
  next.stateVersion += 1
  return next
}

export function discardUnconfirmedByManualClick(state: PrototypeState) {
  const next = copyState(state)
  next.draft = null
  next.draftHistory = []
  next.lowConfidence = {}
  next.draftRevision = 0
  next.inspectionContext.measurementDraft = null
  next.inspectionContext.draftRevision = 0
  next.pendingOperationSwitch = null
  next.stateVersion += 1
  return { state: next }
}

export function confirmMeasurementByManualClick(state: PrototypeState) {
  const next = copyState(state)
  const draft = next.inspectionContext.measurementDraft
  if (!draft) return { state: next, error: '当前没有可确认的检测值' }
  const record = INSPECTION_RECORDS.find((item) => item.masterGuid === draft.masterGuid)
  const item = record?.items.find((candidate) => candidate.detailGuid === draft.detailGuid)
  if (!record || !item || draft.column < 1 || draft.column > 10 || !Number.isFinite(Number(draft.value))) {
    return { state: next, error: '检测待确认值已失效，请重新录入' }
  }
  next.inspectionContext.confirmedMeasurements.push({
    ...draft,
    confirmedAt: new Date().toISOString(),
    demoOnly: true,
  })
  next.inspectionContext.measurementDraft = null
  next.inspectionContext.draftRevision = 0
  next.stateVersion += 1
  publish(next, nextRun(next, 'prepare_measurement', 'button', 'succeeded', '用户已确认本次检测值，仅保存到页面会话', {
    affectedSection: 'inspection',
    data: { detailGuid: draft.detailGuid, column: draft.column, value: draft.value },
  }))
  activeRequestIds.delete(next)
  return { state: next, error: '' }
}

export function saveDemoRecordByManualClick(state: PrototypeState) {
  const next = copyState(state)
  const task = selectedTask(next)
  const error = validateDraft(next)
  if (!task || !next.draft || error) return { state: next, error: error || '当前任务不存在' }
  const draft = next.draft
  const existing = next.records.find((record) => record.draftId === draft.draftId)
  if (!existing) {
    next.records.push({
      draftId: draft.draftId,
      RJHguid: task.rjhguid,
      parent: task.parent,
      operator: next.operator,
      transcript: draft.transcripts.join('；') || next.lastTranscript,
      conditions: { ...next.conditions },
      queryRange: next.queryRange,
      dataCutoff: DATA_CUTOFF,
      taskSnapshot: { ...task },
      complete: Number(draft.complete),
      scrap: Number(draft.scrap),
      expectedTotal: task.done + Number(draft.complete),
      createdAt: draft.createdAt,
      confirmedAt: new Date().toISOString(),
      status: '已确认',
      demoOnly: true,
    })
  }
  next.draft = null
  next.draftHistory = []
  next.lowConfidence = {}
  next.draftRevision = 0
  next.stateVersion += 1
  publish(next, nextRun(next, 'prepare_manual_confirmation', 'button', 'succeeded', '用户已完成最终点击确认', {
    affectedSection: 'complete',
    data: { draftId: draft.draftId },
  }))
  activeRequestIds.delete(next)
  return { state: next, error: '' }
}

export async function executeTool(
  current: PrototypeState,
  toolId: string,
  payload: Record<string, unknown> = {},
  source: ToolSource = 'system',
  options: ToolExecutionOptions = {},
): Promise<ToolResult> {
  const state = copyState(current)
  if (!TOOL_DEFINITIONS[toolId]) {
    const restricted = RESTRICTED_TOOLS.has(toolId)
    return blocked(state, toolId, source, restricted ? 'MANUAL_ACTION_REQUIRED' : 'TOOL_NOT_ALLOWED', restricted ? '该动作必须由用户真实点击完成' : '该工具未开放')
  }

  allocateRequestId(state)
  const definition = TOOL_DEFINITIONS[toolId]
  const ready = publish(state, nextRun(state, toolId, source, 'ready', `准备${definition.label}`))
  options.onPhase?.(phaseResult(state, ready))
  if ((options.phaseDelayMs ?? 0) > 0) await waitForPhase(options.phaseDelayMs!)
  const running = publish(state, nextRun(state, toolId, source, 'running', `正在${definition.label}`))
  options.onPhase?.(phaseResult(state, running))
  if ((options.phaseDelayMs ?? 0) > 0) await waitForPhase(options.phaseDelayMs!)

  if (toolId === 'get_current_state') {
    return succeeded(state, toolId, source, '已读取当前页面状态', { changed: false, data: getToolStateSnapshot(state) })
  }

  if (toolId === 'switch_operation') {
    const operation = String(payload.operation ?? '') as OperationId
    if (!['report', 'inspection'].includes(operation)) {
      return blocked(state, toolId, source, 'INVALID_ARGUMENT', '操作只支持生产报工或检测录入')
    }
    const trailingInput = String(payload.trailingInput ?? '').trim()
    if (operation === state.activeOperation) {
      if (operation === 'report' && !state.draft) {
        const task = selectedTask(state)
        if (task && getTaskCapabilities(task).canReport) {
          createDraft(state, task)
          return succeeded(state, toolId, source, '已为当前任务创建本地报工草稿', { affectedSection: 'report' })
        }
      }
      return succeeded(state, toolId, source, '当前已经处于该操作', { changed: false })
    }
    const currentTask = selectedTask(state)
    const capabilities = getTaskCapabilities(currentTask)
    const targetAllowed = operation === 'report' ? capabilities.canReport : capabilities.canInspect
    if (currentTask && !targetAllowed && !trailingInput) {
      if (operation === 'inspection') {
        return blocked(state, toolId, source, 'INSPECTION_LINK_NOT_VERIFIED', capabilities.inspectionReason, 'current-task')
      }
      if (!state.inspectionContext.measurementDraft) {
        state.selectedId = null
        state.conditions = {}
        state.results = []
        state.clarification = null
        state.pendingReport = null
        state.queryRange = DEFAULT_RANGE
        state.candidateVersion += 1
        enterOperation(state, 'report')
        return succeeded(state, toolId, source, '已进入生产报工，请查询并选择可报工任务', {
          affectedSection: 'understanding',
          data: { previousTaskNo: currentTask.rjhguid, reason: capabilities.reportReason },
        })
      }
      return blocked(state, toolId, source, currentTask.inspectionSample ? 'HISTORICAL_INSPECTION_SAMPLE_NOT_REPORTABLE' : 'TASK_NOT_REPORTABLE', capabilities.reportReason, 'current-task')
    }
    if (state.draft) {
      state.pendingOperationSwitch = { targetOperation: operation, trailingInput }
      return succeeded(state, toolId, source, '当前报工草稿尚未确认，需要用户决定是否放弃后再切换操作', {
        phase: 'awaiting_manual_confirmation',
        affectedSection: 'report',
        error: { code: 'DRAFT_PROTECTION_REQUIRED', message: '当前报工草稿尚未确认' },
      })
    }
    if (state.inspectionContext.measurementDraft) {
      state.pendingOperationSwitch = { targetOperation: operation, trailingInput }
      return succeeded(state, toolId, source, '当前检测值尚未确认，需要用户决定是否放弃后再切换操作', {
        phase: 'awaiting_manual_confirmation',
        affectedSection: 'inspection',
        error: { code: 'MEASUREMENT_PROTECTION_REQUIRED', message: '当前检测值尚未确认' },
      })
    }

    if (currentTask && !targetAllowed) {
      if (trailingInput) {
        state.selectedId = null
        enterOperation(state, operation)
        return succeeded(state, toolId, source, operation === 'report' ? '已选择生产报工，请按新线索查询可报工任务' : '已选择智能检测录入，请按新线索查询可检测任务', {
          affectedSection: 'understanding',
        })
      }
    }

    const records = enterOperation(state, operation)
    if (operation === 'inspection') {
      const task = selectedTask(state)
      if (!task) {
        return succeeded(state, toolId, source, '已进入智能检测录入，请先查询并选择任务', {
          affectedSection: 'inspection',
          data: { recordCount: 0 },
        })
      }
      return succeeded(state, toolId, source, records.length === 1 ? '已进入智能检测录入并加载唯一真实检验记录' : `已进入智能检测录入，请从 ${records.length} 张真实检验记录中选择`, {
        affectedSection: 'inspection',
        data: { taskNo: task.rjhguid, recordCount: records.length, selectedRecordGuid: state.inspectionContext.selectedRecordGuid },
      })
    }
    const task = selectedTask(state)
    if (!task) return succeeded(state, toolId, source, '已选择生产报工，请先查询并选择任务', { affectedSection: 'understanding' })
    createDraft(state, task)
    return succeeded(state, toolId, source, '已进入生产报工并创建本地草稿', { affectedSection: 'report' })
  }

  if (toolId === 'select_inspection_record') {
    if (state.activeOperation !== 'inspection') return blocked(state, toolId, source, 'OPERATION_MISMATCH', '请先说“检测录入”进入智能检测录入操作')
    if (state.inspectionContext.measurementDraft) {
      return succeeded(state, toolId, source, '当前检测值尚未确认，需要用户决定是否放弃', {
        phase: 'awaiting_manual_confirmation',
        affectedSection: 'inspection',
        error: { code: 'MEASUREMENT_PROTECTION_REQUIRED', message: '当前检测值尚未确认' },
        changed: false,
      })
    }
    const masterGuid = String(payload.masterGuid ?? '')
    if (!state.inspectionContext.recordCandidates.includes(masterGuid)) {
      return blocked(state, toolId, source, 'INSPECTION_RECORD_NOT_FOUND', '该检验记录不属于当前任务')
    }
    state.inspectionContext.selectedRecordGuid = masterGuid
    return succeeded(state, toolId, source, '已选择真实检验记录', {
      affectedSection: 'inspection',
      data: { masterGuid },
    })
  }

  if (toolId === 'prepare_measurement') {
    if (state.activeOperation !== 'inspection') return blocked(state, toolId, source, 'OPERATION_MISMATCH', '请先说“检测录入”进入智能检测录入操作')
    if (state.inspectionContext.measurementDraft) {
      return succeeded(state, toolId, source, '当前已有未确认检测值，需要用户先确认或放弃', {
        phase: 'awaiting_manual_confirmation',
        affectedSection: 'inspection',
        error: { code: 'MEASUREMENT_PROTECTION_REQUIRED', message: '当前已有未确认检测值' },
        changed: false,
      })
    }
    if (!selectedTask(state)) return blocked(state, toolId, source, 'TASK_NOT_SELECTED', '请先查询并选择任务', 'inspection')
    const record = selectedInspectionRecord(state)
    if (!record) return blocked(state, toolId, source, 'INSPECTION_RECORD_NOT_SELECTED', '请先选择一张真实检验记录', 'inspection')
    const transcript = String(payload.transcript ?? '')
    const parsed = parseMeasurementCommand(transcript, record.items)
    if (parsed.status !== 'ready') {
      return blocked(state, toolId, source, parsed.status === 'incomplete' ? 'MEASUREMENT_INPUT_INCOMPLETE' : 'MEASUREMENT_INPUT_INVALID', parsed.reason, 'inspection')
    }
    const item = record.items.find((candidate) => candidate.detailGuid === parsed.detailGuid)!
    const confirmed = [...state.inspectionContext.confirmedMeasurements].reverse().find((entry) =>
      entry.masterGuid === record.masterGuid && entry.detailGuid === item.detailGuid && entry.column === parsed.column,
    )
    const previousValue = confirmed?.value ?? item.values[parsed.column - 1] ?? null
    state.inspectionContext.draftRevision += 1
    state.inspectionContext.measurementDraft = {
      draftId: `measurement-${record.masterGuid}-${item.detailGuid}-${parsed.column}-${Date.now()}`,
      taskNo: record.taskNo,
      masterGuid: record.masterGuid,
      detailGuid: item.detailGuid,
      itemName: item.name,
      column: parsed.column,
      value: parsed.value,
      previousValue,
      transcript,
      createdAt: new Date().toISOString(),
    }
    return succeeded(state, toolId, source, '检测值已定位，等待用户点击确认', {
      phase: 'awaiting_manual_confirmation',
      affectedSection: 'inspection',
      data: { itemName: item.name, column: parsed.column, value: parsed.value, previousValue },
    })
  }

  if (toolId === 'query_tasks') {
    if (state.draft) {
      return succeeded(state, toolId, source, '当前报工草稿尚未确认，需要用户决定是否放弃', {
        phase: 'awaiting_manual_confirmation',
        affectedSection: 'report',
        error: { code: 'DRAFT_PROTECTION_REQUIRED', message: '当前报工草稿尚未确认' },
        changed: false,
      })
    }
    const measurementProtection = protectPendingMeasurement(state, toolId, source)
    if (measurementProtection) return measurementProtection
    const incomingConditions = (payload.conditions ?? {}) as Conditions
    const conditions = payload.mergeWithCurrent
      ? { ...state.conditions, ...incomingConditions }
      : incomingConditions
    if (!Object.values(conditions).some(Boolean)) return blocked(state, toolId, source, 'INVALID_ARGUMENT', '请至少提供一个有效查询条件')
    state.conditions = { ...conditions }
    state.queryRange = conditions.parent ? '精确任务号，不限 30 天' : DEFAULT_RANGE
    state.pendingReport = (payload.pendingReport as PendingReport | undefined) ?? null
    const baseCount = filterTasks(state)
    const outcome = resolveQueryOutcome(state)
    return succeeded(state, toolId, source, `查询完成，匹配 ${state.results.length} 个任务`, {
      affectedSection: outcome.section,
      data: { count: state.results.length, baseCount, candidateVersion: state.candidateVersion },
    })
  }

  if (toolId === 'update_query_conditions') {
    if (state.draft) {
      return succeeded(state, toolId, source, '当前报工草稿尚未确认，需要用户决定是否放弃', {
        phase: 'awaiting_manual_confirmation',
        affectedSection: 'report',
        error: { code: 'DRAFT_PROTECTION_REQUIRED', message: '当前报工草稿尚未确认' },
        changed: false,
      })
    }
    const measurementProtection = protectPendingMeasurement(state, toolId, source)
    if (measurementProtection) return measurementProtection
    const field = String(payload.field ?? '') as keyof Conditions
    if (!['parent', 'product', 'process', 'line', 'status'].includes(field) || payload.to === undefined) {
      return blocked(state, toolId, source, 'INVALID_ARGUMENT', '查询条件字段无效')
    }
    const before = String(state.conditions[field] ?? '')
    const to = String(payload.to)
    state.conditions[field] = to as never
    const baseCount = filterTasks(state)
    const outcome = resolveQueryOutcome(state)
    return succeeded(state, toolId, source, `查询条件已从${before || '空'}改为${to || '空'}`, {
      affectedSection: outcome.section,
      diff: [{ label: field === 'process' ? '工序' : field === 'line' ? '产线' : field === 'product' ? '产品' : field === 'status' ? '数据记录状态' : '母任务号', before, after: to }],
      data: { count: state.results.length, baseCount, candidateVersion: state.candidateVersion },
    })
  }

  if (toolId === 'select_task') {
    if (state.draft) {
      return succeeded(state, toolId, source, '当前报工草稿尚未确认，需要用户决定是否放弃', {
        phase: 'awaiting_manual_confirmation',
        affectedSection: 'report',
        error: { code: 'DRAFT_PROTECTION_REQUIRED', message: '当前报工草稿尚未确认' },
        changed: false,
      })
    }
    const measurementProtection = protectPendingMeasurement(state, toolId, source)
    if (measurementProtection) return measurementProtection
    if (Number(payload.candidateVersion) !== state.candidateVersion) return blocked(state, toolId, source, 'STALE_CANDIDATE_VERSION', '候选列表已经更新，请按当前列表重新选择')
    const index = Number(payload.selectionIndex)
    const task = state.results[index - 1]
    if (!Number.isInteger(index) || !task) return blocked(state, toolId, source, 'INVALID_ARGUMENT', `当前没有第 ${index} 个候选`)
    state.selectedId = task.rjhguid
    if (state.activeOperation === 'inspection') syncInspectionContext(state)
    let drafted = applyPendingReport(state, task)
    if (!drafted && state.activeOperation === 'report' && task.status === '运行' && !task.inspectionSample) {
      createDraft(state, task)
      drafted = true
    }
    return succeeded(state, toolId, source, `已选择第 ${index} 个候选任务`, {
      affectedSection: drafted ? 'report' : 'current-task',
      data: drafted ? { rjhguid: task.rjhguid, draftId: (state as PrototypeState).draft?.draftId } : { rjhguid: task.rjhguid },
    })
  }

  if (toolId === 'get_task_progress') {
    const task = selectedTask(state)
    if (!task) return blocked(state, toolId, source, 'TASK_NOT_SELECTED', '请先选择一个任务')
    const remaining = Math.max(0, task.plan - task.done)
    return succeeded(state, toolId, source, `计划 ${task.plan}${task.unit}，已完成 ${task.done}${task.unit}，还剩 ${remaining}${task.unit}`, {
      changed: false,
      data: { plan: task.plan, done: task.done, remaining, unit: task.unit },
    })
  }

  if (toolId === 'start_report_draft' || toolId === 'continue_current_task_report') {
    const task = selectedTask(state)
    if (!task) return blocked(state, toolId, source, 'TASK_NOT_SELECTED', '请先选择一个任务')
    if (task.inspectionSample) return blocked(state, toolId, source, 'HISTORICAL_INSPECTION_SAMPLE_NOT_REPORTABLE', '该任务仅用于历史检测验证体验，不可创建生产报工草稿')
    if (task.status !== '运行') return blocked(state, toolId, source, 'TASK_NOT_REPORTABLE', '关闭任务不可报工')
    if (state.draft) return blocked(state, toolId, source, 'DRAFT_PROTECTION_REQUIRED', '当前已有未确认草稿')
    if (toolId === 'continue_current_task_report' && !state.records.some((record) => record.RJHguid === task.rjhguid && record.status === '已确认')) {
      return blocked(state, toolId, source, 'CONFIRMED_RECORD_REQUIRED', '当前任务尚无已确认记录，请先开始并完成首笔报工')
    }
    state.activeOperation = 'report'
    createDraft(state, task)
    return succeeded(state, toolId, source, toolId === 'start_report_draft' ? '已创建空白报工草稿' : '已为当前任务创建下一笔空白草稿', {
      data: { draftId: state.draft!.draftId },
    })
  }

  if (toolId === 'update_report_draft') {
    if (payload.ambiguous) return blocked(state, toolId, source, 'AMBIGUOUS_INPUT', '数字归属不明确，请说明是完工数还是报废数', 'report')
    if (!state.draft) return blocked(state, toolId, source, 'DRAFT_NOT_FOUND', '当前没有可修改的报工草稿')
    if (payload.draftId !== undefined && payload.draftId !== state.draft.draftId) return blocked(state, toolId, source, 'DRAFT_REVISION_CONFLICT', '草稿已变化，请查看当前草稿后重试')
    if (payload.draftRevision !== undefined && Number(payload.draftRevision) !== state.draftRevision) return blocked(state, toolId, source, 'DRAFT_REVISION_CONFLICT', '草稿修订版本已变化，请重新操作')
    const before = { complete: state.draft.complete, scrap: state.draft.scrap, lowConfidence: { ...state.lowConfidence } }
    const updates: Partial<Record<ReportField, string>> = {}
    const diff: ToolRun['diff'] = []
    for (const field of ['complete', 'scrap'] as const) {
      if (payload[field] === undefined) continue
      if (payload[field] === '') updates[field] = ''
      else {
        const value = Number(payload[field])
        if (!Number.isInteger(value) || value < 0) return blocked(state, toolId, source, 'VALIDATION_FAILED', `${field === 'complete' ? '完工数' : '报废数'}必须是非负整数`)
        updates[field] = String(value)
      }
    }
    if (!Object.keys(updates).length) return blocked(state, toolId, source, 'INVALID_ARGUMENT', '没有可修改的报工字段')
    const task = selectedTask(state)
    if (task && updates.complete !== undefined && updates.complete !== '' && Number(updates.complete) > Math.max(0, task.plan - task.done)) {
      return blocked(state, toolId, source, 'VALIDATION_FAILED', `本次完工数不能超过剩余数 ${Math.max(0, task.plan - task.done)}${task.unit}`)
    }
    state.draftHistory.push(before)
    for (const field of ['complete', 'scrap'] as const) {
      if (updates[field] === undefined) continue
      state.draft[field] = updates[field]!
      state.lastChangedField = field
      if (payload.lowConfidence) state.lowConfidence[field] = String(payload.transcript ?? state.lastTranscript)
      else delete state.lowConfidence[field]
      diff.push({ label: field === 'complete' ? '完工数' : '报废数', before: before[field], after: updates[field]! })
    }
    const transcript = String(payload.transcript ?? '')
    if (transcript) state.draft.transcripts.push(transcript)
    state.draftRevision += 1
    return succeeded(state, toolId, source, payload.lowConfidence ? '报工草稿已更新，低置信度数字需要复核' : '报工草稿已更新', {
      diff,
      data: { draftId: state.draft.draftId },
    })
  }

  if (toolId === 'undo_report_change') {
    if (!state.draft || !state.draftHistory.length) return blocked(state, toolId, source, 'INVALID_ARGUMENT', '没有可撤销的草稿修改')
    const before = { complete: state.draft.complete, scrap: state.draft.scrap }
    const previous = state.draftHistory.pop()!
    state.draft.complete = previous.complete
    state.draft.scrap = previous.scrap
    state.lowConfidence = previous.lowConfidence ?? {}
    state.draftRevision += 1
    return succeeded(state, toolId, source, '已撤销最近一次草稿修改', {
      diff: [
        { label: '完工数', before: before.complete, after: previous.complete },
        { label: '报废数', before: before.scrap, after: previous.scrap },
      ],
      data: { draftId: state.draft.draftId },
    })
  }

  if (toolId === 'reset_report_fields') {
    if (!state.draft) return blocked(state, toolId, source, 'DRAFT_NOT_FOUND', '当前没有可修改的报工草稿')
    const before = { complete: state.draft.complete, scrap: state.draft.scrap, lowConfidence: { ...state.lowConfidence } }
    state.draftHistory.push(before)
    state.draft.complete = ''
    state.draft.scrap = ''
    state.lowConfidence = {}
    state.draftRevision += 1
    return succeeded(state, toolId, source, '报工数量已清空，请重新输入', {
      diff: [
        { label: '完工数', before: before.complete, after: '' },
        { label: '报废数', before: before.scrap, after: '' },
      ],
      data: { draftId: state.draft.draftId },
    })
  }

  if (toolId === 'request_cancel_report_draft') {
    if (!state.draft) return blocked(state, toolId, source, 'DRAFT_NOT_FOUND', '当前没有报工草稿')
    return succeeded(state, toolId, source, '当前报工草稿尚未确认，需要用户决定是否放弃', {
      phase: 'awaiting_manual_confirmation',
      affectedSection: 'report',
      error: { code: 'DRAFT_PROTECTION_REQUIRED', message: '当前报工草稿尚未确认' },
      changed: false,
    })
  }

  if (toolId === 'reselect_task') {
    if (state.draft) {
      return succeeded(state, toolId, source, '当前草稿尚未确认，需要用户决定是否放弃', {
        phase: 'awaiting_manual_confirmation',
        affectedSection: 'report',
        error: { code: 'DRAFT_PROTECTION_REQUIRED', message: '当前草稿尚未确认' },
        changed: false,
      })
    }
    const measurementProtection = protectPendingMeasurement(state, toolId, source)
    if (measurementProtection) return measurementProtection
    state.selectedId = null
    if (state.activeOperation === 'inspection') syncInspectionContext(state)
    if (state.conditions.process) {
      delete state.conditions.process
      filterTasks(state)
    }
    return succeeded(state, toolId, source, '已返回当前候选任务', { affectedSection: 'candidates' })
  }

  if (toolId === 'clear_query_conditions') {
    if (state.draft) {
      return succeeded(state, toolId, source, '当前报工草稿尚未确认，需要用户决定是否放弃', {
        phase: 'awaiting_manual_confirmation',
        affectedSection: 'report',
        error: { code: 'DRAFT_PROTECTION_REQUIRED', message: '当前报工草稿尚未确认' },
        changed: false,
      })
    }
    state.conditions = {}
    state.results = []
    state.clarification = null
    state.pendingReport = null
    state.queryRange = DEFAULT_RANGE
    state.candidateVersion += 1
    return succeeded(state, toolId, source, '查询条件已清空，当前任务和草稿保持不变', { affectedSection: 'understanding' })
  }

  if (toolId === 'set_voice_reply_enabled') {
    if (typeof payload.enabled !== 'boolean') return blocked(state, toolId, source, 'INVALID_ARGUMENT', '语音播报开关必须为布尔值')
    const changed = state.voiceReplyEnabled !== payload.enabled
    state.voiceReplyEnabled = payload.enabled
    return succeeded(state, toolId, source, state.voiceReplyEnabled ? '语音播报已开启' : '语音播报已关闭', {
      changed,
      data: { enabled: state.voiceReplyEnabled },
    })
  }

  if (toolId === 'prepare_manual_confirmation') {
    const error = validateDraft(state)
    if (error) return blocked(state, toolId, source, 'VALIDATION_FAILED', error, 'report')
    const task = selectedTask(state)!
    return succeeded(state, toolId, source, '草稿校验通过，请点击“检查并确认”', {
      phase: 'awaiting_manual_confirmation',
      affectedSection: 'report',
      changed: false,
      data: { summary: `将为 ${task.product} · ${task.process} 记录完工 ${state.draft!.complete}${task.unit}、报废 ${state.draft!.scrap}${task.unit}` },
    })
  }

  return blocked(state, toolId, source, 'TOOL_NOT_ALLOWED', '该工具未实现')
}

export function getSelectedTask(state: PrototypeState) {
  return selectedTask(state)
}

export function getDraftValidation(state: PrototypeState) {
  return validateDraft(state)
}

export { DATA_CUTOFF }
