import { getDraftValidation, getSelectedTask, getTaskCapabilities, type PrototypeState, type ToolRun } from './workflow'

export type FeedbackTone = 'idle' | 'processing' | 'success' | 'error'
export type BusinessStage =
  | 'idle'
  | 'no_results'
  | 'needs_clarification'
  | 'candidates_ready'
  | 'task_selected'
  | 'draft_editing'
  | 'ready_to_confirm'
  | 'confirming'
  | 'completed'

export interface FeedbackView {
  stage: BusinessStage
  tone: FeedbackTone
  title: string
  result: string
  next: string
}

export interface InteractionNotice {
  tone: FeedbackTone
  title: string
  result: string
  next: string
  invokedTool: boolean
}

export interface FeedbackContext {
  confirmationOpen?: boolean
  pendingActionOpen?: boolean
  notice?: InteractionNotice | null
  activeRun?: ToolRun | null
}

const clarificationLabels = {
  product: '产品',
  process: '工序',
  line: '产线',
}

function hasCompletedRecord(state: PrototypeState) {
  return Boolean(
    state.selectedId
    && !state.draft
    && state.records.some((record) => record.RJHguid === state.selectedId),
  )
}

export function deriveBusinessStage(state: PrototypeState, context: FeedbackContext = {}): BusinessStage {
  if (context.confirmationOpen && state.draft) return 'confirming'
  const run = context.activeRun === undefined ? state.activeToolRun : context.activeRun
  if (
    run?.phase === 'succeeded'
    && (run.toolId === 'query_tasks' || run.toolId === 'update_query_conditions')
    && state.results.length === 0
  ) return 'no_results'
  if (hasCompletedRecord(state)) return 'completed'
  if (state.draft) return getDraftValidation(state) ? 'draft_editing' : 'ready_to_confirm'
  if (getSelectedTask(state)) return 'task_selected'
  if (state.results.length) return state.clarification ? 'needs_clarification' : 'candidates_ready'
  return 'idle'
}

function contextSuffix(state: PrototypeState, notice: InteractionNotice) {
  if (notice.invokedTool) return notice.result
  if (state.draft) return `${notice.result.replace(/[。；]+$/, '')}；当前报工草稿仍保留。`
  if (getSelectedTask(state)) return `${notice.result.replace(/[。；]+$/, '')}；当前任务仍保留。`
  if (state.results.length) return `${notice.result.replace(/[。；]+$/, '')}；原有 ${state.results.length} 个候选任务仍保留。`
  return notice.result
}

function stageFeedback(state: PrototypeState, stage: BusinessStage): FeedbackView {
  const task = getSelectedTask(state)
  if (stage === 'no_results') {
    const baseCount = Number(state.activeToolRun?.data?.baseCount ?? 0)
    const process = state.conditions.process
    if (state.activeOperation === 'inspection' && baseCount > 0) {
      return {
        stage,
        tone: 'error',
        title: '当前任务不可检测录入',
        result: `找到了符合${process ? `“${process}”` : '当前条件'}的生产任务，但这些任务没有可用检验记录。当前仍保持智能检测录入。`,
        next: `可修改任务线索继续查找可检测任务；如需处理${process || '这些'}生产任务，请明确选择生产报工。`,
      }
    }
    const target = state.activeOperation === 'inspection'
      ? '可检测任务'
      : state.activeOperation === 'report'
        ? '可报工任务'
        : '生产任务'
    return {
      stage,
      tone: 'error',
      title: '未找到匹配任务',
      result: `当前条件没有匹配的${target}。`,
      next: '修改任务号或查询条件后重试。',
    }
  }
  if (stage === 'needs_clarification') {
    const clarification = state.clarification!
    const label = clarificationLabels[clarification.field]
    return {
      stage,
      tone: 'processing',
      title: '需要补充信息',
      result: `找到 ${state.results.length} 个候选任务，还需要确认${label}。`,
      next: `选择${clarification.values.map((value) => `“${value}”`).join('或')}，也可以继续说${label}名称。`,
    }
  }
  if (stage === 'candidates_ready') {
    return {
      stage,
      tone: 'processing',
      title: '请选择任务',
      result: `找到 ${state.results.length} 个候选任务，尚未选定具体任务。`,
      next: '从候选列表中选择一个任务。',
    }
  }
  if (stage === 'task_selected') {
    const capabilities = getTaskCapabilities(task)
    const next = capabilities.canReport && capabilities.canInspect
      ? '可查询进度，或选择生产报工/检测录入。'
      : capabilities.canReport
        ? '可查询进度，或选择生产报工。'
        : capabilities.canInspect
          ? '可选择检测录入。'
          : '请重新选择可执行任务。'
    return {
      stage,
      tone: 'success',
      title: '任务已选定',
      result: task ? `已打开 ${task.rjhguid} 对应的${task.process}工序任务。` : '已选定当前任务。',
      next,
    }
  }
  if (stage === 'draft_editing') {
    return {
      stage,
      tone: 'error',
      title: '草稿待完善',
      result: `草稿内容尚未通过校验：${getDraftValidation(state)}`,
      next: '填写或修正报工数量。',
    }
  }
  if (stage === 'ready_to_confirm') {
    return {
      stage,
      tone: 'success',
      title: '草稿已校验',
      result: '报工数量已通过检查，尚未最终保存。',
      next: '点击“检查并确认”。',
    }
  }
  if (stage === 'confirming') {
    return {
      stage,
      tone: 'processing',
      title: '等待最终确认',
      result: '请核对任务、工序、产线、操作人和数量。',
      next: '确认保存或返回修改。',
    }
  }
  if (stage === 'completed') {
    return {
      stage,
      tone: 'success',
      title: '操作完成',
      result: '已保存一条报工记录。',
      next: '继续当前任务或重新查询。',
    }
  }
  return {
    stage,
    tone: 'idle',
    title: '等待输入',
    result: '尚未查询任务。',
    next: '说出任务号、产品或工序，或使用手动筛选。',
  }
}

