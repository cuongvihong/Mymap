import { describe, expect, it } from 'vitest'
import {
  alignMoves,
  distributeMoves,
  snapDrag,
  snapGrid,
  type Box
} from '../src/shared/diagram/arrange'
import { copyKey, planClone } from '../src/shared/diagram/clone'
import { History } from '../src/shared/diagram/history'
import { cycleSub, isTap, slotFromVector } from '../src/shared/diagram/radial'
import {
  DELETE_SLOT,
  RING_SLOTS,
  blockSpec,
  canvasRing,
  currentSub,
  linkRing,
  multiRing,
  nodeRing
} from '../src/shared/diagram/radialMenus'
import { fixMatches, searchNodes } from '../src/shared/diagram/search'
import { NODE_KEY_PREFIX, newId } from '../src/shared/diagram/ids'
import type { LinkData, NodeData } from '../src/shared/diagram/types'

const node = (id: number, key: string, over: Partial<NodeData> = {}): NodeData => ({
  id,
  key,
  type: 'fnc',
  subtype: null,
  code: key,
  title: `Khối ${key}`,
  body: '',
  fixText: '',
  chips: [],
  fsFile: null,
  fsSection: null,
  groupId: null,
  x: id * 100,
  y: 0,
  hasLayout: true,
  collapsed: false,
  ...over
})
const link = (id: number, from: number, to: number, key = `L${id}`): LinkData => ({
  id,
  key,
  fromNode: from,
  toNode: to,
  via: 'call',
  label: 'nhãn',
  note: '',
  sortOrder: id
})

describe('radial gestures (TDD 8.4)', () => {
  it('isTap: under 220 ms and under 6 px', () => {
    expect(isTap(100, 2)).toBe(true)
    expect(isTap(219, 5)).toBe(true)
    expect(isTap(220, 0)).toBe(false)
    expect(isTap(50, 6)).toBe(false)
  })
  it('cycleSub wraps in both directions', () => {
    expect(cycleSub(0, -1, 7)).toBe(6)
    expect(cycleSub(6, 1, 7)).toBe(0)
    expect(cycleSub(0, 2, 7)).toBe(2)
    expect(cycleSub(3, 1, 0)).toBe(0)
  })
  it('up and down map to slots 0 and 4', () => {
    expect(slotFromVector(0, -100)).toBe(0)
    expect(slotFromVector(0, 100)).toBe(DELETE_SLOT)
    expect(slotFromVector(10, 10)).toBe(-1)
  })
})

describe('ring definitions (FR-VC-05)', () => {
  it('canvas ring order matches the demo and has no delete', () => {
    const ring = canvasRing()
    expect(ring).toHaveLength(RING_SLOTS)
    expect(ring.map((i) => i?.id)).toEqual([
      'fnc',
      'req',
      'tech',
      'ext',
      'note',
      'cond',
      'startend',
      'group'
    ])
    expect(ring.some((i) => i?.id === 'delete')).toBe(false)
    expect(ring[4]?.label).toBe('Ghi chú')
  })
  it('block, channel and multi rings keep Xóa at the bottom slot', () => {
    for (const ring of [
      nodeRing({ collapsed: false }),
      linkRing({ split: false }),
      multiRing([])
    ]) {
      expect(ring).toHaveLength(RING_SLOTS)
      expect(ring[DELETE_SLOT]?.id).toBe('delete')
      expect(ring[DELETE_SLOT]?.tone).toBe('danger')
    }
  })
  it('channel ring has five items and empty slots after them', () => {
    const ring = linkRing({ split: false })
    expect(ring.filter(Boolean)).toHaveLength(5)
    expect(ring.slice(5).every((s) => s === null)).toBe(true)
  })
  it('only the auto layout item still waits for a later session', () => {
    const ring = nodeRing({ collapsed: false })
    expect(ring[1]?.soon).toBeUndefined()
    expect(ring[3]?.soon).toBeUndefined()
    expect(multiRing([])[3]?.soon).toBeUndefined()
  })
  it('collapse slot reads Mở rộng for a collapsed block', () => {
    expect(nodeRing({ collapsed: true })[6]?.label).toBe('Mở rộng')
    expect(nodeRing({ collapsed: false })[6]?.label).toBe('Thu gọn')
  })
  it('Tech sub-types: two notches down from API is Service, the remembered one wins', () => {
    const tech = canvasRing()[2]!
    const subs = tech.subs!
    expect(subs.map((s) => s.id)).toEqual([
      'api',
      'database',
      'service',
      'ui',
      'queue',
      'storage',
      'job'
    ])
    expect(subs[cycleSub(0, 2, subs.length)]!.id).toBe('service')
    expect(currentSub(tech, 'service')?.id).toBe('service')
    expect(currentSub(tech, 'nope')?.id).toBe('api')
  })
  it('blockSpec maps slots to block types', () => {
    expect(blockSpec('fnc', null)).toEqual({ type: 'fnc', subtype: null })
    expect(blockSpec('tech', 'service')).toEqual({ type: 'tech', subtype: 'service' })
    expect(blockSpec('startend', 'end')?.type).toBe('end')
    expect(blockSpec('startend', 'start')?.type).toBe('start')
    expect(blockSpec('group', null)).toBeNull()
  })
  it('group sub list starts with a new group then the existing ones', () => {
    const subs = multiRing([{ id: 7, title: 'R9' }])[2]!.subs!
    expect(subs.map((s) => s.id)).toEqual(['new', '7'])
  })
})

