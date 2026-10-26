import { FRAME_PAD } from './frames'
import type { Rect } from './geometry'

/**
 * Automatic layout (FR-BC-01, TDD 8.7). The graph is handed to ELK, algorithm `layered`, direction
 * RIGHT, with groups as compound nodes so that frames never overlap. ELK itself is injected: the
 * renderer runs it in a Web Worker, tests and export run the bundled build in Node.
 */

export const LAYOUT_SPACING = { node: 48, layer: 96 } as const

export interface LayoutBlock {
  id: number
  w: number
  h: number
  group: number | null
}

export interface LayoutLink {
  from: number
  to: number
}

export interface LayoutInput {
  blocks: readonly LayoutBlock[]
  links: readonly LayoutLink[]
}

export interface ElkNode {
  id: string
  x?: number
  y?: number
  width?: number
  height?: number
  layoutOptions?: Record<string, string>
  children?: ElkNode[]
  edges?: { id: string; sources: string[]; targets: string[] }[]
}

export interface ElkLike {
  layout(graph: ElkNode): Promise<ElkNode>
}

const nodeKey = (id: number) => `n${id}`
const groupKey = (id: number) => `g${id}`

/** The graph in ELK's JSON form. Groups that have no block in the input are left out. */
export function buildElkGraph(input: LayoutInput): ElkNode {
  const present = new Set(input.blocks.map((b) => b.id))
  const inGroup = new Map<number, ElkNode>()
  const children: ElkNode[] = []
  for (const b of input.blocks) {
    const leaf: ElkNode = { id: nodeKey(b.id), width: b.w, height: b.h }
    if (b.group === null) {
      children.push(leaf)
      continue
    }
    let frame = inGroup.get(b.group)
    if (!frame) {
      frame = {
        id: groupKey(b.group),
        children: [],
        layoutOptions: {
          'elk.padding': `[top=${FRAME_PAD.top},left=${FRAME_PAD.left},bottom=${FRAME_PAD.bottom},right=${FRAME_PAD.right}]`
        }
      }
      inGroup.set(b.group, frame)
      children.push(frame)
    }
    frame.children?.push(leaf)
  }
  const edges = input.links
    .filter((l) => l.from !== l.to && present.has(l.from) && present.has(l.to))
    .map((l, i) => ({ id: `e${i}`, sources: [nodeKey(l.from)], targets: [nodeKey(l.to)] }))
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      // Default is 7. 2 keeps the layout readable and takes about half the time of the default for 200 blocks.
      'elk.layered.thoroughness': '2',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': String(LAYOUT_SPACING.node),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(LAYOUT_SPACING.layer),
      'elk.spacing.componentComponent': String(LAYOUT_SPACING.node * 2)
    },
    children,
    edges
  }
}

export type Placed = Map<number, { x: number; y: number }>

/** Absolute top left corner of every block in the ELK result. The origin is the ELK origin. */
export function readElkResult(result: ElkNode): Placed {
  const out: Placed = new Map()
  const walk = (node: ElkNode, ox: number, oy: number) => {
    for (const child of node.children ?? []) {
      const x = ox + (child.x ?? 0)
      const y = oy + (child.y ?? 0)
      if (child.id.startsWith('n')) out.set(Number(child.id.slice(1)), { x, y })
      else walk(child, x, y)
    }
  }
  walk(result, 0, 0)
  return out
}

/** Lays the blocks out. Positions are relative to the top left of the result. */
export async function computeLayout(elk: ElkLike, input: LayoutInput): Promise<Placed> {
  if (input.blocks.length === 0) return new Map()
  const placed = readElkResult(await elk.layout(buildElkGraph(input)))
  let minX = Infinity
  let minY = Infinity
  for (const p of placed.values()) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
  }
  // ELK counts the padding of a group inside its frame, so a lone group starts at its padding.
  const out: Placed = new Map()
  for (const [id, p] of placed) out.set(id, { x: p.x - minX, y: p.y - minY })
  return out
}

export interface LayoutMove {
  id: number
  x: number
  y: number
}

/** Moves the result so that its top left corner is at `anchor`, snapped to whole pixels. */
export function placeAt(placed: Placed, anchor: { x: number; y: number }): LayoutMove[] {
  return [...placed].map(([id, p]) => ({
    id,
    x: Math.round(anchor.x + p.x),
    y: Math.round(anchor.y + p.y)
  }))
}

/** Rectangle around some rectangles, null when there are none. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const r of rects) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** Gap kept between the fixed blocks and a cluster of new blocks laid out beside them. */
export const PENDING_GAP = 96

/**
 * Where a cluster of new blocks goes: below everything that is already placed, with the left edge
 * of the placed blocks. Nothing overlaps because the cluster starts under the lowest block and its
 * frame padding. With no placed block the cluster starts at the origin.
 */
export function pendingAnchor(fixed: readonly Rect[]): { x: number; y: number } {
  const box = unionRect(fixed)
  if (!box) return { x: 0, y: 0 }
  return { x: box.x, y: box.y + box.h + PENDING_GAP }
}
