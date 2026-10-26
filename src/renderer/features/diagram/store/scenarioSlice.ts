import { dataScenarios } from '../../../../shared/diagram/flowmap/convert'
import {
  createPlayer,
  type PlayClock,
  type Player,
  type PlaySpeed
} from '../../../../shared/diagram/player'
import {
  addStep,
  branchDraft,
  draftOf,
  draftPath,
  inheritedSteps,
  moveStep,
  newDraft,
  removeStep,
  setParent,
  setStepNote,
  validateDraft,
  type Draft,
  type DraftProblem,
  type DraftResult
} from '../../../../shared/diagram/recorder'
import { descendants, fullPath, pathNodeIds } from '../../../../shared/diagram/scenario'
import {
  bundleScenario,
  bundleSteps,
  snapshotScenarioDelete
} from '../../../../shared/diagram/snapshot'
import type {
  AffectedScenario,
  ChildPolicy,
  IpcResult,
  ProjectData,
  RestoreBundle,
  ScenarioApi,
  ScenarioType,
  StepData
} from '../../../../shared/diagram/types'
import { diagramStrings as t } from '../strings'
import type { DiagramState } from './diagramStore'

/** The scenario being recorded or edited, shown in the panel at the bottom of the canvas (SCR-07). */
export interface RecorderState {
  draft: Draft
  /** Selected step as an index into the whole path, inherited steps first. Null when none. */
  step: number | null
  problem: DraftProblem | null
  /** The box that asks whether to throw the recording away. */
  confirmCancel: boolean
}

/** What the canvas needs to show while a scenario plays. */
export interface PlayView {
  scenarioId: number
  steps: { nodeId: number; note: string }[]
  index: number
  paused: boolean
  speed: PlaySpeed
  /** The dot is running between these two blocks. */
  travel: { from: number; to: number } | null
  /** The system asks for reduced motion: no dot and no camera glide. */
  reduced: boolean
}

export interface ScenarioDeleteRequest {
  id: number
  key: string
  /** Branches below it, nearest first. */
  children: AffectedScenario[]
}

export interface ScenarioSliceState {
  recorder: RecorderState | null
  play: PlayView | null
  deleteScenarioRequest: ScenarioDeleteRequest | null
  /** The switch "Ảnh khi Play" of the top bar. */
  playImages: boolean
}

export interface ScenarioSliceActions {
  startRecording(draft?: Draft): void
  recordStep(nodeId: number): void
  selectDraftStep(index: number | null): void
  removeDraftStep(index: number): void
  moveDraftStep(from: number, to: number): void
  setDraftNote(index: number, note: string): void
  setDraftMeta(patch: { type?: ScenarioType; title?: string; parentId?: number | null }): void
  requestCancelRecording(): void
  resumeRecording(): void
  cancelRecording(): void
  /** Saves the recording. Returns the id of the scenario, or null when a rule is broken. */
  saveRecording(): Promise<number | null>
  /** Saves the recording, then starts a branch at the chosen step of the path. */
  branchFromStep(index: number): Promise<void>
  /** The ring item "Rẽ nhánh": a branch of the selected scenario at this block. */
  startBranchAt(nodeId: number): void
  editScenario(id: number): void
  requestDeleteScenario(id: number): void
  confirmDeleteScenario(policy: ChildPolicy): Promise<void>
  cancelDeleteScenario(): void
  startPlay(scenarioId: number): void
  stopPlay(): void
  togglePausePlay(): void
  setPlaySpeed(speed: PlaySpeed): void
  setPlayImages(value: boolean): void
  /** The lightbox opened over a playing scenario: wait there. */
  pausePlayForViewer(): void
  resumePlayAfterViewer(): void
}

export const SCENARIO_EMPTY = {
  recorder: null,
  play: null,
  deleteScenarioRequest: null
} satisfies Partial<ScenarioSliceState>

/** What the slice borrows from the store it is part of. */
export interface SliceContext {
  set(partial: Partial<DiagramState>): void
  get(): DiagramState
  /** The scenario part of window.api.diagram, looked up on each call. */
  scenarioApi(): ScenarioApi
  run<T>(call: Promise<IpcResult<T>>): Promise<T | null>
  ok(call: Promise<IpcResult<unknown>>): Promise<boolean>
  restoreOk(bundle: RestoreBundle): Promise<boolean>
  record(command: { label: string; undo(): Promise<boolean>; redo(): Promise<boolean> }): void
  notify(text: string): void
  nextView(): number
}

