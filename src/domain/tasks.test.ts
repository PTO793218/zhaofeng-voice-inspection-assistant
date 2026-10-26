import { describe, expect, it } from 'vitest'
import { TASKS } from './tasks'

describe('旧版已验证 Demo 数据', () => {
  it('完整迁移三组 16 条任务记录及关键业务字段', () => {
    expect(TASKS.filter((task) => !task.inspectionSample)).toHaveLength(16)
    expect(TASKS.filter((task) => task.parent === 'GP26060001')).toHaveLength(5)
    expect(TASKS.filter((task) => task.parent === 'GP26060002')).toHaveLength(5)
    expect(TASKS.filter((task) => task.parent === 'GP26030719')).toHaveLength(6)

    expect(TASKS.find((task) => task.rjhguid === 'GP26060001-2')).toMatchObject({
      product: '2MHM0200506',
      name: 'HZF1185B-3B-02',
      process: '粗磨沟道大挡边',
      plan: 100,
      done: 0,
      status: '运行',
    })
    expect(TASKS.find((task) => task.rjhguid === 'GP26030719-10')).toMatchObject({
      name: '车件HZF-B045BR-3T-C03',
      process: '拉花键',
      scrap: 3,
    })
  })
})
