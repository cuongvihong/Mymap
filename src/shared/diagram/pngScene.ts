import { connect, parallelOffset, type Point, type Rect } from './geometry'
import { groupByPair } from './channels'
import { FRAME_PAD, frameBounds } from './frames'
import type { LinkData, NodeData, NodeType, ViaType } from './types'

/**
 * The whole map as a list of drawing commands (FR-YM-08). Pure: text is measured by a function the
 * caller gives, colours come in a theme object, so the renderer paints the list on a canvas and
 * tests read the list. Collapsed groups are drawn open, because the picture is the whole map.
 */

export interface PngTheme {
  background: string
  frameStroke: string
  frameText: string
  blockFill: string
  blockStroke: string
  ink: string
  muted: string
  type: Record<NodeType, string>
  via: Record<ViaType, string>
  fontUi: string
  fontMono: string
}

export type DrawOp =
  | {
      kind: 'rect'
      rect: Rect
      radius: number
      fill: string | null
      stroke: string | null
      dash?: readonly number[]
      width?: number
    }
  | {
      kind: 'text'
      x: number
      y: number
      text: string
      font: string
      color: string
    }
  | {
      kind: 'curve'
      p1: Point
      c1: Point
      c2: Point
      p2: Point
      color: string
      width: number
    }
  | { kind: 'arrow'; tip: Point; from: Point; color: string; size: number }

export interface PngScene {
  /** Size of the picture in world units. */
  width: number
  height: number
  /** World coordinates of the top left corner of the picture. */
  origin: { x: number; y: number }
  ops: DrawOp[]
}

export type Measure = (text: string, font: string) => number

export interface SceneInput {
  nodes: readonly NodeData[]
  groups: readonly { id: number; title: string; frame: Rect | null }[]
  links: readonly Pick<LinkData, 'id' | 'fromNode' | 'toNode' | 'via' | 'sortOrder'>[]
  rectOf(node: NodeData): Rect
  theme: PngTheme
  measure: Measure
}

export const PNG_MARGIN = 48
const PAD = 12
const LINE = 17

