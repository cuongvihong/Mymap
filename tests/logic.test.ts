import { describe, expect, it } from 'vitest'
import { docLinkEnds, docScenarios } from '../src/shared/diagram/flowmap'
import { incidentLinks, litNodes, neighbors } from '../src/shared/diagram/focus'
import {
  PARALLEL_STEP,
  bezierPoint,
  chooseOrientation,
  connect,
  gridPositions,
  parallelOffset,
  type Rect
} from '../src/shared/diagram/geometry'
import { deriveLinkKey, idProblem, isValidId, newId, sanitizeId } from '../src/shared/diagram/ids'
import { pickPin } from '../src/shared/diagram/pinpick'
import { cycleSub, isTap, slotFromVector } from '../src/shared/diagram/radial'
import {
  checkScenario,
  descendants,
  fullPath,
  pathNodeIds,
  promoteChildren,
  scenariosForkedAt,
  scenariosUsingNodes,
  wouldCycle
} from '../src/shared/diagram/scenario'
import { sampleDoc } from './helpers/sample'

const doc = sampleDoc()
const scenarios = docScenarios(doc)
const links = docLinkEnds(doc)
const keys = (id: string) => fullPath(scenarios, id).map((s) => s.nodeId)

describe('scenario.fullPath', () => {
  it('a root scenario is its own steps', () => {
    expect(keys('P-01')).toHaveLength(13)
    expect(keys('P-01')[0]).toBe('JOB')
  })

  it('N-05 (three levels: P-01, A-01, N-05) has 14 steps and ends at EFL', () => {
    const path = keys('N-05')
    expect(path).toHaveLength(14)
    expect(path.at(-1)).toBe('EFL')
    expect(path.slice(9)).toEqual(['F9B', 'F9C', 'F9D', 'F9E', 'EFL'])
  })

  it('E-02 (four levels) ends at ERC and stops before the fork point of its parent', () => {
    const path = keys('E-02')
    expect(path.at(-1)).toBe('ERC')
    expect(path.slice(-3)).toEqual(['F9D', 'F9E', 'ERC'])
    expect(path).toHaveLength(14)
  })

  it('a branch is the parent path up to before the fork point, then its own steps', () => {
    // N-02 forks at F8A, which is step 7 of P-01
    expect(keys('N-02')).toEqual([...keys('P-01').slice(0, 6), 'F8A', 'E02'])
  })

  it('keeps the notes of the steps', () => {
    const last = fullPath(scenarios, 'E-02').at(-1)
    expect(last?.note).toContain('ReconciliationRequired')
  })

  it('does not loop on bad data', () => {
    const loop = [
      { id: 'a', parentId: 'b', forkNodeId: 1, steps: [{ nodeId: 1, note: '' }] },
      { id: 'b', parentId: 'a', forkNodeId: 1, steps: [{ nodeId: 1, note: '' }] }
    ]
    expect(fullPath(loop, 'a').length).toBeGreaterThan(0)
  })

  it('pathNodeIds has no repeats', () => {
    const ids = pathNodeIds(
      [
        {
          id: 1,
          parentId: null,
          forkNodeId: null,
          steps: [
            { nodeId: 'x', note: '' },
            { nodeId: 'x', note: '' }
          ]
        }
      ],
      1
    )
    expect(ids).toEqual(['x'])
  })
})

