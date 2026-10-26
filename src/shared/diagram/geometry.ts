export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type Point = readonly [number, number]

/** Distance between neighbouring parallel wires, in px (TDD 8.3). */
export const PARALLEL_STEP = 12
/** The horizontal rule: |dx| greater than this times |dy| (TDD 8.3). */
export const HORIZONTAL_RATIO = 0.55
/** Keeps a side anchor away from the corners of the block. */
const CORNER_MARGIN = 14

export type Orientation = 'horizontal' | 'vertical'

export interface Connection {
  orientation: Orientation
  /** Start point on the edge of block a, end point on the edge of block b. */
  p1: Point
  p2: Point
  /** Bezier control points. */
  c1: Point
  c2: Point
  /** SVG path data of the cubic bezier. */
  d: string
  /** Point at t = 0.5, where the badge of a channel sits. */
  mid: Point
}

const centre = (r: Rect): Point => [r.x + r.w / 2, r.y + r.h / 2]

/**
 * Offset of wire `index` among `count` wires of the same pair, perpendicular to the wire:
 * (i - (n - 1) / 2) * 12. A single wire has offset 0.
 */
export function parallelOffset(index: number, count: number): number {
  const value = (index - (count - 1) / 2) * PARALLEL_STEP
  return value === 0 ? 0 : value
}

/**
 * Which pair of edges to join. Horizontal pairs use the left and right edges, vertically stacked
 * pairs use top and bottom. Same rule as the approved demo: |dx| > 0.55 |dy|, or the centres are
 * further apart than 0.9 of the width of a.
 */
export function chooseOrientation(a: Rect, b: Rect): Orientation {
  const [ax, ay] = centre(a)
  const [bx, by] = centre(b)
  const dx = Math.abs(bx - ax)
  const dy = Math.abs(by - ay)
  return dx > dy * HORIZONTAL_RATIO || dx > a.w * 0.9 ? 'horizontal' : 'vertical'
}

/** Point on the cubic bezier at parameter t. */
export function bezierPoint(p1: Point, c1: Point, c2: Point, p2: Point, t: number): Point {
  const u = 1 - t
  return [
    u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
    u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]
  ]
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The wire from block a to block b, shifted by `offset` px across its direction. */
export function connect(a: Rect, b: Rect, offset = 0): Connection {
  const [ax, ay] = centre(a)
  const [bx, by] = centre(b)
  const orientation = chooseOrientation(a, b)
  let p1: Point
  let p2: Point
  let c1: Point
  let c2: Point
  if (orientation === 'horizontal') {
    const s = bx - ax >= 0 ? 1 : -1
    const y1 = clamp(ay + offset, a.y + CORNER_MARGIN, a.y + a.h - CORNER_MARGIN)
    const y2 = clamp(by + offset, b.y + CORNER_MARGIN, b.y + b.h - CORNER_MARGIN)
    p1 = [s > 0 ? a.x + a.w : a.x, y1]
    p2 = [s > 0 ? b.x : b.x + b.w, y2]
    const k = Math.max(50, Math.abs(p2[0] - p1[0]) * 0.45)
    c1 = [p1[0] + s * k, p1[1]]
    c2 = [p2[0] - s * k, p2[1]]
  } else {
    const s = by - ay >= 0 ? 1 : -1
    p1 = [ax + offset, s > 0 ? a.y + a.h : a.y]
    p2 = [bx + offset, s > 0 ? b.y : b.y + b.h]
    const k = Math.max(40, Math.abs(p2[1] - p1[1]) * 0.45)
    c1 = [p1[0], p1[1] + s * k]
    c2 = [p2[0], p2[1] - s * k]
  }
  const d = `M${p1[0]} ${p1[1]}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`
  return { orientation, p1, p2, c1, c2, d, mid: bezierPoint(p1, c1, c2, p2, 0.5) }
}

/** Cell size of the temporary grid for blocks without coordinates (BR-04). */
export const GRID_CELL = { w: 300, h: 200 } as const

/**
 * Positions for `count` new blocks on a 300 x 200 grid, filled row by row from `origin`.
 * These are placeholders: the caller keeps has_layout = 0 so auto layout can move them later.
 */
export function gridPositions(
  count: number,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  columns = 6
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    out.push({
      x: origin.x + (i % columns) * GRID_CELL.w,
      y: origin.y + Math.floor(i / columns) * GRID_CELL.h
    })
  }
  return out
}
