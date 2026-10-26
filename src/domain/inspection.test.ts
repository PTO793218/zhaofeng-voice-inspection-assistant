import { describe, expect, it } from 'vitest'
import {
  INSPECTION_RECORDS,
  getInspectionRecords,
  parseMeasurementCommand,
} from './inspection'

describe('TF13 历史真实检测数据', () => {
  it('完整包含 7 个逻辑工序任务、8 张主记录和 88 条明细', () => {
    expect(new Set(INSPECTION_RECORDS.map((record) => record.taskNo)).size).toBe(7)
    expect(INSPECTION_RECORDS).toHaveLength(8)
    expect(INSPECTION_RECORDS.flatMap((record) => record.items)).toHaveLength(88)
    expect(INSPECTION_RECORDS.every((record) => record.source === 'TF13')).toBe(true)
  })

  it('按逻辑工序任务返回记录，不用相似产品推测关联', () => {
    expect(getInspectionRecords('GP22010599-6')).toHaveLength(1)
    expect(getInspectionRecords('GP22010401-6')).toHaveLength(2)
    expect(getInspectionRecords('GP26030719-6')).toHaveLength(0)
  })

  it('保留真实项目、技术要求、上下限和 1 至 10 列历史值', () => {
    const record = getInspectionRecords('GP22010599-6')[0]
    expect(record.recordTime).toBe('2022-12-08 17:06:59')
    expect(record.items).toHaveLength(20)
    expect(record.items[0]).toMatchObject({
      itemNo: 'JYXM0096',
      name: '外径D1',
      requirement: 'φ87.4(-0.05～0)',
      min: 87.35,
      max: 87.4,
    })
    expect(record.items[0].values).toEqual(['87.38', null, null, null, null, null, null, null, null, null])
    expect(record.items.every((item) => item.values.length === 10)).toBe(true)
  })
})

describe('检测测量指令解析', () => {
  const items = () => getInspectionRecords('GP22010599-6')[0].items

  it('将项目、目标列和小数值解析成唯一待确认单元格', () => {
    expect(parseMeasurementCommand('外径 D1，第 1 列，87.38', items())).toMatchObject({
      status: 'ready',
      itemName: '外径D1',
      column: 1,
      value: '87.38',
    })
  })

  it('支持第十列，但拒绝 TF13 范围以外的列', () => {
    expect(parseMeasurementCommand('外径D1 第10列 87.38', items())).toMatchObject({ status: 'ready', column: 10 })
    expect(parseMeasurementCommand('外径D1 第11列 87.38', items())).toMatchObject({ status: 'invalid', reason: '目标列只支持 1～10' })
  })

  it('信息不完整或项目不匹配时不准备写入', () => {
    expect(parseMeasurementCommand('87.38', items())).toMatchObject({ status: 'incomplete' })
    expect(parseMeasurementCommand('卡簧槽宽 第1列 26.2', items())).toMatchObject({ status: 'invalid', reason: '当前检验记录中没有该项目' })
  })
})