/** Wraps text to a width. Breaks at spaces, a word longer than the line is cut. At most `maxLines`. */
export function wrapText(
  text: string,
  maxWidth: number,
  font: string,
  measure: Measure,
  maxLines: number
): string[] {
  const lines: string[] = []
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  let current = ''
  let cut = false
  for (let word of words) {
    if (word === '') continue
    while (measure(word, font) > maxWidth && word.length > 1) {
      // Cut a long word to what fits.
      let n = word.length - 1
      while (n > 1 && measure(word.slice(0, n), font) > maxWidth) n--
      if (current !== '') {
        lines.push(current)
        current = ''
      }
      lines.push(word.slice(0, n))
      word = word.slice(n)
    }
    const next = current === '' ? word : `${current} ${word}`
    if (measure(next, font) <= maxWidth) current = next
    else {
      lines.push(current)
      current = word
    }
  }
  if (current !== '') lines.push(current)
  if (lines.length > maxLines) {
    cut = true
    lines.length = maxLines
  }
  if (cut && lines.length > 0) {
    let last = lines[lines.length - 1] as string
    while (last.length > 1 && measure(`${last}…`, font) > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last}…`
  }
  return lines
}

export function buildPngScene(input: SceneInput): PngScene {
  const { theme, measure } = input
  const rects = new Map(input.nodes.map((n) => [n.id, input.rectOf(n)]))
  const ops: DrawOp[] = []
  const all: Rect[] = [...rects.values()]

  // Group frames, behind everything.
  const frames: { title: string; rect: Rect }[] = []
  for (const g of input.groups) {
    const members = input.nodes
      .filter((n) => n.groupId === g.id)
      .map((n) => rects.get(n.id) as Rect)
    const rect = frameBounds(members) ?? g.frame
    if (rect) frames.push({ title: g.title, rect })
  }
  for (const f of frames) {
    all.push(f.rect)
    ops.push({
      kind: 'rect',
      rect: f.rect,
      radius: 14,
      fill: null,
      stroke: theme.frameStroke,
      dash: [6, 5],
      width: 1.5
    })
    ops.push({
      kind: 'text',
      x: f.rect.x + FRAME_PAD.left - 6,
      y: f.rect.y + 22,
      text: f.title,
      font: `600 13px ${theme.fontUi}`,
      color: theme.frameText
    })
  }

  // Channels.
  const pairs = groupByPair(
    input.links.map((l) => ({ ...l })),
    (id) => String(id)
  )
  for (const pair of pairs) {
    const a = rects.get(Number(pair.a))
    const b = rects.get(Number(pair.b))
    if (!a || !b) continue
    pair.links.forEach((link, i) => {
      const forward = link.fromNode === Number(pair.a)
      const from = forward ? a : b
      const to = forward ? b : a
      const offset = parallelOffset(i, pair.links.length)
      const c = connect(from, to, forward ? offset : -offset)
      const color = theme.via[link.via]
      ops.push({ kind: 'curve', p1: c.p1, c1: c.c1, c2: c.c2, p2: c.p2, color, width: 1.6 })
      ops.push({ kind: 'arrow', tip: c.p2, from: c.c2, color, size: 8 })
    })
  }

  // Blocks.
  for (const n of input.nodes) {
    const r = rects.get(n.id) as Rect
    const color = theme.type[n.type]
    ops.push({
      kind: 'rect',
      rect: r,
      radius: 10,
      fill: theme.blockFill,
      stroke: theme.blockStroke,
      width: 1
    })
    ops.push({
      kind: 'rect',
      rect: { x: r.x, y: r.y + 6, w: 4, h: r.h - 12 },
      radius: 2,
      fill: color,
      stroke: null
    })
    const inner = r.w - PAD * 2 - 4
    const left = r.x + PAD + 4
    let y = r.y + PAD + 11
    const maxY = r.y + r.h - 8
    ops.push({
      kind: 'text',
      x: left,
      y,
      text: n.code,
      font: `500 10.5px ${theme.fontMono}`,
      color: theme.muted
    })
    y += LINE + 1
    const titleFont = `600 13px ${theme.fontUi}`
    for (const line of wrapText(n.title, inner, titleFont, measure, 2)) {
      if (y > maxY) break
      ops.push({ kind: 'text', x: left, y, text: line, font: titleFont, color: theme.ink })
      y += LINE
    }
    const bodyFont = `400 11.5px ${theme.fontUi}`
    const bodyRoom = Math.max(0, Math.floor((maxY - y) / LINE) - (n.fixText ? 1 : 0))
    if (n.body !== '' && bodyRoom > 0) {
      for (const line of wrapText(n.body, inner, bodyFont, measure, Math.min(bodyRoom, 6))) {
        ops.push({ kind: 'text', x: left, y, text: line, font: bodyFont, color: theme.muted })
        y += LINE
      }
    }
    if (n.fixText !== '' && y <= maxY) {
      const line = wrapText(`Nơi sửa: ${n.fixText}`, inner, bodyFont, measure, 1)[0]
      if (line) ops.push({ kind: 'text', x: left, y, text: line, font: bodyFont, color: theme.ink })
    }
  }

  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const r of all) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }
  if (!Number.isFinite(x1)) {
    return { width: 1, height: 1, origin: { x: 0, y: 0 }, ops: [] }
  }
  return {
    width: Math.ceil(x2 - x1 + PNG_MARGIN * 2),
    height: Math.ceil(y2 - y1 + PNG_MARGIN * 2),
    origin: { x: x1 - PNG_MARGIN, y: y1 - PNG_MARGIN },
    ops
  }
}

/** Pixel scale so that the picture stays below 8000 px a side and 36 million pixels, at most 2. */
export function pngScale(width: number, height: number): number {
  const bySide = 8000 / Math.max(width, height, 1)
  const byArea = Math.sqrt(36_000_000 / Math.max(width * height, 1))
  return Math.min(2, bySide, byArea)
}
