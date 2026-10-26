import type { Rect } from './geometry'

export const GRID = 16
/** How close an edge must be to another block's edge to snap to it, in world units. */
export const GUIDE_SNAP = 6

export const snapGrid = (v: number, grid = GRID): number => Math.round(v / grid) * grid

export interface Box extends Rect {
  id: number
}
export interface Move {
  id: number
  x: number
  y: number
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'bottom'
export type DistributeAxis = 'horizontal' | 'vertical'

function bounds(boxes: readonly Rect[]): Rect {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const b of boxes) {
    x1 = Math.min(x1, b.x)
    y1 = Math.min(y1, b.y)
    x2 = Math.max(x2, b.x + b.w)
    y2 = Math.max(y2, b.y + b.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** Lines the blocks up to the edge or the centre of the whole selection. Blocks already in place are left out. */
export function alignMoves(boxes: readonly Box[], mode: AlignMode): Move[] {
  if (boxes.length < 2) return []
  const b = bounds(boxes)
  const out: Move[] = []
  for (const box of boxes) {
    let x = box.x
    let y = box.y
    if (mode === 'left') x = b.x
    else if (mode === 'right') x = b.x + b.w - box.w
    else if (mode === 'center') x = b.x + b.w / 2 - box.w / 2
    else if (mode === 'top') y = b.y
    else y = b.y + b.h - box.h
    if (x !== box.x || y !== box.y) out.push({ id: box.id, x, y })
  }
  return out
}

/**
 * Equal gaps between the blocks along one axis. The first and the last block stay, the ones in
 * between move. Needs at least three blocks.
 */
export function distributeMoves(boxes: readonly Box[], axis: DistributeAxis): Move[] {
  if (boxes.length < 3) return []
  const horizontal = axis === 'horizontal'
  const sorted = [...boxes].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y))
  const first = sorted[0] as Box
  const last = sorted[sorted.length - 1] as Box
  const size = (b: Box) => (horizontal ? b.w : b.h)
  const start = horizontal ? first.x : first.y
  const end = horizontal ? last.x + last.w : last.y + last.h
  const total = sorted.reduce((sum, b) => sum + size(b), 0)
  const gap = (end - start - total) / (sorted.length - 1)
  const out: Move[] = []
  let cursor = start + size(first) + gap
  for (const box of sorted.slice(1, -1)) {
    const x = horizontal ? cursor : box.x
    const y = horizontal ? box.y : cursor
    if (x !== box.x || y !== box.y) out.push({ id: box.id, x, y })
    cursor += size(box) + gap
  }
  return out
}

export interface Guide {
  axis: 'x' | 'y'
  /** Coordinate of the line on its own axis. */
  at: number
  /** Extent along the other axis. */
  from: number
  to: number
}

export interface SnapResult {
  dx: number
  dy: number
  guides: Guide[]
}

/** The three lines of a rectangle along one axis: start, middle, end. */
function lines(r: Rect, axis: 'x' | 'y'): number[] {
  return axis === 'x' ? [r.x, r.x + r.w / 2, r.x + r.w] : [r.y, r.y + r.h / 2, r.y + r.h]
}

function snapAxis(
  moving: Rect,
  others: readonly Rect[],
  axis: 'x' | 'y',
  threshold: number
): number {
  let best: number | null = null
  for (const o of others) {
    for (const a of lines(moving, axis)) {
      for (const b of lines(o, axis)) {
        const d = b - a
        if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d
      }
    }
  }
  if (best !== null) return best
  const start = axis === 'x' ? moving.x : moving.y
  return snapGrid(start) - start
}

/**
 * Snap for a dragged group of blocks (FR-SUA-03). `moving` is the rectangle around everything that
 * is being dragged. Edges and centres snap to the other blocks when closer than `threshold`,
 * otherwise the top left corner snaps to the 16 px grid. Guides are returned for every line that
 * ends up aligned with another block.
 */
export function snapDrag(
  moving: Rect,
  others: readonly Rect[],
  threshold: number = GUIDE_SNAP
): SnapResult {
  const dx = snapAxis(moving, others, 'x', threshold)
  const dy = snapAxis(moving, others, 'y', threshold)
  const next: Rect = { x: moving.x + dx, y: moving.y + dy, w: moving.w, h: moving.h }
  const guides: Guide[] = []
  for (const axis of ['x', 'y'] as const) {
    for (const o of others) {
      for (const a of lines(next, axis)) {
        for (const b of lines(o, axis)) {
          if (Math.abs(a - b) > 0.5) continue
          const from = axis === 'x' ? Math.min(next.y, o.y) : Math.min(next.x, o.x)
          const to =
            axis === 'x'
              ? Math.max(next.y + next.h, o.y + o.h)
              : Math.max(next.x + next.w, o.x + o.w)
          guides.push({ axis, at: b, from, to })
        }
      }
    }
  }
  return { dx, dy, guides }
}

export { bounds as boundsOf }
