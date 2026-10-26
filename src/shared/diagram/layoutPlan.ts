import {
  computeLayout,
  pendingAnchor,
  placeAt,
  unionRect,
  type ElkLike,
  type LayoutBlock,
  type LayoutMove
} from './autolayout'
import { blockWidth } from './frames'
import type { Rect } from './geometry'
import { estimateBlockHeight } from './jsoncanvas'
import type { LinkData, NodeData } from './types'

/**
 * What the "auto layout" button, the key L and the import use (FR-BC-01, TDD 8.7).
 *
 * `pending`: only blocks that have no coordinates yet (has_layout = 0), put below the blocks that
 * are already placed. `all`: every block, in place of the old layout. `selection`: only the chosen
 * blocks, kept where the selection was.
 */
export type LayoutScope =
  { kind: 'pending' } | { kind: 'all' } | { kind: 'selection'; ids: readonly number[] }

export interface LayoutData {
  nodes: readonly NodeData[]
  links: readonly Pick<LinkData, 'fromNode' | 'toNode'>[]
}

export type SizeOf = (node: NodeData) => { w: number; h: number }

/** Width of the block type and the height the block would have when measured by the estimate. */
export const estimatedSize: SizeOf = (n) => ({
  w: blockWidth(n.type),
  h: estimateBlockHeight({
    type: n.type,
    title: n.title,
    body: n.body,
    fix: n.fixText,
    chips: n.chips
  })
})

/** Ids of the blocks the scope moves. */
export function layoutTargets(nodes: readonly NodeData[], scope: LayoutScope): NodeData[] {
  if (scope.kind === 'all') return [...nodes]
  if (scope.kind === 'pending') return nodes.filter((n) => !n.hasLayout)
  const ids = new Set(scope.ids)
  return nodes.filter((n) => ids.has(n.id))
}

/**
 * New coordinates for the blocks of the scope. An empty list when there is nothing to lay out.
 * `sizeOf` gives the measured size of a block when the caller has it, else the estimate is used.
 */
export async function planLayout(
  elk: ElkLike,
  data: LayoutData,
  scope: LayoutScope,
  sizeOf: SizeOf = estimatedSize
): Promise<LayoutMove[]> {
  const targets = layoutTargets(data.nodes, scope)
  if (targets.length === 0) return []
  const ids = new Set(targets.map((n) => n.id))
  const size = new Map(data.nodes.map((n) => [n.id, sizeOf(n)]))
  const blocks: LayoutBlock[] = targets.map((n) => {
    const s = size.get(n.id) as { w: number; h: number }
    return { id: n.id, w: s.w, h: s.h, group: n.groupId }
  })
  const links = data.links
    .filter((l) => ids.has(l.fromNode) && ids.has(l.toNode))
    .map((l) => ({ from: l.fromNode, to: l.toNode }))
  const placed = await computeLayout(elk, { blocks, links })

  const rectOf = (n: NodeData): Rect => {
    const s = size.get(n.id) as { w: number; h: number }
    return { x: n.x, y: n.y, w: s.w, h: s.h }
  }
  let anchor: { x: number; y: number }
  if (scope.kind === 'pending') {
    anchor = pendingAnchor(data.nodes.filter((n) => !ids.has(n.id)).map(rectOf))
  } else {
    const box = unionRect(targets.map(rectOf))
    anchor = box ? { x: box.x, y: box.y } : { x: 0, y: 0 }
  }
  return placeAt(placed, anchor)
}
