import type { Rect } from './geometry'
import type { NodeType } from './types'

/** Space between the members of a group and its dashed frame, from the approved demo. */
export const FRAME_PAD = { left: 26, top: 34, right: 26, bottom: 24 } as const

/** Fallback height of a block that React Flow has not measured yet. */
export const DEFAULT_BLOCK_HEIGHT = 130

export const BLOCK_WIDTH = 250
export const BLOCK_WIDTH_SMALL = 210
/** Collapsed group tile (FR-NH-03). */
export const TILE_SIZE = { w: 250, h: 64 } as const

const SMALL_TYPES: ReadonlySet<NodeType> = new Set(['start', 'end', 'ext', 'tech'])

/** The demo draws start, end, external and tech blocks narrower than function blocks. */
export function blockWidth(type: NodeType): number {
  return SMALL_TYPES.has(type) ? BLOCK_WIDTH_SMALL : BLOCK_WIDTH
}

/** Smallest rectangle around the member rectangles plus the padding. Null for an empty group. */
export function frameBounds(members: readonly Rect[]): Rect | null {
  if (members.length === 0) return null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const r of members) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }
  x1 -= FRAME_PAD.left
  y1 -= FRAME_PAD.top
  x2 += FRAME_PAD.right
  y2 += FRAME_PAD.bottom
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export const centreOf = (r: Rect): { x: number; y: number } => ({
  x: r.x + r.w / 2,
  y: r.y + r.h / 2
})

export function contains(r: Rect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
}

export interface FrameRect<Id> {
  id: Id
  rect: Rect
}

/** How far outside a frame a block may be dropped and still join it, in world units. */
export const DROP_SLOP = 40

function smallest<Id>(frames: readonly FrameRect<Id>[], hit: (r: Rect) => boolean): Id | null {
  let best: FrameRect<Id> | null = null
  for (const f of frames) {
    if (!hit(f.rect)) continue
    if (!best || f.rect.w * f.rect.h < best.rect.w * best.rect.h) best = f
  }
  return best ? best.id : null
}

/**
 * The group a dragged block belongs to after the drop (FR-NH-02): the smallest frame that contains
 * the centre of the block, or null when it is dropped on the bare canvas. A frame shrinks when a
 * block leaves it, so the place the block came from may fall just outside; `slop` forgives that.
 */
export function dropTarget<Id>(
  block: Rect,
  frames: readonly FrameRect<Id>[],
  slop = DROP_SLOP
): Id | null {
  const c = centreOf(block)
  const strict = smallest(frames, (r) => contains(r, c))
  if (strict !== null) return strict
  return smallest(frames, (r) =>
    contains({ x: r.x - slop, y: r.y - slop, w: r.w + 2 * slop, h: r.h + 2 * slop }, c)
  )
}

/** Box that covers every rectangle, used by "Vừa màn hình". Null when there is nothing to show. */
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
