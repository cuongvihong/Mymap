import type {
  FlowmapDoc,
  FlowmapGroup,
  FlowmapLink,
  FlowmapNode,
  FlowmapScenario,
  MergeChange,
  MergeKind,
  MergeOptions,
  MergePlan,
  MergeSummary
} from '../types'

const KINDS: readonly MergeKind[] = ['groups', 'nodes', 'links', 'scenarios']

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function differing<T extends object>(a: T, b: T, fields: readonly (keyof T)[]): string[] {
  return fields.filter((f) => !same(a[f], b[f])).map(String)
}

const GROUP_FIELDS: (keyof FlowmapGroup)[] = ['title', 'fs']
const NODE_FIELDS: (keyof FlowmapNode)[] = [
  'type',
  'subtype',
  'group',
  'code',
  'title',
  'body',
  'fix',
  'chips',
  'fs',
  'section'
]
const LINK_FIELDS: (keyof FlowmapLink)[] = ['from', 'to', 'via', 'label', 'note']
const SCENARIO_FIELDS: (keyof FlowmapScenario)[] = ['type', 'title', 'parent', 'at', 'steps']

function plan<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[],
  fields: readonly (keyof T)[],
  removeMissing: boolean,
  extraFields?: (before: T, after: T) => string[]
): { add: T[]; update: MergeChange<T>[]; remove: string[]; keep: string[] } {
  const before = new Map(current.map((x) => [x.id, x]))
  const seen = new Set<string>()
  const add: T[] = []
  const update: MergeChange<T>[] = []
  const keep: string[] = []
  for (const item of incoming) {
    seen.add(item.id)
    const old = before.get(item.id)
    if (!old) {
      add.push(item)
      continue
    }
    const changed = [
      ...differing(old, item, fields),
      ...(extraFields ? extraFields(old, item) : [])
    ]
    if (changed.length > 0) update.push({ id: item.id, after: item, fields: changed })
    else keep.push(item.id)
  }
  const remove = removeMissing ? current.filter((x) => !seen.has(x.id)).map((x) => x.id) : []
  return { add, update, remove, keep }
}

const SAME_POSITION = 0.01
const samePosition = (a: readonly number[], b: readonly number[]) =>
  Math.abs((a[0] ?? 0) - (b[0] ?? 0)) < SAME_POSITION &&
  Math.abs((a[1] ?? 0) - (b[1] ?? 0)) < SAME_POSITION

/**
 * Compares the project as it is with an incoming file and says what an import would do (TDD 6.5).
 * Items match by id. Only content fields count as a change, so a file without `layout` never
 * touches coordinates (BR-04). With `layout`, a block whose position differs is an update.
 * `current.layout` must hold only blocks that really have coordinates (has_layout = 1).
 * `remove` stays empty unless `removeMissing` is on.
 */
export function planMerge(
  current: FlowmapDoc,
  incoming: FlowmapDoc,
  options: MergeOptions
): MergePlan {
  const remove = options.removeMissing
  const groups = plan(current.groups, incoming.groups, GROUP_FIELDS, remove)

  const layout: MergePlan['layout'] = {}
  const nodes = plan(current.nodes, incoming.nodes, NODE_FIELDS, remove, (_before, after) => {
    const next = incoming.layout[after.id]
    if (!next) return []
    const now = current.layout[after.id]
    if (now && samePosition(now, next)) return []
    layout[after.id] = [next[0], next[1]]
    return ['layout']
  })
  // New blocks take their coordinates from the file when it has them.
  for (const n of nodes.add) {
    const next = incoming.layout[n.id]
    if (next) layout[n.id] = [next[0], next[1]]
  }

  const links = plan(current.links, incoming.links, LINK_FIELDS, remove)
  const scenarios = plan(current.scenarios, incoming.scenarios, SCENARIO_FIELDS, remove)

  return {
    add: {
      groups: groups.add,
      nodes: nodes.add,
      links: links.add,
      scenarios: scenarios.add
    },
    update: {
      groups: groups.update,
      nodes: nodes.update,
      links: links.update,
      scenarios: scenarios.update
    },
    remove: {
      groups: groups.remove,
      nodes: nodes.remove,
      links: links.remove,
      scenarios: scenarios.remove
    },
    keep: {
      groups: groups.keep,
      nodes: nodes.keep,
      links: links.keep,
      scenarios: scenarios.keep
    },
    layout
  }
}

/** Counts for the confirmation box (FR-YM-02 step 2). */
export function summarize(p: MergePlan): MergeSummary {
  const count = (pick: (k: MergeKind) => number): Record<MergeKind, number> => ({
    groups: pick('groups'),
    nodes: pick('nodes'),
    links: pick('links'),
    scenarios: pick('scenarios')
  })
  const add = count((k) => p.add[k].length)
  const update = count((k) => p.update[k].length)
  const remove = count((k) => p.remove[k].length)
  const keep = count((k) => p.keep[k].length)
  const total = (r: Record<MergeKind, number>) => KINDS.reduce((sum, k) => sum + r[k], 0)
  return {
    add,
    update,
    remove,
    keep,
    unchanged: total(add) + total(update) + total(remove) === 0
  }
}
