import type { Id } from './focus'
import type { PathStep } from './scenario'

/** Distance between the paths of scenarios drawn together, in px (FR-KB-05). */
export const SCENARIO_LINE_STEP = 7

/** Offset of line `index` among `count` lines drawn together: (i - (n - 1) / 2) * 7. */
export function lineOffset(index: number, count: number): number {
  const value = (index - (count - 1) / 2) * SCENARIO_LINE_STEP
  return value === 0 ? 0 : value
}

export interface TreeItem {
  id: number
  /** 0 for a root scenario, 1 for a branch, 2 for a branch of a branch. */
  depth: number
}

interface Sortable {
  id: number
  parentId: number | null
  sortOrder: number
}

/**
 * Scenarios in the order of the sidebar tree (FR-KB-02): a root first, then its branches beneath
 * it, each level in `sortOrder`. A scenario whose parent is missing is shown as a root.
 */
export function treeOrder(scenarios: readonly Sortable[]): TreeItem[] {
  const ids = new Set(scenarios.map((s) => s.id))
  const byOrder = (a: Sortable, b: Sortable) => a.sortOrder - b.sortOrder || a.id - b.id
  const children = new Map<number | null, Sortable[]>()
  for (const s of scenarios) {
    const parent = s.parentId !== null && ids.has(s.parentId) ? s.parentId : null
    const list = children.get(parent) ?? []
    list.push(s)
    children.set(parent, list)
  }
  const out: TreeItem[] = []
  const seen = new Set<number>()
  const walk = (parent: number | null, depth: number) => {
    for (const s of (children.get(parent) ?? []).sort(byOrder)) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push({ id: s.id, depth })
      walk(s.id, depth + 1)
    }
  }
  walk(null, 0)
  // A parent loop would leave its members unreachable. Show them as roots rather than hide them.
  for (const s of [...scenarios].sort(byOrder)) {
    if (!seen.has(s.id)) {
      seen.add(s.id)
      out.push({ id: s.id, depth: 0 })
      walk(s.id, 1)
    }
  }
  return out
}

/** Pairs of consecutive blocks of a path. Two steps on the same block draw nothing. */
export function pathSegments(path: readonly Pick<PathStep, 'nodeId'>[]): [Id, Id][] {
  const out: [Id, Id][] = []
  for (let i = 1; i < path.length; i++) {
    const a = (path[i - 1] as PathStep).nodeId
    const b = (path[i] as PathStep).nodeId
    if (a !== b) out.push([a, b])
  }
  return out
}

/**
 * Blocks where a selected branch leaves its parent, with the codes of those branches. They carry
 * the "rẽ nhánh" label (FR-KH-03, FR-KB-05).
 */
export function forkMarks(
  scenarios: readonly { id: number; key: string; forkNodeId: number | null }[],
  selected: readonly number[]
): Map<number, string[]> {
  const chosen = new Set(selected)
  const out = new Map<number, string[]>()
  for (const s of scenarios) {
    if (!chosen.has(s.id) || s.forkNodeId === null) continue
    out.set(s.forkNodeId, [...(out.get(s.forkNodeId) ?? []), s.key])
  }
  return out
}
