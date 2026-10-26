import { frameBounds } from './frames'
import { chooseOrientation, type Rect } from './geometry'
import type { NodeType, ViaType } from './types'

/**
 * JSON Canvas 1.0 (FR-YM-07, TDD 6.8): groups become `group` nodes, blocks `text` nodes with
 * Markdown, channels edges labelled "via: label" and coloured by kind. Needs coordinates.
 */

/** Colours of the dark theme (TDD 9.2) as hex, because JSON Canvas takes `#rrggbb`. */
export const TYPE_HEX: Record<NodeType, string> = {
  fnc: '#378add',
  req: '#7f77dd',
  tech: '#8f939c',
  ext: '#d85a30',
  start: '#ff6c37',
  end: '#4f9a2a',
  cond: '#d4537e',
  note: '#c9b458'
}

export const VIA_HEX: Record<ViaType, string> = {
  impl: '#b5a642',
  rest: '#378add',
  webhook: '#d85a30',
  db: '#8f939c',
  ui: '#1d9e75',
  call: '#8b7fe0',
  redirect: '#d4537e',
  job: '#c08a1e',
  event: '#e07b39',
  queue: '#9b6fe0',
  file: '#9c7a54'
}

export interface CanvasBlock {
  id: string
  type: NodeType
  code: string
  title: string
  body: string
  fix: string
  chips: readonly string[]
  rect: Rect
}

export interface CanvasInput {
  groups: { id: string; title: string; members: readonly string[]; fallback?: Rect }[]
  blocks: readonly CanvasBlock[]
  links: { id: string; from: string; to: string; via: ViaType; label: string }[]
}

export interface JsonCanvasNode {
  id: string
  type: 'text' | 'group'
  x: number
  y: number
  width: number
  height: number
  text?: string
  label?: string
  color?: string
}

export interface JsonCanvasEdge {
  id: string
  fromNode: string
  toNode: string
  fromSide: 'top' | 'right' | 'bottom' | 'left'
  toSide: 'top' | 'right' | 'bottom' | 'left'
  toEnd: 'arrow'
  label: string
  color: string
}

export interface JsonCanvas {
  nodes: JsonCanvasNode[]
  edges: JsonCanvasEdge[]
}

/**
 * Height of a block before it has been measured on screen. Counts the wrapped lines of the head,
 * the body and the "Nơi sửa" line, as the block draws them at its width.
 */
export function estimateBlockHeight(block: {
  type: NodeType
  title: string
  body: string
  fix: string
  chips: readonly string[]
}): number {
  const lines = (text: string, perLine: number) =>
    text === '' ? 0 : Math.max(1, Math.ceil([...text].length / perLine))
  const small =
    block.type === 'start' || block.type === 'end' || block.type === 'ext' || block.type === 'tech'
  const per = small ? 26 : 32
  const rows =
    lines(block.title, per - 6) +
    lines(block.body, per + 4) +
    lines(block.fix === '' ? '' : `Nơi sửa: ${block.fix}`, per + 4) +
    (block.chips.length > 0 ? 1 : 0)
  return Math.round(52 + rows * 17)
}

const side = (dx: number, dy: number, horizontal: boolean) =>
  horizontal ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'

const OPPOSITE = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' } as const

/** Markdown of a block: code and title, the body, then the lines that exist. */
export function blockMarkdown(b: CanvasBlock): string {
  const parts = [`**${b.code}** · ${b.title}`]
  if (b.body !== '') parts.push(b.body)
  if (b.fix !== '') parts.push(`*Nơi sửa:* ${b.fix}`)
  if (b.chips.length > 0) parts.push(b.chips.map((c) => `\`${c}\``).join(' '))
  return parts.join('\n\n')
}

export function toJsonCanvas(input: CanvasInput): JsonCanvas {
  const byId = new Map(input.blocks.map((b) => [b.id, b]))
  const nodes: JsonCanvasNode[] = []
  for (const g of input.groups) {
    const rects = g.members.map((id) => byId.get(id)?.rect).filter((r): r is Rect => !!r)
    const frame = frameBounds(rects) ?? g.fallback
    if (!frame) continue
    nodes.push({
      id: `g-${g.id}`,
      type: 'group',
      x: Math.round(frame.x),
      y: Math.round(frame.y),
      width: Math.round(frame.w),
      height: Math.round(frame.h),
      label: g.title
    })
  }
  for (const b of input.blocks) {
    nodes.push({
      id: `n-${b.id}`,
      type: 'text',
      text: blockMarkdown(b),
      x: Math.round(b.rect.x),
      y: Math.round(b.rect.y),
      width: Math.round(b.rect.w),
      height: Math.round(b.rect.h),
      color: TYPE_HEX[b.type]
    })
  }
  const edges: JsonCanvasEdge[] = []
  for (const l of input.links) {
    const a = byId.get(l.from)
    const b = byId.get(l.to)
    if (!a || !b) continue
    const horizontal = chooseOrientation(a.rect, b.rect) === 'horizontal'
    const dx = b.rect.x + b.rect.w / 2 - (a.rect.x + a.rect.w / 2)
    const dy = b.rect.y + b.rect.h / 2 - (a.rect.y + a.rect.h / 2)
    const fromSide = side(dx, dy, horizontal)
    edges.push({
      id: `e-${l.id}`,
      fromNode: `n-${l.from}`,
      toNode: `n-${l.to}`,
      fromSide,
      toSide: OPPOSITE[fromSide],
      toEnd: 'arrow',
      label: l.label === '' ? l.via : `${l.via}: ${l.label}`,
      color: VIA_HEX[l.via]
    })
  }
  return { nodes, edges }
}
