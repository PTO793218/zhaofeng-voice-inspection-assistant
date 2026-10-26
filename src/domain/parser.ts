import { LINES, PROCESSES, PRODUCTS, TASKS } from './tasks'
import type { Conditions } from './workflow'

export type ReportField = 'complete' | 'scrap'

export interface ParsedReportChanges {
  changes: Partial<Record<ReportField, number>>
  lowConfidence: boolean
  ambiguous: boolean
  description: string
}

export function parseChineseNumber(raw: string) {
  if (/^\d+$/.test(raw)) return Number(raw)
  const normalized = raw.replace(/^零$/, '〇')
  const map: Record<string, number> = { 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  if (normalized === '十') return 10
  if (normalized.includes('十')) {
    const [a, b] = normalized.split('十')
    return (a ? map[a] : 1) * 10 + (b ? map[b] : 0)
  }
  return map[normalized] ?? null
}

export function parseSelectionIndex(text: string) {
  const match = text.match(/(?:选(?:择)?|打开|进入|我要|就是)\s*第?\s*([一二两三四五六七八九十]+|\d{1,2})\s*(?:个|条)?/)
    ?? text.match(/^\s*第\s*([一二两三四五六七八九十]+|\d{1,2})\s*(?:个|条)\s*$/)
  return match ? parseChineseNumber(match[1]) : null
}

export function parseCommand(text: string, options: { defaultStatus?: '运行' | null } = {}): Conditions {
  const clean = text
    .replace(/[，。！？]/g, ' ')
    .replace(/你好[\s,，。！!、:：-]*小[\s,，。！!、:：-]*we/gi, '')
    .trim()
  const compactClean = clean.replace(/\s+/g, '')
  const conditions: Conditions = {}
  const parent = compactClean.match(/GP\d{8}/i)
  if (parent) conditions.parent = parent[0].toUpperCase()
  const product = PRODUCTS.find((value) => compactClean.toUpperCase().includes(value.replace(/\s+/g, '').toUpperCase()))
  if (product) conditions.product = product
  const process = PROCESSES.find((value) => compactClean.includes(value.replace(/\s+/g, '')))
  if (process) conditions.process = process
  let line = LINES.find((value) => compactClean.includes(value.replace(/\s+/g, '')) || compactClean.includes(value.replace('三厂', '').replace(/\s+/g, '')))
  if (!line && /三号线/.test(compactClean) && process) {
    const possible = [...new Set(TASKS.filter((task) => task.process === process).map((task) => task.line))]
    if (possible.length === 1) line = possible[0]
  }
  if (line) conditions.line = line
  if (compactClean.includes('关闭')) conditions.status = '关闭'
  else if (compactClean.includes('运行') || compactClean.includes('正在')) conditions.status = '运行'
  const defaultStatus = options.defaultStatus === undefined ? '运行' : options.defaultStatus
  if (Object.keys(conditions).length && !conditions.parent && conditions.status === undefined && defaultStatus) conditions.status = defaultStatus
  return conditions
}

export function parseConditionChanges(text: string) {
  const match = text.match(/不是\s*(.+?)[，,\s]*(?:是|改成|改为)\s*(.+)$/)
  if (!match) return null
  const oldValue = match[1].replace(/^(?:工序|产线|产品|状态)(?:是)?/, '').trim()
  const newValue = match[2].trim()
  const fields: Array<[keyof Conditions, string[]]> = [
    ['process', PROCESSES],
    ['line', LINES],
    ['product', PRODUCTS],
    ['status', ['运行', '关闭']],
  ]
  for (const [field, values] of fields) {
    const from = values.find((value) => oldValue.includes(value) || value.includes(oldValue))
    const to = values.find((value) => newValue.includes(value) || value.includes(newValue))
    if (from && to) return { field, from, to }
  }
  return null
}

function parseFieldNumber(text: string, fieldPattern: string) {
  const match = text.match(new RegExp(`${fieldPattern}(?:数)?\\s*([零一二两三四五六七八九十]+|\\d+)`))
  if (!match) return null
  return { value: parseChineseNumber(match[1]), chinese: !/^\d+$/.test(match[1]) }
}

export function parseReportChanges(text: string, lastChangedField: ReportField | null = null): ParsedReportChanges {
  const result: ParsedReportChanges = { changes: {}, lowConfidence: false, ambiguous: false, description: '' }
  let match = text.match(/(\d+)\s*[，,]?\s*(?:不对|不是)\s*[，,]?\s*(?:是|改成|改为)?\s*(\d+)/)
  if (match && lastChangedField) {
    result.changes[lastChangedField] = Number(match[2])
    result.description = `${match[1]}改为${match[2]}`
    return result
  }
  if (/^\s*\d+\s*$/.test(text)) {
    result.ambiguous = true
    return result
  }

  match = text.match(/(?:完工数?|完成数?)\s*(?:从\s*)?(\d+)?\s*(?:改成|改为|不是\s*\d+\s*[，,]?\s*是)\s*(\d+)/)
  if (match) {
    result.changes.complete = Number(match[2])
    result.description = match[1] ? `${match[1]}改为${match[2]}` : `完工数改为${match[2]}`
  } else {
    const complete = parseFieldNumber(text, '(?:完工|完成|做了|报)')
    if (complete?.value !== null && complete?.value !== undefined) {
      result.changes.complete = complete.value
      result.lowConfidence ||= complete.chinese
    }
  }

  match = text.match(/报废(?:数)?\s*(?:从\s*)?(\d+)?\s*(?:改成|改为|不是\s*\d+\s*[，,]?\s*是)\s*(\d+)/)
  if (match) {
    result.changes.scrap = Number(match[2])
    result.description = match[1] ? `${match[1]}改为${match[2]}` : `报废数改为${match[2]}`
  } else {
    const scrap = parseFieldNumber(text, '报废')
    if (scrap?.value !== null && scrap?.value !== undefined) {
      result.changes.scrap = scrap.value
      result.lowConfidence ||= scrap.chinese
    }
  }
  if (/没废品|没有报废|报废没有|没有坏的/.test(text)) result.changes.scrap = 0
  if (/低置信度/.test(text)) result.lowConfidence = true
  return result
}