describe('scenario rules BR-06 to BR-08', () => {
  it('every scenario of the sample is clean', () => {
    for (const s of scenarios) expect(checkScenario(scenarios, s.id), String(s.id)).toEqual([])
  })

  it('finds the three problems', () => {
    const base = scenarios.map((s) => ({ ...s }))
    const n05 = base.find((s) => s.id === 'N-05')!
    n05.forkNodeId = 'ESK'
    expect(checkScenario(base, 'N-05')).toContain('fork-not-on-path')
    n05.forkNodeId = null
    expect(checkScenario(base, 'N-05')).toContain('fork-missing')
    n05.forkNodeId = 'F9D'
    n05.steps = [{ nodeId: 'F9E', note: '' }]
    expect(checkScenario(base, 'N-05')).toContain('first-step-not-fork')
  })

  it('wouldCycle and descendants', () => {
    expect(wouldCycle(scenarios, 'P-01', 'E-02')).toBe(true)
    expect(wouldCycle(scenarios, 'E-02', 'P-01')).toBe(false)
    expect(wouldCycle(scenarios, 'P-01', null)).toBe(false)
    expect(wouldCycle(scenarios, 'P-01', 'P-01')).toBe(true)
    expect(descendants(scenarios, 'A-01')).toEqual(['N-05', 'E-02'])
    expect(descendants(scenarios, 'P-01')).toHaveLength(8)
  })

  it('finds the scenarios that use a block, with inherited paths (FR-SUA-06)', () => {
    expect(scenariosUsingNodes(scenarios, ['F9D'])).toEqual(['A-01', 'N-05', 'E-02'])
    expect(scenariosForkedAt(scenarios, ['F9D'])).toEqual(['N-05'])
    expect(scenariosUsingNodes(scenarios, ['JOB'])).toHaveLength(9)
  })

  it('promoting branches keeps their full paths', () => {
    const before = new Map(scenarios.map((s) => [s.id, keys(s.id as string)]))
    // delete A-01: N-05 should now hang from P-01 and still walk the same blocks
    const promoted = promoteChildren(scenarios, 'A-01')
    expect(promoted.map((p) => p.id)).toEqual(['N-05'])
    const rest = scenarios
      .filter((s) => s.id !== 'A-01')
      .map((s) => {
        const p = promoted.find((x) => x.id === s.id)
        return p ? { ...s, parentId: p.parentId, forkNodeId: p.forkNodeId, steps: p.steps } : s
      })
    expect(fullPath(rest, 'N-05').map((s) => s.nodeId)).toEqual(before.get('N-05'))
    expect(fullPath(rest, 'E-02').map((s) => s.nodeId)).toEqual(before.get('E-02'))
    for (const s of rest) expect(checkScenario(rest, s.id)).toEqual([])
    const n05 = promoted[0]!
    expect(n05.parentId).toBe('P-01')
    expect(n05.forkNodeId).toBe('F9B')
  })

  it('promoting the children of a root scenario makes them roots with the whole prefix', () => {
    const before = keys('N-02')
    const promoted = promoteChildren(scenarios, 'P-01')
    const n02 = promoted.find((p) => p.id === 'N-02')!
    expect(n02.parentId).toBeNull()
    expect(n02.forkNodeId).toBeNull()
    expect(n02.steps.map((s) => s.nodeId)).toEqual(before)
  })
})

describe('focus', () => {
  it('neighbors and incidentLinks', () => {
    expect([...neighbors(links, 'F8B')].sort()).toEqual(['DEA', 'F1B', 'F8A', 'F8B', 'F8C', 'F9A'])
    expect(incidentLinks(links, 'F9C').size).toBe(6)
  })

  it('focus only on F9C lights exactly 7 blocks', () => {
    const lit = litNodes({ links, focusId: 'F9C', scenarioPaths: [] })
    expect([...lit!].sort()).toEqual(['DTX', 'F1B', 'F9B', 'F9C', 'F9D', 'F9E', 'LDG'])
    expect(lit!.size).toBe(7)
  })

  it('focus F8B with scenario P-01 lights F8A, F8B, F9A only', () => {
    const lit = litNodes({ links, focusId: 'F8B', scenarioPaths: [keys('P-01')] })
    expect([...lit!].sort()).toEqual(['F8A', 'F8B', 'F9A'])
  })

  it('scenarios only: the union of the paths', () => {
    const lit = litNodes({ links, focusId: null, scenarioPaths: [keys('N-02'), keys('N-04')] })
    expect(lit!.has('E02')).toBe(true)
    expect(lit!.has('ENB')).toBe(true)
    expect(lit!.has('EPD')).toBe(false)
  })

  it('an empty intersection falls back to the focus alone (FR-CV-07)', () => {
    const lit = litNodes({ links, focusId: 'F1A', scenarioPaths: [['EPD']] })
    expect(lit).toEqual(neighbors(links, 'F1A'))
  })

  it('nothing selected is null', () => {
    expect(litNodes({ links, focusId: null, scenarioPaths: [] })).toBeNull()
  })
})

