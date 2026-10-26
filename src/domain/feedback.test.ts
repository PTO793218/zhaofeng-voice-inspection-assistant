import { describe, expect, it } from 'vitest'
import { buildFeedback, buildRestoreFeedback, deriveBusinessStage, type InteractionNotice } from './feedback'
import { chooseClarificationDimension, createInitialState, saveDemoRecordByManualClick, type PrototypeState } from './workflow'
import { TASKS } from './tasks'

function runningCandidates() {
  const state = createInitialState()
  state.conditions = { status: '运行' }
  state.results = TASKS.filter((task) => task.status === '运行')
  state.clarification = chooseClarificationDimension(state.results, state.conditions)
  return state
}

function validDraftState() {
  const state = createInitialState()
  const task = TASKS.find((item) => item.rjhguid === 'GP26030719-6')!
  state.results = [task]
  state.selectedId = task.rjhguid
  state.draft = {
    draftId: 'draft-feedback-test',
    taskId: task.rjhguid,
    rjhguid: task.rjhguid,
    complete: '18',
    scrap: '0',
    createdAt: '2026-08-13T00:00:00.000Z',
    transcripts: ['完工18，报废0'],
  }
  state.draftRevision = 1
  return state
}

describe('业务状态反馈投影', () => {
  it('多候选且存在追问维度时显示需要补充信息，而不是执行成功', () => {
    const state = runningCandidates()

    const feedback = buildFeedback(state)

    expect(deriveBusinessStage(state)).toBe('needs_clarification')
    expect(feedback).toMatchObject({
      stage: 'needs_clarification',
      title: '需要补充信息',
      result: '找到 11 个候选任务，还需要确认产品。',
    })
    expect(feedback.next).toContain('2MHM0200506')
    expect(feedback.next).toContain('2CHC0302284')
  })

  it('有效草稿在弹窗打开前后使用不同的确认反馈', () => {
    const state = validDraftState()

    expect(buildFeedback(state)).toMatchObject({
      stage: 'ready_to_confirm',
      title: '草稿已校验',
      next: '点击“检查并确认”。',
    })
    expect(buildFeedback(state, { confirmationOpen: true })).toMatchObject({
      stage: 'confirming',
      title: '等待最终确认',
      next: '确认保存或返回修改。',
    })
  })

  it('本次未识别通知覆盖上一条成功工具，但保留真实候选数量', () => {
    const state = runningCandidates()
    const notice: InteractionNotice = {
      tone: 'error',
      title: '未识别可执行意图',
      result: '本次未执行操作。',
      next: '修改当前指令或直接选择候选。',
      invokedTool: false,
    }

    expect(buildFeedback(state, { notice })).toMatchObject({
      title: '未识别可执行意图',
      result: '本次未执行操作；原有 11 个候选任务仍保留。',
      next: '修改当前指令或直接选择候选。',
    })
  })

  it('最终保存后由完成记录生成操作完成反馈', () => {
    const saved = saveDemoRecordByManualClick(validDraftState())
    expect(saved.error).toBe('')

    expect(buildFeedback(saved.state)).toMatchObject({
      stage: 'completed',
      title: '操作完成',
      result: '已保存一条报工记录。',
    })
  })

  it('查询工具成功但没有匹配任务时显示未找到结果，而不是尚未查询', () => {
    const state = createInitialState()
    state.conditions = { parent: 'GP99999999' }
    state.activeToolRun = {
      requestId: 'TOOL-0001',
      toolId: 'query_tasks',
      source: 'text',
      phase: 'succeeded',
      message: '查询完成，匹配 0 个任务',
      affectedSection: 'understanding',
      stateVersion: 1,
      candidateVersion: 1,
      draftRevision: null,
      diff: [],
      data: { count: 0 },
      error: null,
    }

    expect(buildFeedback(state)).toMatchObject({
      stage: 'no_results',
      title: '未找到匹配任务',
      result: '当前条件没有匹配的生产任务。',
    })
  })

  it('任务选定后只提示当前任务真正可用的业务操作', () => {
    const state = createInitialState()
    const task = TASKS.find((item) => item.rjhguid === 'GP26030719-6')!
    state.results = [task]
    state.selectedId = task.rjhguid

    expect(buildFeedback(state).next).toBe('可查询进度，或选择生产报工。')

    const inspectionTask = TASKS.find((item) => item.rjhguid === 'GP22010599-6')!
    state.results = [inspectionTask]
    state.selectedId = inspectionTask.rjhguid
    expect(buildFeedback(state).next).toBe('可选择检测录入。')
  })

  it.each([
    ['inspection', '当前条件没有匹配的可检测任务。'],
    ['report', '当前条件没有匹配的可报工任务。'],
  ] as const)('%s 操作的空结果使用对应业务名称', (operation, result) => {
    const state = createInitialState()
    state.activeOperation = operation
    state.conditions = { process: '不存在工序' }
    state.activeToolRun = {
      requestId: 'TOOL-0001', toolId: 'query_tasks', source: 'text', phase: 'succeeded',
      message: '查询完成，匹配 0 个任务', affectedSection: 'understanding', stateVersion: 1,
      candidateVersion: 1, draftRevision: null, diff: [], data: { count: 0 }, error: null,
    }
    expect(buildFeedback(state).result).toBe(result)
  })

  it('检测录入查询到生产任务但资格不符时解释原因并明确保留当前操作', () => {
    const state = createInitialState()
    state.activeOperation = 'inspection'
    state.conditions = { process: '回火' }
    state.activeToolRun = {
      requestId: 'TOOL-0001', toolId: 'query_tasks', source: 'text', phase: 'succeeded',
      message: '查询完成，匹配 0 个任务', affectedSection: 'understanding', stateVersion: 1,
      candidateVersion: 1, draftRevision: null, diff: [], data: { count: 0, baseCount: 1 }, error: null,
    }

    expect(buildFeedback(state)).toMatchObject({
      title: '当前任务不可检测录入',
      result: '找到了符合“回火”的生产任务，但这些任务没有可用检验记录。当前仍保持智能检测录入。',
      next: '可修改任务线索继续查找可检测任务；如需处理回火生产任务，请明确选择生产报工。',
    })
  })

  it('未选任务就输入业务数据时给出对应的恢复指引', () => {
    const state = createInitialState()
    state.activeOperation = 'report'
    state.lastTranscript = '完工18，报废0'
    state.activeToolRun = {
      requestId: 'TOOL-0001', toolId: 'start_report_draft', source: 'text', phase: 'blocked',
      message: '请先选择一个任务', affectedSection: 'report', stateVersion: 1,
      candidateVersion: 0, draftRevision: null, diff: [], data: {},
      error: { code: 'TASK_NOT_SELECTED', message: '请先选择一个任务' },
    }

    expect(buildFeedback(state)).toMatchObject({
      title: '请先查询并选择任务',
      result: '已识别报工数量，但当前还没有生产任务，因此没有创建报工草稿。',
      next: '先说产品、工序或产线查找可报工任务，选定后再录入数量。',
    })
  })

  it.each([
    ['候选', runningCandidates(), '已恢复候选任务', '已恢复 11 个候选任务，尚未选定具体任务。'],
    ['草稿', validDraftState(), '已恢复未完成草稿', '已恢复当前任务的报工草稿，尚未保存。'],
  ] as Array<[string, PrototypeState, string, string]>)('刷新后根据%s业务状态生成恢复反馈', (_label, state, title, result) => {
    expect(buildRestoreFeedback(state)).toMatchObject({ title, result })
  })
})
