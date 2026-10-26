import { descendants } from './scenario'
import { dataScenarios } from './flowmap/convert'
import type {
  BundleScenario,
  BundleSteps,
  ChildPolicy,
  GroupData,
  ProjectData,
  RestoreBundle,
  ScenarioData
} from './types'

/**
 * Everything that deleting these blocks would take away, in the form `history.restore` puts back
 * (TDD 8.8): the blocks, the channels that touch them, their images and pins, the complete step
 * lists of the scenarios that pass through them and the fork points that would be cut.
 * `groups` adds whole groups, for removing a group together with its blocks.
 */
export function snapshotNodes(
  data: ProjectData,
  ids: readonly number[],
  groups: readonly GroupData[] = []
): RestoreBundle {
  const wanted = new Set(ids)
  const keyOf = new Map(data.nodes.map((n) => [n.id, n.key]))
  const nodes = data.nodes.filter((n) => wanted.has(n.id))
  const links = data.links
    .filter((l) => wanted.has(l.fromNode) || wanted.has(l.toNode))
    .map(({ fromNode, toNode, ...l }) => ({
      ...l,
      fromKey: keyOf.get(fromNode) ?? '',
      toKey: keyOf.get(toNode) ?? ''
    }))
  const images = data.images
    .filter((i) => wanted.has(i.nodeId))
    .map(({ nodeId, ...i }) => ({ ...i, nodeKey: keyOf.get(nodeId) ?? '' }))
  const imageIds = new Set(images.map((i) => i.id))
  const pins = data.pins.filter((p) => imageIds.has(p.imageId))

  const touched = new Set(data.steps.filter((s) => wanted.has(s.nodeId)).map((s) => s.scenarioId))
  const steps: BundleSteps[] = [...touched].map((scenarioId) => ({
    scenarioId,
    steps: data.steps
      .filter((s) => s.scenarioId === scenarioId)
      .sort((a, b) => a.idx - b.idx)
      .map((s) => ({ nodeKey: keyOf.get(s.nodeId) ?? '', note: s.note }))
  }))
  const forks = data.scenarios
    .filter((s) => s.forkNodeId !== null && wanted.has(s.forkNodeId))
    .map((s) => ({
      scenarioId: s.id,
      parentId: s.parentId,
      forkNodeKey: s.forkNodeId === null ? null : (keyOf.get(s.forkNodeId) ?? null)
    }))

  return { groups: [...groups], nodes, links, images, pins, steps, forks }
}

/** The same blocks, links and group, without ids: for pasting a copy. */
export function withoutIds<T extends { id?: number }>(rows: readonly T[]): T[] {
  return rows.map((r) => {
    const { id: _id, ...rest } = r
    void _id
    return rest as T
  })
}

type KeyedNode = { id: number; key: string }

/** A scenario in the form `history.restore` puts back under its old id. */
export function bundleScenario(s: ScenarioData, nodes: readonly KeyedNode[]): BundleScenario {
  const fork =
    s.forkNodeId === null ? null : (nodes.find((n) => n.id === s.forkNodeId)?.key ?? null)
  return {
    id: s.id,
    key: s.key,
    type: s.type,
    title: s.title,
    parentId: s.parentId,
    forkNodeKey: fork,
    sortOrder: s.sortOrder
  }
}

/** The complete steps of one scenario, blocks named by key. */
export function bundleSteps(
  scenarioId: number,
  steps: readonly { nodeId: number; note: string }[],
  nodes: readonly KeyedNode[]
): BundleSteps {
  const keyOf = new Map(nodes.map((n) => [n.id, n.key]))
  return {
    scenarioId,
    steps: steps.map((s) => ({ nodeKey: keyOf.get(s.nodeId) ?? '', note: s.note }))
  }
}

const stepsOf = (data: ProjectData, scenarioId: number) =>
  data.steps
    .filter((s) => s.scenarioId === scenarioId)
    .sort((a, b) => a.idx - b.idx)
    .map((s) => ({ nodeId: s.nodeId, note: s.note }))

/**
 * Everything that deleting a scenario takes away, so that undo can put it back (FR-KB-07).
 * `cascade` also removes the branches below, so they all come back. `promote` moves the direct
 * branches up to the parent, so their old parent, fork block and steps are kept to be restored.
 * Parents are listed before their branches.
 */
export function snapshotScenarioDelete(
  data: ProjectData,
  id: number,
  policy: ChildPolicy
): RestoreBundle {
  const gone =
    policy === 'cascade' ? [id, ...(descendants(dataScenarios(data), id) as number[])] : [id]
  const bundle: RestoreBundle = {
    scenarios: gone.flatMap((sid) => {
      const found = data.scenarios.find((x) => x.id === sid)
      return found ? [bundleScenario(found, data.nodes)] : []
    }),
    steps: gone.map((sid) => bundleSteps(sid, stepsOf(data, sid), data.nodes))
  }
  if (policy === 'promote') {
    const kids = data.scenarios.filter((k) => k.parentId === id)
    bundle.steps = [
      ...(bundle.steps ?? []),
      ...kids.map((k) => bundleSteps(k.id, stepsOf(data, k.id), data.nodes))
    ]
    bundle.forks = kids.map((k) => ({
      scenarioId: k.id,
      parentId: k.parentId,
      forkNodeKey:
        k.forkNodeId === null ? null : (data.nodes.find((n) => n.id === k.forkNodeId)?.key ?? null)
    }))
  }
  return bundle
}
