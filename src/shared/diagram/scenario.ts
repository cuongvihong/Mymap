import type { Id } from './focus'

export interface PathStep {
  nodeId: Id
  note: string
}

/** A scenario in the shape the path functions need. Works for database ids and for YAML ids. */
export interface ScenarioNode {
  id: Id
  parentId: Id | null
  /** Fork point: a block on the full path of the parent (BR-06). */
  forkNodeId: Id | null
  steps: readonly PathStep[]
}

function byId(scenarios: readonly ScenarioNode[]): Map<Id, ScenarioNode> {
  const map = new Map<Id, ScenarioNode>()
  for (const s of scenarios) map.set(s.id, s)
  return map
}

function pathOf(map: Map<Id, ScenarioNode>, id: Id, seen: Set<Id>): PathStep[] {
  const s = map.get(id)
  if (!s) return []
  if (s.parentId === null || seen.has(s.id)) return s.steps.map((x) => ({ ...x }))
  seen.add(s.id)
  const parent = pathOf(map, s.parentId, seen)
  const at = parent.findIndex((x) => x.nodeId === s.forkNodeId)
  // Parent path up to, but not including, the fork point, then the steps of the branch.
  // A fork point that is not on the parent path is invalid data; keep the whole parent path then.
  const prefix = at < 0 ? parent : parent.slice(0, at)
  return [...prefix, ...s.steps.map((x) => ({ ...x }))]
}

/**
 * Full path of a scenario (TDD 8.5): the path of the parent up to before the fork point, followed
 * by the steps of the branch. Works for branches of any depth. Loops in the data are cut, not followed.
 */
export function fullPath(scenarios: readonly ScenarioNode[], id: Id): PathStep[] {
  return pathOf(byId(scenarios), id, new Set())
}

/** Ids of the blocks on the full path, in order and without repeats. */
export function pathNodeIds(scenarios: readonly ScenarioNode[], id: Id): Id[] {
  const seen = new Set<Id>()
  for (const s of fullPath(scenarios, id)) seen.add(s.nodeId)
  return [...seen]
}

/** True when giving `id` the parent `newParentId` would create a parent loop (BR-07). */
export function wouldCycle(
  scenarios: readonly ScenarioNode[],
  id: Id,
  newParentId: Id | null
): boolean {
  if (newParentId === null) return false
  const map = byId(scenarios)
  let cur: Id | null = newParentId
  const seen = new Set<Id>()
  while (cur !== null) {
    if (cur === id) return true
    if (seen.has(cur)) return true
    seen.add(cur)
    cur = map.get(cur)?.parentId ?? null
  }
  return false
}

/** Ids of all branches below a scenario, nearest first. */
export function descendants(scenarios: readonly ScenarioNode[], id: Id): Id[] {
  const out: Id[] = []
  const queue: Id[] = [id]
  const seen = new Set<Id>([id])
  while (queue.length > 0) {
    const cur = queue.shift() as Id
    for (const s of scenarios) {
      if (s.parentId === cur && !seen.has(s.id)) {
        seen.add(s.id)
        out.push(s.id)
        queue.push(s.id)
      }
    }
  }
  return out
}

export type ScenarioProblem =
  | 'cycle'
  | 'parent-missing'
  | 'fork-missing'
  | 'fork-without-parent'
  | 'fork-not-on-path'
  | 'first-step-not-fork'

/**
 * Checks BR-06 to BR-08 for one scenario. Returns the problems, empty when it is fine.
 * A scenario that is part of a parent loop reports only `cycle`.
 */
export function checkScenario(scenarios: readonly ScenarioNode[], id: Id): ScenarioProblem[] {
  const map = byId(scenarios)
  const s = map.get(id)
  if (!s) return []
  if (s.parentId === null) {
    return s.forkNodeId !== null ? ['fork-without-parent'] : []
  }
  if (wouldCycle(scenarios, id, s.parentId)) return ['cycle']
  const parent = map.get(s.parentId)
  if (!parent) return ['parent-missing']
  const problems: ScenarioProblem[] = []
  if (s.forkNodeId === null) {
    problems.push('fork-missing')
  } else {
    const onPath = pathNodeIds(scenarios, parent.id).includes(s.forkNodeId)
    if (!onPath) problems.push('fork-not-on-path')
    const first = s.steps[0]
    if (first && first.nodeId !== s.forkNodeId) problems.push('first-step-not-fork')
  }
  return problems
}

/**
 * Scenarios whose full path goes through any of the blocks, including branches that inherit the
 * block from a parent (FR-SUA-06). Order follows the input order.
 */
export function scenariosUsingNodes(
  scenarios: readonly ScenarioNode[],
  nodeIds: readonly Id[]
): Id[] {
  const wanted = new Set<Id>(nodeIds)
  const out: Id[] = []
  for (const s of scenarios) {
    if (fullPath(scenarios, s.id).some((x) => wanted.has(x.nodeId))) out.push(s.id)
  }
  return out
}

/** Branches whose fork point is one of the blocks. They become root scenarios when it is deleted. */
export function scenariosForkedAt(
  scenarios: readonly ScenarioNode[],
  nodeIds: readonly Id[]
): Id[] {
  const wanted = new Set<Id>(nodeIds)
  return scenarios.filter((s) => s.forkNodeId !== null && wanted.has(s.forkNodeId)).map((s) => s.id)
}

export interface PromotedBranch {
  id: Id
  parentId: Id | null
  forkNodeId: Id | null
  steps: PathStep[]
}

/**
 * Re-parents the direct branches of a scenario that is being deleted, keeping their full paths
 * unchanged (FR-KB-07, "chuyển lên làm con của cha").
 * The branch takes the parent of the deleted scenario. If its fork point lies in the part of the
 * path that belongs to the deleted scenario, the steps of the deleted scenario before that point
 * are copied to the front of the branch, and the fork moves to where the deleted scenario forked.
 * With no grandparent the branch becomes a root scenario that carries the whole prefix.
 */
export function promoteChildren(
  scenarios: readonly ScenarioNode[],
  removedId: Id
): PromotedBranch[] {
  const map = byId(scenarios)
  const removed = map.get(removedId)
  if (!removed) return []
  const removedPath = fullPath(scenarios, removedId)
  const out: PromotedBranch[] = []
  for (const child of scenarios) {
    if (child.parentId !== removedId) continue
    const at = removedPath.findIndex((x) => x.nodeId === child.forkNodeId)
    const prefix = at < 0 ? removedPath : removedPath.slice(0, at)
    const ownIndex = removed.steps.findIndex((x) => x.nodeId === child.forkNodeId)
    if (removed.parentId === null) {
      out.push({
        id: child.id,
        parentId: null,
        forkNodeId: null,
        steps: [...prefix, ...child.steps].map((x) => ({ ...x }))
      })
    } else if (ownIndex < 0) {
      // The fork point is inherited from the grandparent, so it is still valid there.
      out.push({
        id: child.id,
        parentId: removed.parentId,
        forkNodeId: child.forkNodeId,
        steps: child.steps.map((x) => ({ ...x }))
      })
    } else {
      const own = removed.steps.slice(0, ownIndex)
      out.push({
        id: child.id,
        parentId: removed.parentId,
        forkNodeId: removed.forkNodeId,
        steps: [...own, ...child.steps].map((x) => ({ ...x }))
      })
    }
  }
  return out
}
