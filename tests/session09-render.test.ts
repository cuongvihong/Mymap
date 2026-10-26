import { describe, expect, it } from 'vitest'
import {
  buildPngScene,
  PNG_MARGIN,
  pngScale,
  wrapText,
  type PngTheme
} from '../src/shared/diagram/pngScene'
import { highlightLine } from '../src/shared/diagram/yamlHighlight'
import type { NodeData, NodeType, ViaType } from '../src/shared/diagram/types'

const measure = (text: string) => text.length * 7

const theme: PngTheme = {
  background: '#111',
  frameStroke: '#444',
  frameText: '#aaa',
  blockFill: '#222',
  blockStroke: '#555',
  ink: '#eee',
  muted: '#999',
  type: Object.fromEntries(
    ['fnc', 'req', 'tech', 'ext', 'start', 'end', 'cond', 'note'].map((k) => [k, '#08f'])
  ) as Record<NodeType, string>,
  via: Object.fromEntries(
    [
      'impl',
      'rest',
      'webhook',
      'db',
      'ui',
      'call',
      'redirect',
      'job',
      'event',
      'queue',
      'file'
    ].map((k) => [k, '#f80'])
  ) as Record<ViaType, string>,
  fontUi: 'sans-serif',
  fontMono: 'monospace'
}

const node = (id: number, x: number, y: number, over: Partial<NodeData> = {}): NodeData => ({
  id,
  key: `N${id}`,
  type: 'fnc',
  subtype: null,
  code: `N${id}`,
  title: `Khối số ${id}`,
  body: 'Nội dung của khối này đủ dài để phải xuống dòng nhiều lần trong khung.',
  fixText: 'src/a.ts',
  chips: [],
  fsFile: null,
  fsSection: null,
  groupId: null,
  x,
  y,
  hasLayout: true,
  collapsed: false,
  ...over
})

describe('highlightLine (FR-YM-05)', () => {
  const kinds = (line: string) => highlightLine(line).map((t) => `${t.kind}:${t.text}`)

  it('colours comment, key, string and number', () => {
    expect(kinds('# ghi chú')).toEqual(['comment:# ghi chú'])
    expect(kinds('  title: "Đăng nhập"')).toEqual([
      'plain:  ',
      'key:title',
      'punct::',
      'plain: ',
      'string:"Đăng nhập"'
    ])
    expect(kinds('x: 120')).toContain('number: 120')
  })

  it('marks list dashes and keeps every character', () => {
    const line = '  - id: A1 # sau'
    const tokens = highlightLine(line)
    expect(tokens.map((t) => t.text).join('')).toBe(line)
    expect(tokens.some((t) => t.kind === 'dash')).toBe(true)
    expect(tokens.at(-1)?.kind).toBe('comment')
  })

  it('does not treat a hash inside quotes as a comment', () => {
    const tokens = highlightLine('body: "mã #12"')
    expect(tokens.some((t) => t.kind === 'comment')).toBe(false)
  })

  it('returns text unchanged for any line', () => {
    for (const line of ['', '   ', 'a: b: c', '- - x', 'url: http://a/b#c', "k: 'it''s'"]) {
      expect(
        highlightLine(line)
          .map((t) => t.text)
          .join('')
      ).toBe(line)
    }
  })
})

describe('PNG scene (FR-YM-04)', () => {
  it('wraps text to the width and cuts with an ellipsis', () => {
    const lines = wrapText('một hai ba bốn năm sáu bảy tám chín mười', 70, 'f', measure, 2)
    expect(lines.length).toBe(2)
    expect(lines[1]?.endsWith('…')).toBe(true)
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(70)
  })

  it('cuts a word that is longer than the line', () => {
    const lines = wrapText('abcdefghijklmnopqrstuvwxyz', 70, 'f', measure, 5)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe('abcdefghijklmnopqrstuvwxyz')
  })

  const rectOf = (n: NodeData) => ({ x: n.x, y: n.y, w: 250, h: 130 })

  it('covers every block and every frame with the margin', () => {
    const nodes = [
      node(1, 0, 0, { groupId: 1 }),
      node(2, 600, 400, { groupId: 1 }),
      node(3, -300, 900)
    ]
    const scene = buildPngScene({
      nodes,
      groups: [{ id: 1, title: 'Nhóm', frame: null }],
      links: [{ id: 1, fromNode: 1, toNode: 2, via: 'rest', sortOrder: 1 }],
      rectOf,
      theme,
      measure
    })
    // x from -300 to 850, y from 0 to 1030.
    expect(scene.origin.x).toBeLessThanOrEqual(-300 - PNG_MARGIN)
    expect(scene.origin.y).toBeLessThanOrEqual(0 - PNG_MARGIN)
    expect(scene.width).toBeGreaterThanOrEqual(1150 + PNG_MARGIN * 2)
    expect(scene.height).toBeGreaterThanOrEqual(1030 + PNG_MARGIN * 2)
    const kinds = new Set(scene.ops.map((o) => o.kind))
    expect(kinds).toEqual(new Set(['rect', 'text', 'curve', 'arrow']))
    const texts = scene.ops
      .filter((o) => o.kind === 'text')
      .map((o) => (o as { text: string }).text)
    expect(texts).toContain('Nhóm')
    expect(texts).toContain('N3')
  })

  it('draws one curve per channel, also the parallel ones', () => {
    const nodes = [node(1, 0, 0), node(2, 500, 0)]
    const scene = buildPngScene({
      nodes,
      groups: [],
      links: [
        { id: 1, fromNode: 1, toNode: 2, via: 'rest', sortOrder: 1 },
        { id: 2, fromNode: 2, toNode: 1, via: 'db', sortOrder: 2 },
        { id: 3, fromNode: 1, toNode: 2, via: 'call', sortOrder: 3 }
      ],
      rectOf,
      theme,
      measure
    })
    expect(scene.ops.filter((o) => o.kind === 'curve').length).toBe(3)
    expect(scene.ops.filter((o) => o.kind === 'arrow').length).toBe(3)
  })

  it('gives a 1 by 1 picture for an empty map', () => {
    const scene = buildPngScene({ nodes: [], groups: [], links: [], rectOf, theme, measure })
    expect(scene).toMatchObject({ width: 1, height: 1, ops: [] })
  })

  it('keeps the picture under 8000 px a side, 36 megapixels and scale 2', () => {
    expect(pngScale(1000, 800)).toBe(2)
    expect(pngScale(20000, 1000) * 20000).toBeLessThanOrEqual(8000.001)
    const s = pngScale(9000, 9000)
    expect(9000 * s * 9000 * s).toBeLessThanOrEqual(36_000_001)
    expect(pngScale(0, 0)).toBe(2)
  })
})
