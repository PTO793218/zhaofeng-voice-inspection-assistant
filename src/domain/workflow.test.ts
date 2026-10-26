import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  confirmMeasurementByManualClick,
  discardUnconfirmedByManualClick,
  executeTool,
  getTaskCapabilities,
  getToolDefinitions,
  getToolStateSnapshot,
  saveDemoRecordByManualClick,
  type PrototypeState,
  type ToolResult,
} from './workflow'
import { TASKS } from './tasks'

async function selectRunningTask(state: PrototypeState) {
  const queried = await executeTool(state, 'query_tasks', {
    conditions: { parent: 'GP26030719' },
  }, 'text')
  expect(queried.run.phase).toBe('succeeded')
  return executeTool(queried.state, 'select_task', {
    selectionIndex: 2,
    candidateVersion: queried.state.candidateVersion,
  }, 'button')
}

describe('窄工具工作流', () => {
  it('初始状态没有业务操作，查询任务也不会自动选择操作', async () => {
    const initial = createInitialState()
    expect(initial.activeOperation).toBeNull()

    const queried = await executeTool(initial, 'query_tasks', {
      conditions: { process: '回火', status: '运行' },
    }, 'text')
    expect(queried.state.activeOperation).toBeNull()
  })

  it('连续补充查询线索时合并已有条件而不是丢失上一轮工序', async () => {
    const first = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { process: '回火', status: '运行' },
    }, 'text')
    const second = await executeTool(first.state, 'query_tasks', {
      conditions: { line: '三厂OE机加3号线' },
      mergeWithCurrent: true,
    }, 'text')

    expect(second.state.conditions).toEqual({
      process: '回火',
      status: '运行',
      line: '三厂OE机加3号线',
    })
    expect(second.state.selectedId).toBe('GP26030719-6')
  })

  it('场景内查询返回业务条件命中数，供页面解释资格过滤原因', async () => {
    const inspection = await executeTool(createInitialState(), 'switch_operation', {
      operation: 'inspection',
    }, 'text')
    const queried = await executeTool(inspection.state, 'query_tasks', {
      conditions: { process: '回火' },
    }, 'text')

    expect(queried.state.results).toHaveLength(0)
    expect(queried.run.data).toMatchObject({ count: 0, baseCount: 1 })
  })

  it('没有选定任务时录入检测值返回任务缺失而不是检验记录缺失', async () => {
    const inspection = await executeTool(createInitialState(), 'switch_operation', {
      operation: 'inspection',
    }, 'text')
    const prepared = await executeTool(inspection.state, 'prepare_measurement', {
      transcript: '外径 D1，第 1 列，87.38',
    }, 'text')

    expect(prepared.run.phase).toBe('blocked')
    expect(prepared.run.error?.code).toBe('TASK_NOT_SELECTED')
    expect(prepared.run.message).toContain('先查询并选择任务')
  })

  it('已有生产任务时进入生产报工会直接创建本地草稿', async () => {
    const selected = await selectRunningTask(createInitialState())
    const switched = await executeTool(selected.state, 'switch_operation', { operation: 'report' }, 'voice')

    expect(switched.run.phase).toBe('succeeded')
    expect(switched.state.activeOperation).toBe('report')
    expect(switched.state.draft?.rjhguid).toBe('GP26030719-6')
  })

  it('一次工具调用依次发布准备、执行中和终态，并共享同一请求号', async () => {
    const intermediate: ToolResult[] = []
    const initial = createInitialState()
    const result = await executeTool(initial, 'query_tasks', {
      conditions: { parent: 'GP26030719' },
    }, 'text', {
      onPhase: (phase: ToolResult) => intermediate.push(phase),
    })

    expect(intermediate.map((item) => item.run.phase)).toEqual(['ready', 'running'])
    expect([...intermediate.map((item) => item.run), result.run].map((run) => run.requestId)).toEqual([
      result.run.requestId,
      result.run.requestId,
      result.run.requestId,
    ])
    expect(intermediate.every((item) => item.state.stateVersion === initial.stateVersion)).toBe(true)
    expect(result.state.toolHistory.slice(0, 3).map((run) => run.phase)).toEqual(['succeeded', 'running', 'ready'])
    expect(result.state.toolSequence).toBe(1)
  })

  it('只开放 18 个窄工具，4 个高风险动作不进入工具表', () => {
    const definitions = getToolDefinitions()
    expect(Object.keys(definitions)).toHaveLength(18)
    expect(definitions).toHaveProperty('switch_operation')
    expect(definitions).not.toHaveProperty('switch_scene')
    expect(definitions).not.toHaveProperty('enable_microphone')
    expect(definitions).not.toHaveProperty('discard_draft_and_continue')
    expect(definitions).not.toHaveProperty('save_report')
    expect(definitions).not.toHaveProperty('confirm_measurement')
  })

  it('候选版本过期时拦截任务选择', async () => {
    const first = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP26060001' },
    }, 'text')
    const second = await executeTool(first.state, 'query_tasks', {
      conditions: { parent: 'GP26030719' },
    }, 'text')
    const stale = await executeTool(second.state, 'select_task', {
      selectionIndex: 2,
      candidateVersion: first.state.candidateVersion,
    }, 'system')

    expect(stale.run.phase).toBe('blocked')
    expect(stale.run.error?.code).toBe('STALE_CANDIDATE_VERSION')
    expect(stale.state.selectedId).toBeNull()
  })

  it('草稿修改使用 draftId 和修订版本保护', async () => {
    const selected = await selectRunningTask(createInitialState())
    const started = await executeTool(selected.state, 'start_report_draft', {}, 'button')
    const changed = await executeTool(started.state, 'update_report_draft', {
      complete: 18,
      scrap: 0,
      draftId: started.state.draft?.draftId,
      draftRevision: started.state.draftRevision,
    }, 'text')
    const stale = await executeTool(changed.state, 'update_report_draft', {
      complete: 20,
      draftId: changed.state.draft?.draftId,
      draftRevision: started.state.draftRevision,
    }, 'text')

    expect(changed.state.draftRevision).toBe(started.state.draftRevision + 1)
    expect(stale.run.phase).toBe('blocked')
    expect(stale.run.error?.code).toBe('DRAFT_REVISION_CONFLICT')
    expect(stale.state.draft?.complete).toBe('18')
  })

  it('准备确认只进入人工确认阶段，不生成记录', async () => {
    const selected = await selectRunningTask(createInitialState())
    const started = await executeTool(selected.state, 'start_report_draft', {}, 'button')
    const changed = await executeTool(started.state, 'update_report_draft', {
      complete: 18,
      scrap: 0,
      draftId: started.state.draft?.draftId,
      draftRevision: started.state.draftRevision,
    }, 'text')
    const prepared = await executeTool(changed.state, 'prepare_manual_confirmation', {}, 'voice')

    expect(prepared.run.phase).toBe('awaiting_manual_confirmation')
    expect(prepared.state.records).toHaveLength(0)
  })

  it('清空查询条件时同时清空旧候选但保留当前任务', async () => {
    const selected = await selectRunningTask(createInitialState())
    const cleared = await executeTool(selected.state, 'clear_query_conditions', {}, 'button')

    expect(cleared.state.conditions).toEqual({})
    expect(cleared.state.results).toHaveLength(0)
    expect(cleared.state.selectedId).toBe(selected.state.selectedId)
  })

  it('只读动作和等待人工确认不增加状态版本', async () => {
    const initial = createInitialState()
    const read = await executeTool(initial, 'get_current_state', {}, 'system')
    expect(read.state.stateVersion).toBe(initial.stateVersion)

    const selected = await selectRunningTask(read.state)
    const progressVersion = selected.state.stateVersion
    const progress = await executeTool(selected.state, 'get_task_progress', {}, 'button')
    expect(progress.state.stateVersion).toBe(progressVersion)

    const started = await executeTool(progress.state, 'start_report_draft', {}, 'button')
    const draftVersion = started.state.stateVersion
    const protectedQuery = await executeTool(started.state, 'query_tasks', {
      conditions: { parent: 'GP26060001' },
    }, 'text')
    expect(protectedQuery.run.phase).toBe('awaiting_manual_confirmation')
    expect(protectedQuery.state.stateVersion).toBe(draftVersion)
  })

  it('人工最终保存发布完成轨迹而不是停留在等待确认', async () => {
    const selected = await selectRunningTask(createInitialState())
    const started = await executeTool(selected.state, 'start_report_draft', {}, 'button')
    const changed = await executeTool(started.state, 'update_report_draft', {
      complete: 18,
      scrap: 0,
      draftId: started.state.draft?.draftId,
      draftRevision: started.state.draftRevision,
    }, 'button')
    const prepared = await executeTool(changed.state, 'prepare_manual_confirmation', {}, 'button')
    const saved = saveDemoRecordByManualClick(prepared.state)

    expect(saved.error).toBe('')
    expect(saved.state.activeToolRun).toMatchObject({
      toolId: 'prepare_manual_confirmation',
      phase: 'succeeded',
      affectedSection: 'complete',
      message: '用户已完成最终点击确认',
    })
  })

  it('所有工具轨迹提供结构化 data，当前状态返回可继续操作的快照', async () => {
    const read = await executeTool(createInitialState(), 'get_current_state', {}, 'system')
    expect(read.run.data).toEqual(getToolStateSnapshot(read.state))

    const selected = await selectRunningTask(read.state)
    expect(getToolStateSnapshot(selected.state).allowedActions).toMatchObject({
      canStartReport: true,
      canStartInspection: false,
    })
    const progress = await executeTool(selected.state, 'get_task_progress', {}, 'button')
    expect(progress.run.data).toEqual({ plan: 6480, done: 1495, remaining: 4985, unit: '只' })
  })

  it('唯一候选自动选定，多候选过多时给出可点击的追问维度', async () => {
    const unique = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP26060001', process: '精磨沟道大挡边' },
    }, 'text')
    expect(unique.state.results).toHaveLength(1)
    expect(unique.state.selectedId).toBe('GP26060001-3')
    expect(unique.run.affectedSection).toBe('current-task')

    const broad = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { status: '运行' },
    }, 'text')
    expect(broad.state.results.length).toBeGreaterThan(5)
    expect(broad.state.clarification).toMatchObject({ field: 'product' })
    expect(broad.state.clarification?.values).toEqual(['2MHM0200506', '2CHC0302284'])
  })

  it('工序纠正后重新选择任务会恢复同一母任务下的全部候选工序', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP26030719', process: '回火' },
    }, 'text')
    const corrected = await executeTool(queried.state, 'update_query_conditions', {
      field: 'process',
      from: '回火',
      to: '淬火',
    }, 'voice')
    const reselected = await executeTool(corrected.state, 'reselect_task', {}, 'button')

    expect(corrected.state.results.map((task) => task.process)).toEqual(['淬火'])
    expect(reselected.state.selectedId).toBeNull()
    expect(reselected.state.conditions).toEqual({ parent: 'GP26030719' })
    expect(reselected.state.results.map((task) => task.process)).toEqual([
      '淬火',
      '回火',
      '精车二序',
      '精车三序',
      '钻孔',
      '拉花键',
    ])
  })

  it('组合指令保留报工意图，选定候选后自动生成并填写草稿', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP26030719' },
      pendingReport: { changes: { complete: 18, scrap: 0 }, transcript: '打开 GP26030719，完工18，报废0' },
    }, 'text')
    expect(queried.state.pendingReport?.changes).toEqual({ complete: 18, scrap: 0 })

    const selected = await executeTool(queried.state, 'select_task', {
      selectionIndex: 2,
      candidateVersion: queried.state.candidateVersion,
    }, 'button')
    expect(selected.state.draft).toMatchObject({ complete: '18', scrap: '0' })
    expect(selected.state.pendingReport).toBeNull()
    expect(selected.run.affectedSection).toBe('report')
  })

  it('低置信度报工值必须复核，最终记录保留完整 Demo 上下文', async () => {
    let state = (await selectRunningTask(createInitialState())).state
    state.operator = '张三'
    state.lastTranscript = '完工二十，报废零'
    state = (await executeTool(state, 'start_report_draft', {}, 'button')).state
    state = (await executeTool(state, 'update_report_draft', {
      complete: 20,
      scrap: 0,
      lowConfidence: true,
      transcript: '完工二十，报废零',
      draftId: state.draft?.draftId,
      draftRevision: state.draftRevision,
    }, 'voice')).state

    const blocked = await executeTool(state, 'prepare_manual_confirmation', {}, 'button')
    expect(blocked.run.error?.code).toBe('VALIDATION_FAILED')

    state = (await executeTool(state, 'update_report_draft', {
      complete: 20,
      scrap: 0,
      draftId: state.draft?.draftId,
      draftRevision: state.draftRevision,
    }, 'button')).state
    const saved = saveDemoRecordByManualClick(state)
    expect(saved.error).toBe('')
    expect(saved.state.records[0]).toMatchObject({
      RJHguid: 'GP26030719-6',
      parent: 'GP26030719',
      operator: '张三',
      transcript: '完工二十，报废零',
      complete: 20,
      scrap: 0,
      expectedTotal: 1515,
      status: '已确认',
      demoOnly: true,
    })
    expect(saved.state.records[0].taskSnapshot.process).toBe('回火')
  })

  it('已选任务后重新查询多个候选时清除旧选择', async () => {
    const selected = await selectRunningTask(createInitialState())
    const queried = await executeTool(selected.state, 'query_tasks', {
      conditions: { parent: 'GP26060001' },
    }, 'text')

    expect(queried.state.results.length).toBeGreaterThan(1)
    expect(queried.state.selectedId).toBeNull()
    expect(queried.run.affectedSection).toBe('candidates')
  })

  it('存在草稿时选择候选任务进入人工放弃确认', async () => {
    const selected = await selectRunningTask(createInitialState())
    const started = await executeTool(selected.state, 'start_report_draft', {}, 'button')
    const result = await executeTool(started.state, 'select_task', {
      selectionIndex: 1,
      candidateVersion: started.state.candidateVersion,
    }, 'voice')

    expect(result.run.phase).toBe('awaiting_manual_confirmation')
    expect(result.run.error?.code).toBe('DRAFT_PROTECTION_REQUIRED')
    expect(result.state.selectedId).toBe(started.state.selectedId)
    expect(result.state.draft?.rjhguid).toBe(started.state.draft?.rjhguid)
  })

  it.each([
    ['clear_query_conditions', {}],
    ['request_cancel_report_draft', {}],
    ['update_query_conditions', { field: 'process', to: '淬火' }],
  ])('存在空白草稿时 %s 统一进入人工放弃确认', async (toolId, payload) => {
    const selected = await selectRunningTask(createInitialState())
    const started = await executeTool(selected.state, 'start_report_draft', {}, 'button')
    const result = await executeTool(started.state, toolId, payload, 'button')

    expect(result.run.phase).toBe('awaiting_manual_confirmation')
    expect(result.run.error?.code).toBe('DRAFT_PROTECTION_REQUIRED')
    expect(result.state.draft).toEqual(started.state.draft)
  })

  it('操作员为空时禁止准备确认和保存', async () => {
    const selected = await selectRunningTask(createInitialState())
    const started = await executeTool({ ...selected.state, operator: '   ' }, 'start_report_draft', {}, 'button')
    const changed = await executeTool(started.state, 'update_report_draft', {
      complete: 18,
      scrap: 0,
      draftId: started.state.draft?.draftId,
      draftRevision: started.state.draftRevision,
    }, 'button')

    const prepared = await executeTool(changed.state, 'prepare_manual_confirmation', {}, 'button')
    const saved = saveDemoRecordByManualClick(changed.state)
    expect(prepared.run.error?.code).toBe('VALIDATION_FAILED')
    expect(saved.error).toContain('操作人')
    expect(saved.state.records).toHaveLength(0)
  })

  it('只有当前任务已有确认记录时才能继续填报', async () => {
    const selected = await selectRunningTask(createInitialState())
    const premature = await executeTool(selected.state, 'continue_current_task_report', {}, 'button')
    expect(premature.run.phase).toBe('blocked')
    expect(premature.run.error?.code).toBe('CONFIRMED_RECORD_REQUIRED')

    const started = await executeTool(selected.state, 'start_report_draft', {}, 'button')
    const changed = await executeTool(started.state, 'update_report_draft', {
      complete: 18,
      scrap: 0,
      draftId: started.state.draft?.draftId,
      draftRevision: started.state.draftRevision,
    }, 'button')
    const saved = saveDemoRecordByManualClick(changed.state)
    const continued = await executeTool(saved.state, 'continue_current_task_report', {}, 'button')

    expect(continued.run.phase).toBe('succeeded')
    expect(continued.state.draft?.rjhguid).toBe(saved.state.selectedId)
  })

  it('固定操作口令切换并复用唯一当前任务', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP22010599' },
    }, 'text')
    expect(queried.state.selectedId).toBe('GP22010599-6')

    const switched = await executeTool(queried.state, 'switch_operation', {
      operation: 'inspection',
    }, 'voice')
    expect(switched.run.phase).toBe('succeeded')
    expect(switched.state.activeOperation).toBe('inspection')
    expect(switched.state.selectedId).toBe('GP22010599-6')
    expect(switched.state.inspectionContext.recordCandidates).toHaveLength(1)
    expect(switched.state.inspectionContext.selectedRecordGuid).toBe('36e4e439-569f-4d47-9422-ee37cece7601')
  })

  it('任务资格由同一规则同时判断报工和检测能力', () => {
    const productionTask = TASKS.find((task) => task.rjhguid === 'GP26030719-6')!
    const inspectionTask = TASKS.find((task) => task.rjhguid === 'GP22010599-6')!

    expect(getTaskCapabilities(productionTask)).toMatchObject({ canReport: true, canInspect: false })
    expect(getTaskCapabilities(inspectionTask)).toMatchObject({ canReport: false, canInspect: true })
  })

  it('当前生产任务没有完整 TF13 关联时拒绝切换并保持原操作', async () => {
    const selected = await selectRunningTask(createInitialState())
    selected.state.activeOperation = 'report'
    const switched = await executeTool(selected.state, 'switch_operation', { operation: 'inspection' }, 'voice')

    expect(switched.run.phase).toBe('blocked')
    expect(switched.run.error?.code).toBe('INSPECTION_LINK_NOT_VERIFIED')
    expect(switched.state.activeOperation).toBe('report')
    expect(switched.state.selectedId).toBe('GP26030719-6')
    expect(switched.state.inspectionContext.recordCandidates).toHaveLength(0)
  })

  it('检测样例完成后可直接进入生产报工选择而无需手动重选任务', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP22010599' },
    }, 'text')
    const inspected = await executeTool(queried.state, 'switch_operation', { operation: 'inspection' }, 'button')
    const switched = await executeTool(inspected.state, 'switch_operation', { operation: 'report' }, 'button')

    expect(switched.run.phase).toBe('succeeded')
    expect(switched.run.message).toBe('已进入生产报工，请查询并选择可报工任务')
    expect(switched.state.activeOperation).toBe('report')
    expect(switched.state.selectedId).toBeNull()
    expect(switched.state.conditions).toEqual({})
    expect(switched.state.results).toEqual([])
  })

  it('智能检测操作查询只返回存在真实检测记录的任务', async () => {
    const inspection = await executeTool(createInitialState(), 'switch_operation', { operation: 'inspection' }, 'button')
    const queried = await executeTool(inspection.state, 'query_tasks', {
      conditions: { process: '回火' },
    }, 'text')

    expect(queried.state.activeOperation).toBe('inspection')
    expect(queried.state.results).toEqual([])
    expect(queried.state.selectedId).toBeNull()
  })

  it('生产报工操作查询只返回可报工的运行任务', async () => {
    const report = await executeTool(createInitialState(), 'switch_operation', { operation: 'report' }, 'button')
    const inspectionOnly = await executeTool(report.state, 'query_tasks', {
      conditions: { parent: 'GP22010599' },
    }, 'text')
    const closed = await executeTool(report.state, 'query_tasks', {
      conditions: { parent: 'GP26060002' },
    }, 'text')

    expect(inspectionOnly.state.results).toEqual([])
    expect(closed.state.results).toEqual([])
  })

  it('同一任务存在两张真实记录时必须先人工选择', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP22010401' },
    }, 'text')
    const switched = await executeTool(queried.state, 'switch_operation', { operation: 'inspection' }, 'text')
    expect(switched.state.inspectionContext.recordCandidates).toHaveLength(2)
    expect(switched.state.inspectionContext.selectedRecordGuid).toBeNull()

    const selected = await executeTool(switched.state, 'select_inspection_record', {
      masterGuid: '44e3fcbb-8933-4ebd-a4c6-1baa3344657f',
    }, 'button')
    expect(selected.run.phase).toBe('succeeded')
    expect(selected.state.inspectionContext.selectedRecordGuid).toBe('44e3fcbb-8933-4ebd-a4c6-1baa3344657f')
  })

  it('检测指令只生成待确认单元格，真实点击后才写入页面会话', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP22010599' },
    }, 'text')
    const switched = await executeTool(queried.state, 'switch_operation', { operation: 'inspection' }, 'voice')
    const prepared = await executeTool(switched.state, 'prepare_measurement', {
      transcript: '外径 D1，第 1 列，87.38',
    }, 'voice')

    expect(prepared.run.phase).toBe('awaiting_manual_confirmation')
    expect(prepared.state.inspectionContext.measurementDraft).toMatchObject({
      itemName: '外径D1',
      column: 1,
      value: '87.38',
      previousValue: '87.38',
    })
    expect(prepared.state.inspectionContext.confirmedMeasurements).toHaveLength(0)

    const confirmed = confirmMeasurementByManualClick(prepared.state)
    expect(confirmed.error).toBe('')
    expect(confirmed.state.inspectionContext.measurementDraft).toBeNull()
    expect(confirmed.state.inspectionContext.confirmedMeasurements).toHaveLength(1)
  })

  it('目标任务不可报工时保留检测值并拒绝切换操作', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP22010599' },
    }, 'text')
    const switched = await executeTool(queried.state, 'switch_operation', { operation: 'inspection' }, 'voice')
    const prepared = await executeTool(switched.state, 'prepare_measurement', {
      transcript: '外径D1 第2列 87.39',
    }, 'voice')
    const protectedSwitch = await executeTool(prepared.state, 'switch_operation', { operation: 'report' }, 'voice')

    expect(protectedSwitch.run.phase).toBe('blocked')
    expect(protectedSwitch.run.error?.code).toBe('HISTORICAL_INSPECTION_SAMPLE_NOT_REPORTABLE')
    expect(protectedSwitch.state.activeOperation).toBe('inspection')
    expect(protectedSwitch.state.pendingOperationSwitch).toBeNull()
    expect(protectedSwitch.state.inspectionContext.measurementDraft).not.toBeNull()
  })

  it('目标任务不可检测时保留报工草稿并拒绝切换操作', async () => {
    const selected = await selectRunningTask(createInitialState())
    const report = await executeTool(selected.state, 'switch_operation', { operation: 'report' }, 'button')
    const switched = await executeTool(report.state, 'switch_operation', { operation: 'inspection' }, 'voice')

    expect(switched.run.phase).toBe('blocked')
    expect(switched.run.error?.code).toBe('INSPECTION_LINK_NOT_VERIFIED')
    expect(switched.state.activeOperation).toBe('report')
    expect(switched.state.pendingOperationSwitch).toBeNull()
    expect(switched.state.draft).not.toBeNull()
  })

  it('放弃草稿时先清理未确认内容，再由原切换指令原子更新操作和任务', async () => {
    const selected = await selectRunningTask(createInitialState())
    const report = await executeTool(selected.state, 'switch_operation', { operation: 'report' }, 'button')
    const protectedSwitch = await executeTool(report.state, 'switch_operation', {
      operation: 'inspection',
      trailingInput: 'GP22010599',
    }, 'voice')
    expect(protectedSwitch.run.error?.code).toBe('DRAFT_PROTECTION_REQUIRED')

    const discarded = discardUnconfirmedByManualClick(protectedSwitch.state).state
    expect(discarded.activeOperation).toBe('report')
    expect(discarded.selectedId).toBe('GP26030719-6')
    expect(discarded.draft).toBeNull()

    const switched = await executeTool(discarded, 'switch_operation', {
      operation: 'inspection',
      trailingInput: 'GP22010599',
    }, 'button')
    expect(switched.state.activeOperation).toBe('inspection')
    expect(switched.state.selectedId).toBeNull()
  })

  it('检测值待确认时查询其他任务不会改变当前任务', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP22010599' },
    }, 'text')
    const switched = await executeTool(queried.state, 'switch_operation', { operation: 'inspection' }, 'voice')
    const prepared = await executeTool(switched.state, 'prepare_measurement', {
      transcript: '外径D1 第2列 87.39',
    }, 'voice')
    const protectedQuery = await executeTool(prepared.state, 'query_tasks', {
      conditions: { parent: 'GP22010401' },
    }, 'text')

    expect(protectedQuery.run.phase).toBe('awaiting_manual_confirmation')
    expect(protectedQuery.run.error?.code).toBe('MEASUREMENT_PROTECTION_REQUIRED')
    expect(protectedQuery.state.selectedId).toBe('GP22010599-6')
    expect(protectedQuery.state.conditions.parent).toBe('GP22010599')
    expect(protectedQuery.state.inspectionContext.measurementDraft).not.toBeNull()
  })

  it('检测操作重新选择任务后清除旧任务的检测记录候选', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP22010401' },
    }, 'text')
    const switched = await executeTool(queried.state, 'switch_operation', { operation: 'inspection' }, 'button')
    expect(switched.state.inspectionContext.recordCandidates.length).toBeGreaterThan(0)

    const reselected = await executeTool(switched.state, 'reselect_task', {}, 'button')

    expect(reselected.state.selectedId).toBeNull()
    expect(reselected.state.inspectionContext.recordCandidates).toEqual([])
    expect(reselected.state.inspectionContext.selectedRecordGuid).toBeNull()
  })

  it('历史检测样例不能创建生产报工草稿', async () => {
    const queried = await executeTool(createInitialState(), 'query_tasks', {
      conditions: { parent: 'GP22010599' },
    }, 'text')
    const report = await executeTool(queried.state, 'start_report_draft', {}, 'button')
    expect(report.run.phase).toBe('blocked')
    expect(report.run.error?.code).toBe('HISTORICAL_INSPECTION_SAMPLE_NOT_REPORTABLE')
    expect(report.state.draft).toBeNull()
  })
})