describe('new block keys never repeat', () => {
  it('newId skips used numbers and keeps counting after deletions', () => {
    const taken = ['F1', 'F2', 'F5', 'X1']
    expect(newId(NODE_KEY_PREFIX.fnc, taken)).toBe('F6')
    expect(newId(NODE_KEY_PREFIX.ext, taken)).toBe('X2')
    const keys = new Set(taken)
    for (let i = 0; i < 20; i++) {
      const k = newId('F', keys)
      expect(keys.has(k)).toBe(false)
      keys.add(k)
    }
  })
})

describe('History (FR-SUA-05)', () => {
  it('keeps at least 100 steps and caps at 200', () => {
    const h = new History<number>()
    for (let i = 0; i < 250; i++) h.push(i)
    expect(h.undoCount).toBe(200)
    let n = 0
    while (h.peekUndo() !== undefined) {
      h.undone()
      n++
    }
    expect(n).toBe(200)
    expect(h.redoCount).toBe(200)
  })
  it('a new action clears redo, undo and redo walk the same command', () => {
    const h = new History<string>()
    h.push('a')
    h.push('b')
    expect(h.peekUndo()).toBe('b')
    h.undone()
    expect(h.peekRedo()).toBe('b')
    h.redone()
    expect(h.peekUndo()).toBe('b')
    h.undone()
    h.push('c')
    expect(h.peekRedo()).toBeUndefined()
    h.clear()
    expect(h.undoCount + h.redoCount).toBe(0)
  })
})

describe('planClone (FR-SUA-04)', () => {
  const nodes = [node(1, 'A'), node(2, 'B'), node(3, 'C')]
  const links = [link(1, 1, 2), link(2, 2, 3), link(3, 3, 1)]
  it('adds -copy to the key and code and offsets the position', () => {
    const plan = planClone({
      nodes,
      links,
      ids: [1, 2],
      takenNodeKeys: nodes.map((n) => n.key),
      takenLinkKeys: links.map((l) => l.key),
      offset: { x: 32, y: 32 }
    })
    expect(plan.nodes.map((n) => n.key)).toEqual(['A-copy', 'B-copy'])
    expect(plan.nodes.map((n) => n.code)).toEqual(['A-copy', 'B-copy'])
    expect(plan.nodes[0]!.data.x).toBe(132)
    expect(plan.nodes[0]!.data.y).toBe(32)
  })
  it('keeps only channels that lie fully inside the copied set', () => {
    const plan = planClone({
      nodes,
      links,
      ids: [1, 2],
      takenNodeKeys: nodes.map((n) => n.key),
      takenLinkKeys: links.map((l) => l.key),
      offset: { x: 0, y: 0 }
    })
    expect(plan.links).toHaveLength(1)
    expect(plan.links[0]).toMatchObject({ fromKey: 'A-copy', toKey: 'B-copy', label: 'nhãn' })
  })
  it('copies of copies get -copy2, -copy3', () => {
    const taken = new Set(['A', 'A-copy'])
    expect(copyKey('A', taken)).toBe('A-copy2')
    expect(copyKey('A', taken)).toBe('A-copy3')
  })
})

