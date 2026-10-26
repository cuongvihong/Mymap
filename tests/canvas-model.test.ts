import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildCanvasModel } from '../src/renderer/features/diagram/canvas/model'
import { createProjectService } from '../src/main/diagram/services/project'
import { findSampleFile, seedSampleProject } from '../src/main/diagram/seed'
import type { ProjectData } from '../src/shared/diagram/types'
import { makeKho, silentLogger } from './helpers/kho'

let kho: ReturnType<typeof makeKho>
let data: ProjectData

beforeEach(() => {
  kho = makeKho()
  const ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
  const file = findSampleFile(process.cwd())
  if (!file) throw new Error('sample not found')
  const id = seedSampleProject(ctx, file)
  data = createProjectService(ctx).load(id)
})
afterEach(() => kho.cleanup())

const input = (patch: Partial<Parameters<typeof buildCanvasModel>[0]> = {}) => ({
  data,
  sizes: {},
  focusId: null,
  selectedScenarios: [],
  ...patch
})
const idOf = (code: string) => data.nodes.find((n) => n.code.endsWith(code))!.id

describe('canvas model on the sample project', () => {
  it('draws one pair of 3 channels between F9.5 and Payment Provider, with 3 wires 12 px apart', () => {
    const m = buildCanvasModel(input())
    const f9d = data.nodes.find((n) => n.key === 'F9D')!.id
    const prv = data.nodes.find((n) => n.key === 'PRV')!.id
    const pair = m.pairs.find((p) =>
      p.links.every((l) => [f9d, prv].includes(l.fromNode) && [f9d, prv].includes(l.toNode))
    )!
    expect(pair.links).toHaveLength(3)
    expect(pair.wires).toHaveLength(3)
    const gap = (i: number) => {
      const [p, q] = [pair.wires[i]!.conn.p1, pair.wires[i + 1]!.conn.p1]
      return Math.hypot(p[0] - q[0], p[1] - q[1])
    }
    expect(gap(0)).toBeCloseTo(12)
    expect(gap(1)).toBeCloseTo(12)
  })

  it('filter REQ chưa phủ lights only uncovered REQ blocks', () => {
    const withReq = {
      ...data,
      nodes: [
        ...data.nodes,
        {
          ...data.nodes[0]!,
          id: 9999,
          key: 'REQ1',
          type: 'req' as const,
          code: 'REQ-1',
          groupId: null
        }
      ]
    }
    const m = buildCanvasModel(input({ data: withReq, filterUncovered: true }))
    expect(m.uncovered.has(9999)).toBe(true)
    expect(m.blocks.filter((b) => b.display !== 'dim').map((b) => b.node.id)).toEqual([9999])
  })

  it('draws 4 frames, 31 blocks and 37 channels in fewer pairs, blocks at their stored coordinates', () => {
    const m = buildCanvasModel(input())
    expect(m.frames).toHaveLength(4)
    expect(m.blocks).toHaveLength(31)
    expect(m.pairs.flatMap((p) => p.links)).toHaveLength(37)
    expect(m.pairs.length).toBeLessThan(37)
    for (const b of m.blocks) {
      expect([b.rect.x, b.rect.y]).toEqual([b.node.x, b.node.y])
      expect(b.display).toBe('normal')
    }
    expect(m.frames.every((f) => !f.collapsed && f.memberIds.length > 0)).toBe(true)
  })

  it('double click on F9.4 keeps 7 blocks bright and dims the other channels', () => {
    const f94 = idOf('F9.4')
    const m = buildCanvasModel(input({ focusId: f94 }))
    const bright = m.blocks.filter((b) => b.display !== 'dim')
    expect(bright).toHaveLength(7)
    expect(m.blocks.find((b) => b.node.id === f94)?.display).toBe('focus')
    const lit = m.pairs.filter((p) => p.display === 'lit')
    expect(lit).toHaveLength(6)
    expect(lit.every((p) => p.links.every((l) => l.fromNode === f94 || l.toNode === f94))).toBe(
      true
    )
    expect(m.pairs.filter((p) => p.display === 'dim').length).toBe(m.pairs.length - 6)
  })

  it('dims frames that hold no bright block', () => {
    const m = buildCanvasModel(input({ focusId: idOf('F9.4') }))
    const byKey = new Map(m.frames.map((f) => [f.group.key, f.display]))
    expect(byKey.get('R9')).toBe('normal')
    expect(byKey.get('R8')).toBe('dim')
  })

  it('scenario P-01 plus F8.2 lights F8.1, F8.2 and F9.1', () => {
    const p01 = data.scenarios.find((s) => s.key === 'P-01')!.id
    const m = buildCanvasModel(input({ selectedScenarios: [p01], focusId: idOf('FR-08.2') }))
    const bright = m.blocks
      .filter((b) => b.display !== 'dim')
      .map((b) => b.node.code)
      .sort()
    expect(bright).toHaveLength(3)
  })

  it('a collapsed group becomes one tile, hides its blocks and re-attaches the channels', () => {
    const r9 = data.groups.find((g) => g.key === 'R9')!
    const collapsed = {
      ...data,
      groups: data.groups.map((g) => (g.id === r9.id ? { ...g, collapsed: true } : g))
    }
    const members = data.nodes.filter((n) => n.groupId === r9.id).length
    const m = buildCanvasModel(input({ data: collapsed }))
    expect(m.blocks).toHaveLength(31 - members)
    const tile = m.frames.find((f) => f.group.id === r9.id)!
    expect(tile.collapsed).toBe(true)
    expect(tile.rect.w).toBe(250)
    expect(m.pairs.flatMap((p) => p.links).length).toBeLessThan(37)
    expect(m.pairs.length).toBeGreaterThan(0)
  })

  it('uses the measured height of a block for the frame', () => {
    const f94 = idOf('F9.4')
    const small = buildCanvasModel(input())
    const tall = buildCanvasModel(input({ sizes: { [f94]: { w: 250, h: 900 } } }))
    const r9 = (m: typeof small) => m.frames.find((f) => f.group.key === 'R9')!.rect
    expect(r9(tall).h).toBeGreaterThan(r9(small).h)
  })

  it('keeps the frame of an empty group, and the Nơi sửa filter lights only the matches', () => {
    const empty = {
      ...data,
      groups: [
        ...data.groups,
        {
          ...data.groups[0]!,
          id: 9001,
          key: 'EMPTY',
          collapsed: false,
          frame: { x: 10, y: 20, w: 400, h: 260 }
        }
      ]
    }
    const m = buildCanvasModel(input({ data: empty }))
    const frame = m.frames.find((f) => f.group.id === 9001)!
    expect(frame.rect).toEqual({ x: 10, y: 20, w: 400, h: 260 })
    expect(frame.memberIds).toHaveLength(0)

    const f9c = data.nodes.find((n) => n.key === 'F9C')!.id
    const lit = buildCanvasModel(input({ fixIds: new Set([f9c]) }))
    expect(lit.blocks.filter((b) => b.display !== 'dim').map((b) => b.node.id)).toEqual([f9c])
    // With a focus, the two sets intersect: only the focused block and the matching neighbour stay lit.
    const f9d = data.nodes.find((n) => n.key === 'F9D')!.id
    const both = buildCanvasModel(input({ fixIds: new Set([f9c]), focusId: f9d }))
    const bright = both.blocks.filter((b) => b.display !== 'dim').map((b) => b.node.id)
    expect(bright.sort()).toEqual([f9c, f9d].sort())
  })
})
