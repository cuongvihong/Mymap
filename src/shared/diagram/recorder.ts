import { LIMITS, type ScenarioType } from './types'
import {
  checkScenario,
  fullPath,
  pathNodeIds,
  type PathStep,
  type ScenarioNode,
  type ScenarioProblem
} from './scenario'

/**
 * The scenario being recorded or edited (FR-KB-03, FR-KB-07). Pure functions over a draft, so the
 * rules of BR-06 to BR-08 are checked before anything is saved.
 */
export interface DraftStep {
  nodeId: number
  note: string
}

export interface Draft {
  /** Null while a new scenario is recorded. */
  scenarioId: number | null
  type: ScenarioType
  title: string
  parentId: number | null
  /** Fork block of a branch. The first own step is always this block (BR-08). */
  forkNodeId: number | null
  /** Own steps only. The part before the fork belongs to the parent. */
  steps: DraftStep[]
}

export type DraftProblem = ScenarioProblem | 'title-empty' | 'no-steps'

/** Id the draft has in a tree that does not contain it yet. */
const DRAFT_ID = -1

export function newDraft(type: ScenarioType = 'pos'): Draft {
  return { scenarioId: null, type, title: '', parentId: null, forkNodeId: null, steps: [] }
}

/** A branch of `parentId` that leaves at `forkNodeId`. The fork block is its first step. */
export function branchDraft(
  parentId: number,
  forkNodeId: number,
  type: ScenarioType = 'alt'
): Draft {
  return {
    scenarioId: null,
    type,
    title: '',
    parentId,
    forkNodeId,
    steps: [{ nodeId: forkNodeId, note: '' }]
  }
}

export function draftOf(
  scenario: {
    id: number
    type: ScenarioType
    title: string
    parentId: number | null
    forkNodeId: number | null
  },
  steps: readonly DraftStep[]
): Draft {
  return {
    scenarioId: scenario.id,
    type: scenario.type,
    title: scenario.title,
    parentId: scenario.parentId,
    forkNodeId: scenario.forkNodeId,
    steps: steps.map((s) => ({ ...s }))
  }
}

/** The draft as a node of the scenario tree, replacing the saved scenario with the same id. */
export function withDraft(scenarios: readonly ScenarioNode[], draft: Draft): ScenarioNode[] {
  const id = draft.scenarioId ?? DRAFT_ID
  return [
    ...scenarios.filter((s) => s.id !== id),
    {
      id,
      parentId: draft.parentId,
      forkNodeId: draft.forkNodeId,
      steps: draft.steps.map((s) => ({ nodeId: s.nodeId, note: s.note }))
    }
  ]
}

/** Steps the branch takes over from its parent, up to but not including the fork block. */
export function inheritedSteps(scenarios: readonly ScenarioNode[], draft: Draft): PathStep[] {
  if (draft.parentId === null || draft.forkNodeId === null) return []
  const parent = fullPath(scenarios, draft.parentId)
  const at = parent.findIndex((s) => s.nodeId === draft.forkNodeId)
  return at < 0 ? [] : parent.slice(0, at)
}

/** Inherited steps followed by the own steps: the whole path the scenario would play. */
export function draftPath(scenarios: readonly ScenarioNode[], draft: Draft): PathStep[] {
  return [
    ...inheritedSteps(scenarios, draft),
    ...draft.steps.map((s) => ({ nodeId: s.nodeId, note: s.note }))
  ]
}

export type DraftResult =
  { draft: Draft; problem?: undefined } | { draft?: undefined; problem: DraftProblem }

const ok = (draft: Draft): DraftResult => ({ draft })
const fail = (problem: DraftProblem): DraftResult => ({ problem })

/** Fork block of a branch must sit on the full path of the parent (BR-06). */
function forkIsOnParentPath(
  scenarios: readonly ScenarioNode[],
  parentId: number,
  nodeId: number
): boolean {
  return pathNodeIds(scenarios, parentId).includes(nodeId)
}

/** Adds a block as the next step. For a branch the first block clicked becomes the fork (BR-06). */
export function addStep(
  scenarios: readonly ScenarioNode[],
  draft: Draft,
  nodeId: number
): DraftResult {
  if (draft.parentId !== null && draft.steps.length === 0) {
    if (!forkIsOnParentPath(scenarios, draft.parentId, nodeId)) return fail('fork-not-on-path')
    return ok({ ...draft, forkNodeId: nodeId, steps: [{ nodeId, note: '' }] })
  }
  return ok({ ...draft, steps: [...draft.steps, { nodeId, note: '' }] })
}

/** Removes a step. The fork step of a branch stays while other steps follow it (BR-08). */
export function removeStep(draft: Draft, index: number): DraftResult {
  if (index < 0 || index >= draft.steps.length) return ok(draft)
  if (draft.parentId !== null && index === 0 && draft.steps.length > 1) {
    return fail('first-step-not-fork')
  }
  const steps = draft.steps.filter((_, i) => i !== index)
  const emptied = draft.parentId !== null && steps.length === 0
  return ok({ ...draft, steps, forkNodeId: emptied ? null : draft.forkNodeId })
}

/** Moves a step. In a branch nothing may take the place of the fork block at the front (BR-08). */
export function moveStep(draft: Draft, from: number, to: number): DraftResult {
  const n = draft.steps.length
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return ok(draft)
  if (draft.parentId !== null && (from === 0 || to === 0)) return fail('first-step-not-fork')
  const steps = [...draft.steps]
  const [moved] = steps.splice(from, 1)
  steps.splice(to, 0, moved as DraftStep)
  return ok({ ...draft, steps })
}

export function setStepNote(draft: Draft, index: number, note: string): Draft {
  return {
    ...draft,
    steps: draft.steps.map((s, i) =>
      i === index ? { ...s, note: note.slice(0, LIMITS.stepNote) } : s
    )
  }
}

/**
 * Gives the draft a parent, or none. With steps already recorded the first one becomes the fork,
 * so it must lie on the path of the new parent.
 */
export function setParent(
  scenarios: readonly ScenarioNode[],
  draft: Draft,
  parentId: number | null
): DraftResult {
  if (parentId === null) return ok({ ...draft, parentId: null, forkNodeId: null })
  const first = draft.steps[0]
  if (!first) return ok({ ...draft, parentId, forkNodeId: null })
  if (!forkIsOnParentPath(scenarios, parentId, first.nodeId)) return fail('fork-not-on-path')
  return ok({ ...draft, parentId, forkNodeId: first.nodeId })
}

/**
 * Why the draft cannot be saved, or null. Checks the title, that there is a step, and the rules
 * of BR-06 to BR-08 for the draft and for every branch that hangs below it.
 */
export function validateDraft(
  scenarios: readonly ScenarioNode[],
  draft: Draft,
  descendantIds: readonly number[] = []
): DraftProblem | null {
  if (draft.title.trim() === '') return 'title-empty'
  if (draft.steps.length === 0) return 'no-steps'
  const tree = withDraft(scenarios, draft)
  const id = draft.scenarioId ?? DRAFT_ID
  for (const check of [id, ...descendantIds]) {
    const problem = checkScenario(tree, check)[0]
    if (problem) return problem
  }
  return null
}
