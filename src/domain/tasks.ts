import { INSPECTION_TASKS } from './inspection'

export type TaskStatus = '运行' | '关闭'

export interface ProductionTask {
  parent: string
  rjhguid: string
  product: string
  name: string
  process: string
  workshop: string
  line: string
  plan: number
  done: number
  scrap: number
  unit: string
  status: TaskStatus
  date: string
  inspectionSample?: boolean
}

// 与 8.07 已完成人工验证的页面保持一致。每一条代表可独立选择的逻辑工序任务。
export const TASKS: ProductionTask[] = [
  { parent: 'GP26060001', rjhguid: 'GP26060001-2', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '粗磨沟道大挡边', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '运行', date: '2026-06-05 15:23:31' },
  { parent: 'GP26060001', rjhguid: 'GP26060001-3', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '精磨沟道大挡边', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '运行', date: '2026-06-05 15:23:31' },
  { parent: 'GP26060001', rjhguid: 'GP26060001-4', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '粗磨内径', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '运行', date: '2026-06-05 15:23:31' },
  { parent: 'GP26060001', rjhguid: 'GP26060001-5', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '精磨内径', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '运行', date: '2026-06-05 15:23:31' },
  { parent: 'GP26060001', rjhguid: 'GP26060001-6', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '超精', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '运行', date: '2026-06-05 15:23:31' },
  { parent: 'GP26060002', rjhguid: 'GP26060002-2', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '粗磨沟道大挡边', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '关闭', date: '2026-06-05 15:26:18' },
  { parent: 'GP26060002', rjhguid: 'GP26060002-3', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '精磨沟道大挡边', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '关闭', date: '2026-06-05 15:26:18' },
  { parent: 'GP26060002', rjhguid: 'GP26060002-4', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '粗磨内径', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '关闭', date: '2026-06-05 15:26:18' },
  { parent: 'GP26060002', rjhguid: 'GP26060002-5', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '精磨内径', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '关闭', date: '2026-06-05 15:26:18' },
  { parent: 'GP26060002', rjhguid: 'GP26060002-6', product: '2MHM0200506', name: 'HZF1185B-3B-02', process: '超精', workshop: '兆丰三厂', line: '三厂内圈磨超3号线', plan: 100, done: 0, scrap: 0, unit: '只', status: '关闭', date: '2026-06-05 15:26:18' },
  { parent: 'GP26030719', rjhguid: 'GP26030719-5', product: '2CHC0302284', name: '车件HZF-B045BR-3T-C03', process: '淬火', workshop: '三厂-OE车间', line: '三厂OE机加3号线', plan: 6480, done: 1495, scrap: 0, unit: '只', status: '运行', date: '2026-03-09 12:47:12' },
  { parent: 'GP26030719', rjhguid: 'GP26030719-6', product: '2CHC0302284', name: '车件HZF-B045BR-3T-C03', process: '回火', workshop: '三厂-OE车间', line: '三厂OE机加3号线', plan: 6480, done: 1495, scrap: 1, unit: '只', status: '运行', date: '2026-03-09 12:47:12' },
  { parent: 'GP26030719', rjhguid: 'GP26030719-7', product: '2CHC0302284', name: '车件HZF-B045BR-3T-C03', process: '精车二序', workshop: '三厂-OE车间', line: '三厂OE机加3号线', plan: 6480, done: 1495, scrap: 3, unit: '只', status: '运行', date: '2026-03-09 12:47:12' },
  { parent: 'GP26030719', rjhguid: 'GP26030719-8', product: '2CHC0302284', name: '车件HZF-B045BR-3T-C03', process: '精车三序', workshop: '三厂-OE车间', line: '三厂OE机加3号线', plan: 6480, done: 1495, scrap: 3, unit: '只', status: '运行', date: '2026-03-09 12:47:12' },
  { parent: 'GP26030719', rjhguid: 'GP26030719-9', product: '2CHC0302284', name: '车件HZF-B045BR-3T-C03', process: '钻孔', workshop: '三厂-OE车间', line: '三厂OE机加3号线', plan: 6480, done: 1495, scrap: 3, unit: '只', status: '运行', date: '2026-03-09 12:47:12' },
  { parent: 'GP26030719', rjhguid: 'GP26030719-10', product: '2CHC0302284', name: '车件HZF-B045BR-3T-C03', process: '拉花键', workshop: '三厂-OE车间', line: '三厂OE机加3号线', plan: 6480, done: 1495, scrap: 3, unit: '只', status: '运行', date: '2026-03-09 12:47:12' },
  ...INSPECTION_TASKS,
]

export const DATA_CUTOFF = '2026-06-05 15:26:18'
export const DEFAULT_RANGE = '2026-05-07 15:26:18 至 2026-06-05 15:26:18'

export const PRODUCTS = [...new Set(TASKS.map((task) => task.product))]
export const PROCESSES = [...new Set(TASKS.map((task) => task.process))]
export const LINES = [...new Set(TASKS.map((task) => task.line))]
