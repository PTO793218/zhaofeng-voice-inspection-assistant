import {
  chooseClarificationDimension,
  createInitialState,
  getTaskCapabilities,
  type DemoRecord,
  type PrototypeState,
  type ReportDraft,
  type ToolRun,
} from '../domain/workflow'
import { DATA_CUTOFF, TASKS } from '../domain/tasks'
import { getInspectionRecords } from '../domain/inspection'

const STORAGE_KEY = 'zf.reactNarrowToolState'
type LegacySession = { activeScene?: string; pendingSceneSwitch?: unknown; resultIds?: string[] }

function canonicalTask(id: unknown) {
  return TASKS.find((task) => task.rjhguid === id)
}

function normalizeRun(run: ToolRun | null | undefined) {
  return run ? { ...run, data: run.data ?? null } : null
}

function restoreActiveRun(run: ToolRun | null | undefined, history: ToolRun[]) {
  const normalized = normalizeRun(run)
  if (normalized && normalized.phase !== 'ready' && normalized.phase !== 'running') return normalized
  return history.find((item) => item.phase !== 'ready' && item.phase !== 'running') ?? null
}

function normalizeRecord(
  raw: Partial<DemoRecord> & { taskId?: string },
  state: Pick<PrototypeState, 'operator' | 'lastTranscript' | 'conditions' | 'queryRange'>,
): DemoRecord | null {
  const task = canonicalTask(raw.RJHguid ?? raw.taskId)
  if (!task || !raw.draftId) return null
  const confirmedAt = raw.confirmedAt ?? new Date().toISOString()
  return {
    draftId: raw.draftId,
    RJHguid: task.rjhguid,
    parent: task.parent,
    operator: raw.operator ?? state.operator,
    transcript: raw.transcript ?? state.lastTranscript,
    conditions: raw.conditions ?? state.conditions,
    queryRange: raw.queryRange ?? state.queryRange,
    dataCutoff: raw.dataCutoff ?? DATA_CUTOFF,
    taskSnapshot: { ...task },
    complete: Number(raw.complete ?? 0),
    scrap: Number(raw.scrap ?? 0),
    expectedTotal: Number(raw.expectedTotal ?? task.done + Number(raw.complete ?? 0)),
    createdAt: raw.createdAt ?? confirmedAt,
    confirmedAt,
    status: '已确认',
    demoOnly: true,
  }
}

export function loadSession(): PrototypeState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const saved = JSON.parse(raw) as Partial<PrototypeState> & LegacySession
    const initial = createInitialState()
    const activeOperation = ['report', 'inspection'].includes(String(saved.activeOperation))
      ? saved.activeOperation!
      : ['report', 'inspection'].includes(String(saved.activeScene))
        ? saved.activeScene as PrototypeState['activeOperation']
        : null
    const eligibleForOperation = (task: NonNullable<ReturnType<typeof canonicalTask>>) => {
      const capabilities = getTaskCapabilities(task)
      if (activeOperation === 'report') return capabilities.canReport
      if (activeOperation === 'inspection') return capabilities.canInspect
      return true
    }
    const resultIds = saved.resultIds
      ?? saved.results?.map((task) => task.rjhguid)
      ?? []
    const results = resultIds
      .map(canonicalTask)
      .filter((task): task is NonNullable<typeof task> => Boolean(task))
      .filter(eligibleForOperation)
    const savedSelectedTask = canonicalTask(saved.selectedId)
    const selectedId = savedSelectedTask && eligibleForOperation(savedSelectedTask) ? savedSelectedTask.rjhguid : null
    const inspectionRecords = getInspectionRecords(selectedId)
    const recordCandidates = inspectionRecords.map((record) => record.masterGuid)
    const savedInspection = saved.inspectionContext
    const selectedRecordGuid = savedInspection?.selectedRecordGuid && recordCandidates.includes(savedInspection.selectedRecordGuid)
      ? savedInspection.selectedRecordGuid
      : inspectionRecords.length === 1 ? inspectionRecords[0].masterGuid : null
    const selectedInspectionRecord = inspectionRecords.find((record) => record.masterGuid === selectedRecordGuid)
    const savedMeasurement = savedInspection?.measurementDraft
    const measurementIsValid = Boolean(
      savedMeasurement
      && selectedInspectionRecord
      && savedMeasurement.masterGuid === selectedInspectionRecord.masterGuid
      && selectedInspectionRecord.items.some((item) => item.detailGuid === savedMeasurement.detailGuid)
      && Number.isInteger(savedMeasurement.column)
      && savedMeasurement.column >= 1
      && savedMeasurement.column <= 10
      && Number.isFinite(Number(savedMeasurement.value)),
    )
    const draftTask = canonicalTask(saved.draft?.rjhguid ?? saved.draft?.taskId)
    const draft: ReportDraft | null = saved.draft && draftTask && getTaskCapabilities(draftTask).canReport && selectedId === draftTask.rjhguid
      ? {
          ...saved.draft,
          taskId: draftTask.rjhguid,
          rjhguid: draftTask.rjhguid,
          transcripts: saved.draft.transcripts ?? [],
        }
      : null
    const toolHistory = (saved.toolHistory ?? []).map((run) => normalizeRun(run)!)
    const merged: PrototypeState = {
      ...initial,
      ...saved,
      conditions: saved.conditions ?? {},
      results,
      selectedId,
      activeOperation,
      pendingOperationSwitch: null,
      inspectionContext: {
        recordCandidates,
        selectedRecordGuid,
        measurementDraft: measurementIsValid ? savedMeasurement! : null,
        confirmedMeasurements: (savedInspection?.confirmedMeasurements ?? []).filter((entry) => {
          const record = inspectionRecords.find((candidate) => candidate.masterGuid === entry.masterGuid)
          return Boolean(record?.items.some((item) => item.detailGuid === entry.detailGuid) && entry.column >= 1 && entry.column <= 10)
        }),
        draftRevision: measurementIsValid ? Number(savedInspection?.draftRevision ?? 1) : 0,
      },
      draft,
      draftHistory: saved.draftHistory ?? [],
      lowConfidence: saved.lowConfidence ?? {},
      pendingReport: saved.pendingReport ?? null,
      activeToolRun: restoreActiveRun(saved.activeToolRun, toolHistory),
      toolHistory,
      records: [],
    }
    merged.clarification = results.length > 5
      ? chooseClarificationDimension(results, merged.conditions)
      : null
    merged.records = (saved.records ?? [])
      .map((record) => normalizeRecord(record, merged))
      .filter((record): record is DemoRecord => Boolean(record))
    return merged
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    return createInitialState()
  }
}

export function saveSession(state: PrototypeState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY)
}