export function buildFeedback(state: PrototypeState, context: FeedbackContext = {}): FeedbackView {
  const stage = deriveBusinessStage(state, context)
  if (context.confirmationOpen) return stageFeedback(state, stage)
  if (context.pendingActionOpen) {
    return {
      stage,
      tone: 'processing',
      title: '等待处理未确认草稿',
      result: '当前报工草稿尚未确认。',
      next: '保留草稿或放弃草稿后继续。',
    }
  }

  const run = context.activeRun === undefined ? state.activeToolRun : context.activeRun
  if (run?.phase === 'ready' || run?.phase === 'running') {
    return {
      stage,
      tone: 'processing',
      title: run.phase === 'ready' ? '准备执行' : '正在执行',
      result: run.message,
      next: '正在更新页面状态…',
    }
  }
  if (context.notice) {
    return { ...context.notice, stage, result: contextSuffix(state, context.notice) }
  }
  if (run?.phase === 'blocked') {
    if (run.error?.code === 'TASK_NOT_SELECTED' && run.toolId === 'start_report_draft') {
      return {
        stage,
        tone: 'error',
        title: '请先查询并选择任务',
        result: '已识别报工数量，但当前还没有生产任务，因此没有创建报工草稿。',
        next: '先说产品、工序或产线查找可报工任务，选定后再录入数量。',
      }
    }
    if (run.error?.code === 'TASK_NOT_SELECTED' && run.toolId === 'prepare_measurement') {
      return {
        stage,
        tone: 'error',
        title: '请先查询并选择任务',
        result: '已收到检测值输入，但当前还没有任务，因此没有生成待确认检测值。',
        next: '先查询并选择有检验记录的任务，再录入检验项目、列和测量值。',
      }
    }
    return {
      stage,
      tone: 'error',
      title: '操作未执行',
      result: run.message,
      next: '请检查当前输入或条件后重试。',
    }
  }

  if (run?.phase === 'succeeded' && run.toolId === 'switch_operation' && !getSelectedTask(state)) {
    return {
      stage,
      tone: 'success',
      title: state.activeOperation === 'inspection' ? '已进入智能检测录入' : '已进入生产报工',
      result: run.message,
      next: state.activeOperation === 'inspection'
        ? '说出产品、工序、产线或任务号，查找有检验记录的任务。'
        : '说出产品、工序、产线或任务号，查找可以报工的运行任务。',
    }
  }

  if (run?.phase === 'succeeded' && ['get_task_progress', 'update_query_conditions', 'set_voice_reply_enabled'].includes(run.toolId)) {
    return {
      ...stageFeedback(state, stage),
      tone: 'success',
      result: run.message,
    }
  }

  return stageFeedback(state, stage)
}

export function buildRestoreFeedback(state: PrototypeState): FeedbackView {
  const stage = deriveBusinessStage(state)
  if (stage === 'no_results') {
    return {
      ...stageFeedback(state, stage),
      title: '已恢复上次查询',
      result: '上次查询没有找到匹配的生产任务。',
    }
  }
  if (stage === 'needs_clarification' || stage === 'candidates_ready') {
    return {
      ...stageFeedback(state, stage),
      title: '已恢复候选任务',
      result: `已恢复 ${state.results.length} 个候选任务，尚未选定具体任务。`,
    }
  }
  if (stage === 'draft_editing' || stage === 'ready_to_confirm') {
    return {
      ...stageFeedback(state, stage),
      title: '已恢复未完成草稿',
      result: '已恢复当前任务的报工草稿，尚未保存。',
    }
  }
  if (stage === 'completed') {
    return {
      ...stageFeedback(state, stage),
      title: '已恢复完成状态',
      result: '当前已有一条已保存记录。',
    }
  }
  if (stage === 'task_selected') {
    return {
      ...stageFeedback(state, stage),
      title: '已恢复当前任务',
    }
  }
  return stageFeedback(state, stage)
}

export function hasRestorableBusinessState(state: PrototypeState) {
  return Boolean(
    Object.values(state.conditions).some(Boolean)
    || state.results.length
    || state.selectedId
    || state.draft
    || state.records.length,
  )
}