describe('radial', () => {
  it('maps the eight directions to slots 0 to 7, up first and clockwise', () => {
    const r = 80
    const d = r * Math.SQRT1_2
    const cases: [number, number, number][] = [
      [0, -r, 0],
      [d, -d, 1],
      [r, 0, 2],
      [d, d, 3],
      [0, r, 4],
      [-d, d, 5],
      [-r, 0, 6],
      [-d, -d, 7]
    ]
    for (const [dx, dy, slot] of cases) expect(slotFromVector(dx, dy), `${dx},${dy}`).toBe(slot)
  })

  it('the 40 px dead zone returns -1, just outside it returns a slot', () => {
    expect(slotFromVector(0, 0)).toBe(-1)
    expect(slotFromVector(0, -40)).toBe(-1)
    expect(slotFromVector(25, 25)).toBe(-1)
    expect(slotFromVector(0, -41)).toBe(0)
    expect(slotFromVector(-41, 0)).toBe(6)
  })

  it('slots are 45 degrees wide and centred on their direction', () => {
    const at = (deg: number) =>
      slotFromVector(100 * Math.sin((deg * Math.PI) / 180), -100 * Math.cos((deg * Math.PI) / 180))
    expect(at(22)).toBe(0)
    expect(at(23)).toBe(1)
    expect(at(337)).toBe(7)
    expect(at(338)).toBe(0)
  })

  it('works with another number of slots and a custom dead zone', () => {
    expect(slotFromVector(0, -60, 5, 50)).toBe(0)
    expect(slotFromVector(0, 60, 4, 50)).toBe(2)
    expect(slotFromVector(0, -30, 8, 50)).toBe(-1)
  })

  it('isTap: under 220 ms and under 6 px', () => {
    expect(isTap(100, 2)).toBe(true)
    expect(isTap(219, 5.9)).toBe(true)
    expect(isTap(220, 0)).toBe(false)
    expect(isTap(100, 6)).toBe(false)
  })

  it('cycleSub wraps both ways', () => {
    expect(cycleSub(0, 1, 7)).toBe(1)
    expect(cycleSub(6, 1, 7)).toBe(0)
    expect(cycleSub(0, -1, 7)).toBe(6)
    expect(cycleSub(3, -10, 7)).toBe(0)
    expect(cycleSub(0, 1, 0)).toBe(0)
  })
})

describe('geometry', () => {
  const box = (x: number, y: number, w = 250, h = 120): Rect => ({ x, y, w, h })

  it('side by side blocks join right edge to left edge', () => {
    const a = box(0, 0)
    const b = box(400, 10)
    expect(chooseOrientation(a, b)).toBe('horizontal')
    const c = connect(a, b)
    expect(c.p1[0]).toBe(250)
    expect(c.p2[0]).toBe(400)
    const back = connect(b, a)
    expect(back.p1[0]).toBe(400)
    expect(back.p2[0]).toBe(250)
  })

  it('stacked blocks join bottom edge to top edge', () => {
    const a = box(0, 0)
    const b = box(20, 300)
    expect(chooseOrientation(a, b)).toBe('vertical')
    const c = connect(a, b)
    expect(c.p1[1]).toBe(120)
    expect(c.p2[1]).toBe(300)
    const up = connect(b, a)
    expect(up.p1[1]).toBe(300)
    expect(up.p2[1]).toBe(120)
  })

  it('the 0.55 rule: dx just above 0.55 dy is horizontal, just below is vertical', () => {
    const a = box(0, 0, 400, 40)
    const dy = 200
    expect(chooseOrientation(a, box(0.56 * dy, dy, 400, 40))).toBe('horizontal')
    expect(chooseOrientation(a, box(0.54 * dy, dy, 400, 40))).toBe('vertical')
  })

  it('the demo adds a second horizontal case: centres further apart than 0.9 of the width', () => {
    expect(chooseOrientation(box(0, 0), box(230, 900))).toBe('horizontal')
    expect(chooseOrientation(box(0, 0), box(200, 900))).toBe('vertical')
  })

  it('parallel wires are 12 px apart and centred: (i - (n - 1) / 2) * 12', () => {
    expect(PARALLEL_STEP).toBe(12)
    expect(parallelOffset(0, 1)).toBe(0)
    expect([0, 1].map((i) => parallelOffset(i, 2))).toEqual([-6, 6])
    expect([0, 1, 2].map((i) => parallelOffset(i, 3))).toEqual([-12, 0, 12])
    expect([0, 1, 2, 3].map((i) => parallelOffset(i, 4))).toEqual([-18, -6, 6, 18])
  })

  it('wires of one pair are shifted across their direction', () => {
    const a = box(0, 0)
    const b = box(400, 0)
    const w0 = connect(a, b, parallelOffset(0, 2))
    const w1 = connect(a, b, parallelOffset(1, 2))
    expect(w1.p1[1] - w0.p1[1]).toBe(12)
    expect(w1.p2[1] - w0.p2[1]).toBe(12)
    const c = box(0, 400)
    const v0 = connect(a, c, parallelOffset(0, 2))
    const v1 = connect(a, c, parallelOffset(1, 2))
    expect(v1.p1[0] - v0.p1[0]).toBe(12)
  })

  it('the anchor stays 14 px away from the corners', () => {
    const c = connect(box(0, 0), box(400, 0), 200)
    expect(c.p1[1]).toBe(120 - 14)
  })

  it('mid is the point at t = 0.5 and the path starts and ends on the anchors', () => {
    const c = connect(box(0, 0), box(400, 0))
    expect(c.mid).toEqual(bezierPoint(c.p1, c.c1, c.c2, c.p2, 0.5))
    expect(c.mid[0]).toBeCloseTo((250 + 400) / 2)
    expect(c.d.startsWith('M250 60C')).toBe(true)
    expect(c.d.endsWith('400 60')).toBe(true)
  })

  it('grid positions are 300 x 200 cells filled row by row', () => {
    const g = gridPositions(8, { x: 10, y: 20 }, 6)
    expect(g[0]).toEqual({ x: 10, y: 20 })
    expect(g[1]).toEqual({ x: 310, y: 20 })
    expect(g[5]).toEqual({ x: 1510, y: 20 })
    expect(g[6]).toEqual({ x: 10, y: 220 })
    expect(gridPositions(0)).toEqual([])
  })
})

