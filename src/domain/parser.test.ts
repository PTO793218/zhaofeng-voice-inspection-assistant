import { describe, expect, it } from 'vitest'
import { parseCommand, parseConditionChanges, parseReportChanges, parseSelectionIndex } from './parser'

describe('业务指令解析', () => {
  it('检测操作查询不会默认附加运行状态，但保留用户明确说出的状态', () => {
    expect(parseCommand('查 C-007 工序', { defaultStatus: null })).toEqual({ process: 'C-007' })
    expect(parseCommand('查运行中的 C-007 工序', { defaultStatus: null })).toEqual({ process: 'C-007', status: '运行' })
  })

  it('允许产线名称中带有自然停顿空格', () => {
    expect(parseCommand('三厂 OE 机加 3 号线')).toEqual({ line: '三厂OE机加3号线', status: '运行' })
  })

  it('识别候选选择同义表达，同时不把任务号查询当成候选序号', () => {
    expect(parseSelectionIndex('选择第二个')).toBe(2)
    expect(parseSelectionIndex('选第二个')).toBe(2)
    expect(parseSelectionIndex('打开第二个')).toBe(2)
    expect(parseSelectionIndex('进入第二条')).toBe(2)
    expect(parseSelectionIndex('我要第2个')).toBe(2)
    expect(parseSelectionIndex('就是第二个')).toBe(2)
    expect(parseSelectionIndex('第一个')).toBe(1)
    expect(parseSelectionIndex('第二条')).toBe(2)
    expect(parseSelectionIndex('打开 GP26030719')).toBeNull()
    expect(parseSelectionIndex('第 1 列')).toBeNull()
  })

  it('识别查询条件纠错，而不是发起一条全新的模糊查询', () => {
    expect(parseConditionChanges('工序不是粗磨沟道大挡边，是精磨沟道大挡边')).toEqual({
      field: 'process',
      from: '粗磨沟道大挡边',
      to: '精磨沟道大挡边',
    })
  })

  it('根据最近修改字段识别省略字段名的数字纠错', () => {
    expect(parseReportChanges('18不对，是20', 'complete')).toMatchObject({
      changes: { complete: 20 },
      ambiguous: false,
    })
  })

  it('单独一个数字不擅自写入草稿', () => {
    expect(parseReportChanges('20', null)).toMatchObject({
      changes: {},
      ambiguous: true,
    })
  })

  it('中文数字进入低置信度复核而不是静默当作确定值', () => {
    expect(parseReportChanges('完工二十，报废零', null)).toMatchObject({
      changes: { complete: 20, scrap: 0 },
      lowConfidence: true,
    })
  })
})
