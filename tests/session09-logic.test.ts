import ELK from 'elkjs/lib/elk.bundled.js'
import { describe, expect, it } from 'vitest'
import {
  computeLayout,
  pendingAnchor,
  placeAt,
  type LayoutBlock
} from '../src/shared/diagram/autolayout'
import { frameBounds, blockWidth } from '../src/shared/diagram/frames'
import type { Rect } from '../src/shared/diagram/geometry'
import { estimateBlockHeight, toJsonCanvas, VIA_HEX } from '../src/shared/diagram/jsoncanvas'
import { docToMermaid, looksLikeMermaid, parseMermaid } from '../src/shared/diagram/mermaid'
import type { FlowmapDoc } from '../src/shared/diagram/types'
import { sampleDoc } from './helpers/sample'

const elk = new ELK()

describe('Mermaid import', () => {
  it('reads every node shape, the edge forms and their labels', () => {
    const { doc, warnings } = parseMermaid(
      [
        '%% a comment',
        'flowchart LR',
        '  A([Bắt đầu]) --> B[Kiểm tra]',
        '  B -->|đủ tiền| C(Trả bằng EA)',
        '  B -- không đủ --> D{Chia đôi?}',
        '  C -.-> E[(Sổ cái)]',
        '  D ==> F([Xong])',
        '  C --- F'
      ].join('\n')
    )
    expect(doc).not.toBeNull()
    const d = doc as FlowmapDoc
    expect(d.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    const type = (id: string) => d.nodes.find((n) => n.id === id)
    expect(type('A')?.type).toBe('start')
    expect(type('B')?.type).toBe('fnc')
    expect(type('C')?.type).toBe('fnc')
    expect(type('D')?.type).toBe('cond')
    expect(type('F')?.type).toBe('end')
    expect(type('F')?.subtype).toBe('ok')
    expect(type('B')?.title).toBe('Kiểm tra')
    expect(d.links).toHaveLength(6)
    expect(d.links.find((l) => l.from === 'B' && l.to === 'C')?.label).toBe('đủ tiền')
    expect(d.links.find((l) => l.from === 'B' && l.to === 'D')?.label).toBe('không đủ')
    expect(d.links.find((l) => l.from === 'C' && l.to === 'E')?.via).toBe('db')
    expect(d.links.find((l) => l.from === 'B' && l.to === 'C')?.via).toBe('call')
    // [(Sổ cái)] is a shape the subset does not have, so it is a plain block and a warning.
    expect(warnings.map((w) => w.line)).toEqual([6])
  })

  it('reads chains, subgraphs and puts blocks in their group', () => {
    const { doc } = parseMermaid(
      [
        'graph TD',
        'subgraph G1 [Nhóm một]',
        '  A --> B --> C',
        'end',
        'subgraph Nhóm hai',
        '  D',
        'end',
        'C --> D'
      ].join('\n')
    )
    const d = doc as FlowmapDoc
    expect(d.groups.map((g) => [g.id, g.title])).toEqual([
      ['G1', 'Nhóm một'],
      ['G2', 'Nhóm hai']
    ])
    expect(d.nodes.map((n) => [n.id, n.group])).toEqual([
      ['A', 'G1'],
      ['B', 'G1'],
      ['C', 'G1'],
      ['D', 'G2']
    ])
    expect(d.links.map((l) => `${l.from}>${l.to}`)).toEqual(['A>B', 'B>C', 'C>D'])
  })

  it('skips lines it does not support and names the line', () => {
    const { doc, warnings } = parseMermaid(
      ['flowchart LR', 'classDef big fill:#f00', 'A --> B', 'style A fill:#f9f', 'A ~~~~ B'].join(
        '\n'
      )
    )
    expect((doc as FlowmapDoc).links).toHaveLength(1)
    expect(warnings.map((w) => w.line)).toEqual([2, 4, 5])
  })

  it('reports a file that is not a flowchart', () => {
    const r = parseMermaid('sequenceDiagram\nA->>B: hi')
    expect(r.doc).toBeNull()
    expect(r.warnings).toHaveLength(1)
    expect(looksLikeMermaid('%% x\nflowchart TD\nA-->B')).toBe(true)
    expect(looksLikeMermaid('flowmap: 1\nproject: x')).toBe(false)
  })

  it('makes ids that BR-01 accepts', () => {
    const { doc } = parseMermaid('flowchart LR\nCổng1 --> Cổng2')
    for (const n of (doc as FlowmapDoc).nodes) expect(n.id).toMatch(/^[A-Za-z0-9._-]+$/)
  })

  it('export then import keeps the number of blocks, channels and groups', () => {
    const source = sampleDoc()
    const text = docToMermaid(source)
    expect(text.startsWith('flowchart LR\n')).toBe(true)
    const again = parseMermaid(text)
    expect(again.warnings).toEqual([])
    const d = again.doc as FlowmapDoc
    expect(d.nodes).toHaveLength(source.nodes.length)
    expect(d.links).toHaveLength(source.links.length)
    expect(d.groups).toHaveLength(source.groups.length)
    // channels of kind db keep a dotted arrow
    const dbIn = source.links.filter((l) => l.via === 'db').length
    expect(d.links.filter((l) => l.via === 'db')).toHaveLength(dbIn)
  })
})

describe('JSON Canvas', () => {
  const doc = sampleDoc()
  const blocks = doc.nodes.map((n) => {
    const at = doc.layout[n.id] as [number, number]
    const w = blockWidth(n.type)
    return { ...n, rect: { x: at[0], y: at[1], w, h: estimateBlockHeight(n) } }
  })
  const canvas = toJsonCanvas({
    groups: doc.groups.map((g) => ({
      id: g.id,
      title: g.title,
      members: doc.nodes.filter((n) => n.group === g.id).map((n) => n.id)
    })),
    blocks,
    links: doc.links
  })

  it('has group nodes first, a text node per block and an edge per channel', () => {
    expect(canvas.nodes.filter((n) => n.type === 'group')).toHaveLength(4)
    expect(canvas.nodes.filter((n) => n.type === 'text')).toHaveLength(31)
    expect(canvas.edges).toHaveLength(37)
    expect(canvas.nodes.slice(0, 4).every((n) => n.type === 'group')).toBe(true)
  })

  it('follows the structure of version 1.0', () => {
    const ids = new Set(canvas.nodes.map((n) => n.id))
    expect(ids.size).toBe(canvas.nodes.length)
    for (const n of canvas.nodes) {
      expect(Number.isInteger(n.x) && Number.isInteger(n.y)).toBe(true)
      expect(n.width).toBeGreaterThan(0)
      expect(n.height).toBeGreaterThan(0)
      if (n.type === 'text') expect(typeof n.text).toBe('string')
      if (n.type === 'group') expect(typeof n.label).toBe('string')
      if (n.color) expect(n.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
    const edgeIds = new Set<string>()
    for (const e of canvas.edges) {
      expect(ids.has(e.fromNode) && ids.has(e.toNode)).toBe(true)
      expect(['top', 'right', 'bottom', 'left']).toContain(e.fromSide)
      expect(['top', 'right', 'bottom', 'left']).toContain(e.toSide)
      expect(typeof e.label).toBe('string')
      expect(e.label.length).toBeGreaterThan(0)
      edgeIds.add(e.id)
    }
    expect(edgeIds.size).toBe(canvas.edges.length)
  })

  it('labels an edge "via: label" and colours it by kind', () => {
    const link = doc.links.find((l) => l.label !== '') as (typeof doc.links)[number]
    const edge = canvas.edges.find((e) => e.id === `e-${link.id}`)
    expect(edge?.label).toBe(`${link.via}: ${link.label}`)
    expect(edge?.color).toBe(VIA_HEX[link.via])
  })

  it('writes the code, title, body and "Nơi sửa" of a block as Markdown', () => {
    const f9c = doc.nodes.find((n) => n.id === 'F9C')!
    const text = canvas.nodes.find((n) => n.id === 'n-F9C')?.text ?? ''
    expect(text).toContain('**R9 · F9.4**')
    expect(text).toContain(f9c.title)
    expect(text).toContain(f9c.body)
    expect(text).toContain(f9c.fix)
  })
})

// -- automatic layout ----------------------------------------------------------------------------

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Blocks and links of a document in the shape the layout takes. */
function layoutInput(doc: FlowmapDoc) {
  const groupNo = new Map(doc.groups.map((g, i) => [g.id, i + 1]))
  const no = new Map(doc.nodes.map((n, i) => [n.id, i + 1]))
  const blocks: LayoutBlock[] = doc.nodes.map((n) => ({
    id: no.get(n.id) as number,
    w: blockWidth(n.type),
    h: estimateBlockHeight(n),
    group: n.group === null ? null : (groupNo.get(n.group) as number)
  }))
  const links = doc.links.map((l) => ({
    from: no.get(l.from) as number,
    to: no.get(l.to) as number
  }))
  return { blocks, links }
}

function checkNoOverlap(blocks: readonly LayoutBlock[], at: Map<number, { x: number; y: number }>) {
  const rects = blocks.map((b) => {
    const p = at.get(b.id) as { x: number; y: number }
    return { b, r: { x: p.x, y: p.y, w: b.w, h: b.h } }
  })
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++)
      if (overlaps((rects[i] as (typeof rects)[number]).r, (rects[j] as (typeof rects)[number]).r))
        return `${(rects[i] as (typeof rects)[number]).b.id} overlaps ${(rects[j] as (typeof rects)[number]).b.id}`
  const frames = new Map<number, Rect[]>()
  for (const { b, r } of rects) {
    if (b.group === null) continue
    frames.set(b.group, [...(frames.get(b.group) ?? []), r])
  }
  const boxes = [...frames].map(([g, list]) => [g, frameBounds(list) as Rect] as const)
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (
        overlaps((boxes[i] as (typeof boxes)[number])[1], (boxes[j] as (typeof boxes)[number])[1])
      )
        return `frame ${(boxes[i] as (typeof boxes)[number])[0]} overlaps frame ${(boxes[j] as (typeof boxes)[number])[0]}`
  return null
}

describe('automatic layout with ELK', () => {
  it('places every block of the sample without any overlap, frames included', async () => {
    const input = layoutInput(sampleDoc())
    const placed = await computeLayout(elk, input)
    expect(placed.size).toBe(31)
    expect(checkNoOverlap(input.blocks, placed)).toBeNull()
  })

  it('lays a layered graph out from left to right', async () => {
    const placed = await computeLayout(elk, {
      blocks: [1, 2, 3].map((id) => ({ id, w: 200, h: 80, group: null })),
      links: [
        { from: 1, to: 2 },
        { from: 2, to: 3 }
      ]
    })
    const x = (id: number) => (placed.get(id) as { x: number }).x
    expect(x(1)).toBeLessThan(x(2))
    expect(x(2)).toBeLessThan(x(3))
    expect(x(2) - x(1)).toBeGreaterThanOrEqual(200 + 96)
  })

  it('keeps the blocks of a group together inside one frame', async () => {
    const input = layoutInput(sampleDoc())
    const placed = await computeLayout(elk, input)
    const rectsOf = (g: number) =>
      input.blocks
        .filter((b) => b.group === g)
        .map((b) => ({ ...(placed.get(b.id) as { x: number; y: number }), w: b.w, h: b.h }))
    const outside = input.blocks.filter((b) => b.group !== 1)
    const frame = frameBounds(rectsOf(1)) as Rect
    for (const b of outside) {
      const p = placed.get(b.id) as { x: number; y: number }
      expect(overlaps(frame, { x: p.x, y: p.y, w: b.w, h: b.h })).toBe(false)
    }
  })

  it('places a cluster of new blocks under the fixed ones', () => {
    const anchor = pendingAnchor([
      { x: 100, y: 40, w: 250, h: 100 },
      { x: 500, y: 300, w: 250, h: 120 }
    ])
    expect(anchor.x).toBe(100)
    expect(anchor.y).toBeGreaterThan(420)
    expect(pendingAnchor([])).toEqual({ x: 0, y: 0 })
    const moves = placeAt(new Map([[7, { x: 10.4, y: 20.6 }]]), { x: 100, y: 200 })
    expect(moves).toEqual([{ id: 7, x: 110, y: 221 }])
  })

  it('lays out 200 blocks and 400 channels in under 3 seconds with no overlap (NFR-04)', async () => {
    const blocks: LayoutBlock[] = []
    for (let i = 1; i <= 200; i++) {
      blocks.push({ id: i, w: 250, h: 130, group: i <= 160 ? Math.ceil(i / 40) : null })
    }
    const links = []
    for (let i = 1; i <= 200; i++) {
      links.push({ from: i, to: (i % 200) + 1 })
      links.push({ from: i, to: ((i * 7) % 200) + 1 })
    }
    const t0 = Date.now()
    const placed = await computeLayout(elk, { blocks, links })
    const ms = Date.now() - t0
    expect(placed.size).toBe(200)
    expect(checkNoOverlap(blocks, placed)).toBeNull()
    expect(ms).toBeLessThan(3000)
  })
})