describe('align and distribute', () => {
  const boxes: Box[] = [
    { id: 1, x: 10, y: 0, w: 100, h: 40 },
    { id: 2, x: 50, y: 80, w: 60, h: 40 },
    { id: 3, x: 300, y: 200, w: 80, h: 40 }
  ]
  it('left aligns to the left edge of the selection and skips blocks already there', () => {
    const moves = alignMoves(boxes, 'left')
    expect(moves.map((m) => m.id)).toEqual([2, 3])
    expect(moves.every((m) => m.x === 10)).toBe(true)
  })
  it('right, centre, top and bottom', () => {
    expect(
      alignMoves(boxes, 'right').every((m) => m.x + boxes.find((b) => b.id === m.id)!.w === 380)
    ).toBe(true)
    expect(alignMoves(boxes, 'top').every((m) => m.y === 0)).toBe(true)
    expect(alignMoves(boxes, 'bottom').every((m) => m.y + 40 === 240)).toBe(true)
    const centre = alignMoves(boxes, 'center')
    for (const m of centre) {
      const b = boxes.find((x) => x.id === m.id)!
      expect(m.x + b.w / 2).toBeCloseTo(195)
    }
  })
  it('distribute gives equal gaps and keeps the outer blocks', () => {
    const row: Box[] = [
      { id: 1, x: 0, y: 0, w: 100, h: 10 },
      { id: 2, x: 120, y: 0, w: 50, h: 10 },
      { id: 3, x: 400, y: 0, w: 100, h: 10 }
    ]
    const moves = distributeMoves(row, 'horizontal')
    expect(moves).toHaveLength(1)
    expect(moves[0]).toEqual({ id: 2, x: 225, y: 0 })
    expect(distributeMoves(row.slice(0, 2), 'horizontal')).toEqual([])
  })
})

describe('snapDrag (FR-SUA-03)', () => {
  it('snaps to the 16 px grid when nothing is close', () => {
    expect(snapGrid(23)).toBe(16)
    expect(snapGrid(25)).toBe(32)
    const r = snapDrag({ x: 21, y: 35, w: 100, h: 50 }, [])
    expect(r.dx).toBe(-5)
    expect(r.dy).toBe(-3)
    expect(r.guides).toEqual([])
  })
  it('snaps to a neighbour edge and reports a guide', () => {
    const other = { x: 300, y: 500, w: 100, h: 60 }
    const r = snapDrag({ x: 303, y: 100, w: 100, h: 50 }, [other])
    expect(303 + r.dx).toBe(300)
    expect(r.guides.some((g) => g.axis === 'x' && g.at === 300)).toBe(true)
  })
})

describe('search (FR-TIM-01, FR-TIM-02)', () => {
  const list = [
    node(1, 'F9C', { code: 'R9 · F9.4', title: 'Trả bằng EA', body: 'Ghi sổ qua funding leg EA' }),
    node(2, 'LDG', {
      code: 'R1 · Sổ cái EA',
      title: 'Ghi nợ và hoàn EA',
      chips: ['Chưa chốt'],
      body: 'FundingReference idempotent'
    }),
    node(3, 'F9A', {
      code: 'R9 · F9.1',
      title: 'Xem invoice',
      fixText: 'e-Service Portal, màn Invoice'
    })
  ]
  it('finds without accents and ignores case', () => {
    expect(
      searchNodes(list, 'FUNDING')
        .map((h) => h.id)
        .sort()
    ).toEqual([1, 2])
    expect(searchNodes(list, 'so cai').map((h) => h.id)).toEqual([2])
    expect(searchNodes(list, 'chua chot').map((h) => h.id)).toEqual([2])
  })
  it('every word must match and the code ranks first', () => {
    expect(searchNodes(list, 'ea funding')).toHaveLength(2)
    expect(searchNodes(list, 'ea zzz')).toEqual([])
    expect(searchNodes(list, 'f9.4')[0]).toEqual({ id: 1, rank: 0 })
    expect(searchNodes(list, '')).toEqual([])
  })
  it('fixMatches uses the "Nơi sửa" text only', () => {
    expect([...fixMatches(list, 'e-service portal')]).toEqual([3])
    expect([...fixMatches(list, 'E-SERVICE')]).toEqual([3])
    expect(fixMatches(list, '').size).toBe(0)
    expect(fixMatches(list, 'funding').size).toBe(0)
  })
})