describe('pinpick', () => {
  const fs08 = [
    { id: 1, note: 'SingPass báo lỗi hoặc Parent hủy ở màn xác thực' },
    { id: 2, note: 'Nút Log in with SingPass trên Landing page' },
    { id: 3, note: 'Thẻ của con trên Home' }
  ]

  it('the note "SingPass báo lỗi hoặc Parent bấm hủy" picks pin 1', () => {
    expect(pickPin(fs08, 'SingPass báo lỗi hoặc Parent bấm hủy')).toBe(0)
  })

  it('ignores accents, case and words shorter than 3 characters', () => {
    expect(pickPin(fs08, 'THE CUA CON TREN HOME')).toBe(2)
    expect(
      pickPin(
        [
          { id: 1, note: 'ab cd' },
          { id: 2, note: 'Landing' }
        ],
        'ab cd landing'
      )
    ).toBe(1)
  })

  it('a tie goes to the first pin and no pin gives -1', () => {
    expect(pickPin(fs08, 'không liên quan')).toBe(0)
    expect(pickPin([], 'bất kỳ')).toBe(-1)
  })
})

describe('ids', () => {
  it('BR-01: letters without accents, digits and . _ -', () => {
    for (const ok of ['F9C', 'P-01', 'F9.4', 'a_b', 'R1']) expect(isValidId(ok), ok).toBe(true)
    for (const bad of ['', 'F 9', 'Ư1', 'a/b', 'x'.repeat(41), 'a:b'])
      expect(isValidId(bad), bad).toBe(false)
    expect(idProblem('F 9')).toContain('chỉ gồm')
    expect(idProblem('')).toContain('trống')
    expect(idProblem('F9C')).toBeNull()
  })

  it('newId takes the highest number plus one', () => {
    expect(newId('F', [])).toBe('F1')
    expect(newId('F', ['F1', 'F2', 'F7', 'X1', 'FA'])).toBe('F8')
    expect(newId('REQ', ['REQ3'])).toBe('REQ4')
  })

  it('sanitizeId drops accents and illegal characters', () => {
    expect(sanitizeId('Trả bằng EA!')).toBe('Tra-bang-EA')
    expect(sanitizeId('đăng nhập')).toBe('dang-nhap')
    expect(isValidId(sanitizeId('  ***  '))).toBe(false)
  })

  it('deriveLinkKey adds a counter for a repeated triple', () => {
    const taken = new Set<string>()
    const a = deriveLinkKey('A', 'B', 'rest', taken)
    taken.add(a)
    const b = deriveLinkKey('A', 'B', 'rest', taken)
    taken.add(b)
    expect([a, b, deriveLinkKey('A', 'B', 'rest', taken)]).toEqual([
      'A_B_rest',
      'A_B_rest_2',
      'A_B_rest_3'
    ])
    expect(isValidId(a)).toBe(true)
  })
})
