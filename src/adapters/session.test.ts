import { beforeEach, describe, expect, it } from 'vitest'
import { loadSession } from './session'

describe('页面会话恢复', () => {
  beforeEach(() => sessionStorage.clear())

  it.each([
    ['task', null],
    ['report', 'report'],
    ['inspection', 'inspection'],
    ['unknown', null],
  ] as const)('旧场景 %s 安全迁移为业务操作 %s', (activeScene, expectedOperation) => {
    sessionStorage.setItem('zf.reactNarrowToolState', JSON.stringify({ activeScene }))
    const restored = loadSession()
    expect(restored.activeOperation).toBe(expectedOperation)
    expect(restored.pendingOperationSwitch).toBeNull()
  })

  it.each([
    ['inspection', 'GP26030719-6'],
    ['report', 'GP22010599-6'],
  ] as const)('%s 操作恢复时清除不具备资格的当前任务', (activeOperation, selectedId) => {
    sessionStorage.setItem('zf.reactNarrowToolState', JSON.stringify({
      activeOperation,
      selectedId,
      resultIds: [selectedId],
    }))

    const restored = loadSession()

    expect(restored.activeOperation).toBe(activeOperation)
    expect(restored.selectedId).toBeNull()
    expect(restored.results).toEqual([])
    expect(restored.inspectionContext.recordCandidates).toEqual([])
  })

  it('按 rjhguid 重新绑定当前版本 Demo 数据，避免恢复旧版错误字段', () => {
    sessionStorage.setItem('zf.reactNarrowToolState', JSON.stringify({
      operator: '张三',
      lastTranscript: '打开 GP26060001',
      conditions: { parent: 'GP26060001' },
      results: [{
        rjhguid: 'GP26060001-2',
        parent: 'GP26060001',
        product: '错误旧产品',
        process: '错误旧工序',
      }],
      selectedId: 'GP26060001-2',
    }))

    const restored = loadSession()
    expect(restored.operator).toBe('张三')
    expect(restored.lastTranscript).toBe('打开 GP26060001')
    expect(restored.results[0]).toMatchObject({
      rjhguid: 'GP26060001-2',
      product: '2MHM0200506',
      process: '粗磨沟道大挡边',
    })
  })

  it.each(['ready', 'running'] as const)('刷新时不把 %s 工具阶段恢复为仍在执行', (phase) => {
    sessionStorage.setItem('zf.reactNarrowToolState', JSON.stringify({
      conditions: { parent: 'GP26060001' },
      results: [{ rjhguid: 'GP26060001-2' }],
      activeToolRun: {
        requestId: 'TOOL-0001',
        toolId: 'query_tasks',
        source: 'text',
        phase,
        message: '正在查询生产任务',
        affectedSection: 'candidates',
        stateVersion: 0,
        candidateVersion: 0,
        draftRevision: null,
        diff: [],
        data: null,
        error: null,
      },
      toolHistory: [],
    }))

    expect(loadSession().activeToolRun).toBeNull()
  })

  it('恢复有效的检测操作和唯一 TF13 记录上下文', () => {
    sessionStorage.setItem('zf.reactNarrowToolState', JSON.stringify({
      activeScene: 'inspection',
      selectedId: 'GP22010599-6',
      results: [{ rjhguid: 'GP22010599-6' }],
      inspectionContext: {
        recordCandidates: ['36e4e439-569f-4d47-9422-ee37cece7601'],
        selectedRecordGuid: '36e4e439-569f-4d47-9422-ee37cece7601',
        measurementDraft: null,
        confirmedMeasurements: [],
        draftRevision: 0,
      },
    }))

    const restored = loadSession()
    expect(restored.activeOperation).toBe('inspection')
    expect(restored.selectedId).toBe('GP22010599-6')
    expect(restored.inspectionContext.selectedRecordGuid).toBe('36e4e439-569f-4d47-9422-ee37cece7601')
  })

  it('丢弃无法验证的检验记录和测量待确认值', () => {
    sessionStorage.setItem('zf.reactNarrowToolState', JSON.stringify({
      activeScene: 'inspection',
      selectedId: 'GP22010599-6',
      results: [{ rjhguid: 'GP22010599-6' }],
      inspectionContext: {
        recordCandidates: ['fake-master'],
        selectedRecordGuid: 'fake-master',
        measurementDraft: { masterGuid: 'fake-master', detailGuid: 'fake-detail' },
        confirmedMeasurements: [],
        draftRevision: 9,
      },
    }))

    const restored = loadSession()
    expect(restored.inspectionContext.recordCandidates).toEqual(['36e4e439-569f-4d47-9422-ee37cece7601'])
    expect(restored.inspectionContext.selectedRecordGuid).toBe('36e4e439-569f-4d47-9422-ee37cece7601')
    expect(restored.inspectionContext.measurementDraft).toBeNull()
    expect(restored.inspectionContext.draftRevision).toBe(0)
  })

  it('刷新时取消挂起的操作切换并保留原操作', () => {
    sessionStorage.setItem('zf.reactNarrowToolState', JSON.stringify({
      activeScene: 'inspection',
      pendingSceneSwitch: { targetScene: 'report', trailingInput: '完工18' },
    }))

    const restored = loadSession()
    expect(restored.activeOperation).toBe('inspection')
    expect(restored.pendingOperationSwitch).toBeNull()
  })
})