let player: Player | null = null
let resumeAfterViewer = false

/** 0..1 through the current phase of Play, for the dot. Zero when nothing plays. */
export function playProgress(): number {
  return player?.progress() ?? 0
}

/** Stops the timers. The store calls it when the project closes or changes. */
export function disposePlayer(): void {
  player?.stop()
  player = null
  resumeAfterViewer = false
}

const windowClock: PlayClock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (h) => window.clearTimeout(h as number)
}

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const stepsOf = (data: ProjectData, scenarioId: number): StepData[] =>
  data.steps.filter((s) => s.scenarioId === scenarioId).sort((a, b) => a.idx - b.idx)

export function createScenarioSlice(ctx: SliceContext): ScenarioSliceActions {
  const { set, get, run, ok, restoreOk, record, notify } = ctx
  const api = ctx.scenarioApi

  const tree = () => (get().data ? dataScenarios(get().data as ProjectData) : [])

  /** Number of steps the draft takes over from its parent. */
  const inheritedCount = (draft: Draft) => inheritedSteps(tree(), draft).length

  const withProblem = (result: DraftResult, rec: RecorderState): RecorderState | null => {
    if (result.problem) {
      set({ recorder: { ...rec, problem: result.problem } })
      return null
    }
    return { ...rec, draft: result.draft, problem: null }
  }

  /** Clears whatever else the canvas is showing so that clicks on blocks only record. */
  const quiet = () =>
    set({
      focusId: null,
      detailId: null,
      detailLinkId: null,
      popover: null,
      selected: [],
      linking: null,
      viewer: null
    })

  async function saveNew(data: ProjectData, draft: Draft): Promise<number | null> {
    const created = await run(
      api().create(data.project.id, {
        type: draft.type,
        title: draft.title.trim(),
        parentId: draft.parentId,
        forkNodeId: draft.forkNodeId,
        steps: draft.steps.map((s) => ({ nodeId: s.nodeId, note: s.note }))
      })
    )
    if (!created) return null
    const sc = created.scenario
    const bundle: RestoreBundle = {
      scenarios: [bundleScenario(sc, data.nodes)],
      steps: [bundleSteps(sc.id, created.steps, data.nodes)]
    }
    record({
      label: 'Ghi kịch bản',
      undo: () => ok(api().remove(sc.id, 'cascade')),
      redo: () => restoreOk(bundle)
    })
    return sc.id
  }

  async function saveEdit(data: ProjectData, draft: Draft): Promise<number | null> {
    const id = draft.scenarioId as number
    const before = data.scenarios.find((s) => s.id === id)
    if (!before) return null
    const prevSteps = stepsOf(data, id).map((s) => ({ nodeId: s.nodeId, note: s.note }))
    const nextSteps = draft.steps.map((s) => ({ nodeId: s.nodeId, note: s.note }))
    const title = draft.title.trim()
    const metaChanged = before.type !== draft.type || before.title !== title
    const stepsChanged = JSON.stringify(prevSteps) !== JSON.stringify(nextSteps)
    if (metaChanged && !(await run(api().update(id, { type: draft.type, title })))) return null
    if (stepsChanged && !(await run(api().setSteps(id, nextSteps)))) {
      if (metaChanged) await ok(api().update(id, { type: before.type, title: before.title }))
      return null
    }
    if (metaChanged || stepsChanged) {
      record({
        label: 'Sửa kịch bản',
        undo: async () => {
          if (stepsChanged && !(await ok(api().setSteps(id, prevSteps)))) return false
          return metaChanged
            ? ok(api().update(id, { type: before.type, title: before.title }))
            : true
        },
        redo: async () => {
          if (metaChanged && !(await ok(api().update(id, { type: draft.type, title }))))
            return false
          return stepsChanged ? ok(api().setSteps(id, nextSteps)) : true
        }
      })
    }
    return id
  }

  function stopPlay(): void {
    disposePlayer()
    if (get().play) set({ play: null })
  }

  return {
    startRecording(draft) {
      stopPlay()
      quiet()
      const start = draft ?? newDraft('pos')
      const own = start.steps.length
      const inherited = inheritedSteps(tree(), start).length
      set({
        recorder: {
          draft: start,
          step: start.scenarioId === null && own > 0 ? inherited + own - 1 : null,
          problem: null,
          confirmCancel: false
        }
      })
    },

    recordStep(nodeId) {
      const rec = get().recorder
      if (!rec) return
      const next = withProblem(addStep(tree(), rec.draft, nodeId), rec)
      if (!next) return
      set({
        recorder: { ...next, step: inheritedCount(next.draft) + next.draft.steps.length - 1 }
      })
    },

    selectDraftStep(index) {
      const rec = get().recorder
      if (rec) set({ recorder: { ...rec, step: index } })
    },

    removeDraftStep(index) {
      const rec = get().recorder
      if (!rec) return
      const next = withProblem(removeStep(rec.draft, index), rec)
      if (next) set({ recorder: { ...next, step: null } })
    },

    moveDraftStep(from, to) {
      const rec = get().recorder
      if (!rec) return
      const next = withProblem(moveStep(rec.draft, from, to), rec)
      if (next) set({ recorder: { ...next, step: inheritedCount(next.draft) + to } })
    },

    setDraftNote(index, note) {
      const rec = get().recorder
      if (rec) set({ recorder: { ...rec, draft: setStepNote(rec.draft, index, note) } })
    },

    setDraftMeta(patch) {
      const rec = get().recorder
      if (!rec) return
      let draft = rec.draft
      if (patch.type !== undefined) draft = { ...draft, type: patch.type }
      if (patch.title !== undefined) draft = { ...draft, title: patch.title }
      if (patch.parentId !== undefined) {
        const changed = setParent(tree(), draft, patch.parentId)
        if (changed.problem) {
          set({ recorder: { ...rec, draft, problem: changed.problem } })
          return
        }
        draft = changed.draft
      }
      set({
        recorder: {
          ...rec,
          draft,
          problem: null,
          step: patch.parentId !== undefined ? null : rec.step
        }
      })
    },

    requestCancelRecording() {
      const rec = get().recorder
      if (!rec) return
      const empty =
        rec.draft.scenarioId === null && rec.draft.steps.length === 0 && rec.draft.title === ''
      // Asking is only for work that would be lost.
      if (empty) set({ recorder: null })
      else set({ recorder: { ...rec, confirmCancel: true } })
    },

    resumeRecording() {
      const rec = get().recorder
      if (rec) set({ recorder: { ...rec, confirmCancel: false } })
    },

    cancelRecording() {
      set({ recorder: null })
    },

    async saveRecording() {
      const data = get().data
      const rec = get().recorder
      if (!data || !rec) return null
      const scenarios = dataScenarios(data)
      const draft = rec.draft
      const below =
        draft.scenarioId === null ? [] : (descendants(scenarios, draft.scenarioId) as number[])
      const problem = validateDraft(scenarios, draft, below)
      if (problem) {
        set({ recorder: { ...rec, problem } })
        return null
      }
      const id =
        draft.scenarioId === null ? await saveNew(data, draft) : await saveEdit(data, draft)
      if (id === null) return null
      set({ recorder: null, selectedScenarios: [id] })
      await get().reload()
      const saved = get().data?.scenarios.find((s) => s.id === id)
      if (saved) notify(t.scenario.saved.replace('{key}', saved.key))
      return id
    },

    async branchFromStep(index) {
      const rec = get().recorder
      const data = get().data
      if (!rec || !data) return
      const path = draftPath(dataScenarios(data), rec.draft)
      const nodeId = path[index]?.nodeId
      if (nodeId === undefined) return
      const id = await get().saveRecording()
      if (id === null) return
      get().startRecording(branchDraft(id, nodeId as number, 'alt'))
    },

    startBranchAt(nodeId) {
      const data = get().data
      if (!data) return
      const chosen = get().selectedScenarios
      const parent =
        chosen.length === 1 ? data.scenarios.find((s) => s.id === chosen[0]) : undefined
      if (!parent) {
        notify(t.scenario.branchPickOne)
        return
      }
      if (!pathNodeIds(dataScenarios(data), parent.id).includes(nodeId)) {
        const block = data.nodes.find((n) => n.id === nodeId)
        notify(
          t.scenario.branchNotOnPath
            .replace('{block}', block?.code ?? '')
            .replace('{key}', parent.key)
        )
        return
      }
      get().startRecording(branchDraft(parent.id, nodeId, 'alt'))
    },

    editScenario(id) {
      const data = get().data
      const sc = data?.scenarios.find((s) => s.id === id)
      if (!data || !sc) return
      get().startRecording(draftOf(sc, stepsOf(data, id)))
    },

    requestDeleteScenario(id) {
      const data = get().data
      const sc = data?.scenarios.find((s) => s.id === id)
      if (!data || !sc) return
      const children = (descendants(dataScenarios(data), id) as number[]).flatMap((cid) => {
        const c = data.scenarios.find((s) => s.id === cid)
        return c ? [{ id: c.id, key: c.key, title: c.title }] : []
      })
      set({ deleteScenarioRequest: { id, key: sc.key, children } })
    },

    cancelDeleteScenario() {
      set({ deleteScenarioRequest: null })
    },

    async confirmDeleteScenario(policy) {
      const request = get().deleteScenarioRequest
      const data = get().data
      set({ deleteScenarioRequest: null })
      if (!request || !data) return
      const scenarios = dataScenarios(data)
      const gone =
        policy === 'cascade'
          ? [request.id, ...(descendants(scenarios, request.id) as number[])]
          : [request.id]
      const bundle = snapshotScenarioDelete(data, request.id, policy)
      if (!(await run(api().remove(request.id, policy)))) return
      record({
        label: 'Xóa kịch bản',
        undo: () => restoreOk(bundle),
        redo: () => ok(api().remove(request.id, policy))
      })
      if (get().play?.scenarioId !== undefined && gone.includes(get().play?.scenarioId as number)) {
        stopPlay()
      }
      await get().reload()
    },

    startPlay(scenarioId) {
      const data = get().data
      if (!data) return
      const steps = fullPath(dataScenarios(data), scenarioId).map((s) => ({
        nodeId: s.nodeId as number,
        note: s.note
      }))
      if (steps.length === 0) {
        notify(t.scenario.playEmpty)
        return
      }
      stopPlay()
      const reduced = prefersReducedMotion()
      const started = createPlayer({
        stepCount: steps.length,
        clock: windowClock,
        travel: !reduced,
        hooks: {
          step: (i) => {
            const p = get().play
            const step = steps[i]
            if (!p || !step) return
            set({
              play: { ...p, index: i, travel: null },
              viewRequest: {
                seq: ctx.nextView(),
                kind: 'play',
                nodeId: step.nodeId,
                ms: reduced ? 0 : (player?.cameraMs() ?? 500),
                first: i === 0
              }
            })
          },
          travel: (from, to) => {
            const p = get().play
            const a = steps[from]
            const b = steps[to]
            if (p && a && b) set({ play: { ...p, travel: { from: a.nodeId, to: b.nodeId } } })
          },
          state: (state) => {
            const p = get().play
            if (state === 'finished') stopPlay()
            else if (p && (state === 'paused' || state === 'playing')) {
              set({ play: { ...p, paused: state === 'paused' } })
            }
          }
        }
      })
      player = started
      quiet()
      set({
        recorder: null,
        play: { scenarioId, steps, index: 0, paused: false, speed: 1, travel: null, reduced }
      })
      started.start()
    },

    stopPlay,

    togglePausePlay() {
      if (!player) return
      if (player.state() === 'playing') player.pause()
      else if (player.state() === 'paused') player.resume()
    },

    setPlaySpeed(speed) {
      const p = get().play
      if (!player || !p) return
      player.setSpeed(speed)
      set({ play: { ...p, speed } })
    },

    setPlayImages(value) {
      if (get().playImages !== value) set({ playImages: value })
    },

    pausePlayForViewer() {
      if (player?.state() === 'playing') {
        player.pause()
        resumeAfterViewer = true
      }
    },

    resumePlayAfterViewer() {
      if (resumeAfterViewer && player?.state() === 'paused') player.resume()
      resumeAfterViewer = false
    }
  }
}
