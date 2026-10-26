import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  defaultVia,
  groupByPair,
  reqCoverage,
  uncoveredReqs,
  viaSet
} from '../src/shared/diagram/channels'
import { parallelOffset } from '../src/shared/diagram/geometry'
import { linkProblem, LINK_RULE_TEXT, LINK_SELF_TEXT } from '../src/shared/diagram/linkrules'
import { findSampleFile, seedSampleProject } from '../src/main/diagram/seed'
import { createProjectService } from '../src/main/diagram/services/project'
import type { LinkData, NodeType, ProjectData } from '../src/shared/diagram/types'
import { makeKho, silentLogger } from './helpers/kho'

const link = (id: number, fromNode: number, toNode: number, sortOrder = id): LinkData => ({
  id,
  key: `l${id}`,
  fromNode,
  toNode,
  via: 'call',
  label: '',
  note: '',
  sortOrder
})

describe('groupByPair', () => {
  it('puts both directions of a pair in one group', () => {
    const g = groupByPair([link(1, 1, 2), link(2, 2, 1), link(3, 1, 3)])
    expect(g).toHaveLength(2)
    expect(g[0]?.links.map((l) => l.id)).toEqual([1, 2])
    expect(g[0]?.key).toBe(g[0]?.key)
    expect(g[1]?.links.map((l) => l.id)).toEqual([3])
  })

  it('orders the channels of a pair by sort_order then id, whatever the input order', () => {
    const a = groupByPair([link(5, 1, 2, 30), link(3, 2, 1, 10), link(4, 1, 2, 10)])
    const b = groupByPair([link(4, 1, 2, 10), link(5, 1, 2, 30), link(3, 2, 1, 10)])
    expect(a[0]?.links.map((l) => l.id)).toEqual([3, 4, 5])
    expect(b[0]?.links.map((l) => l.id)).toEqual([3, 4, 5])
    const offsets = a[0]?.links.map((_, i) => parallelOffset(i, 3))
    expect(offsets).toEqual([-12, 0, 12])
  })

  it('merges ends through the end mapper and drops channels inside one tile', () => {
    const tile = (id: number) => (id <= 2 ? 'g1' : String(id))
    const g = groupByPair([link(1, 1, 2), link(2, 1, 3), link(3, 2, 3), link(4, 3, 1)], tile)
    expect(g).toHaveLength(1)
    expect(g[0]?.links.map((l) => l.id)).toEqual([2, 3, 4])
  })

  it('viaSet keeps first appearance order without repeats', () => {
    expect(viaSet([{ via: 'rest' }, { via: 'db' }, { via: 'rest' }])).toEqual(['rest', 'db'])
  })
})

describe('defaultVia (FR-LK-02 table)', () => {
  const t = (type: NodeType, subtype: string | null = null) => ({ type, subtype })
  it('follows the table', () => {
    expect(defaultVia(t('req'), t('fnc'))).toBe('impl')
    expect(defaultVia(t('req'), t('tech', 'database'))).toBe('impl')
    expect(defaultVia(t('start', 'user'), t('fnc'))).toBe('ui')
    expect(defaultVia(t('start', 'schedule'), t('fnc'))).toBe('job')
    expect(defaultVia(t('fnc'), t('fnc'))).toBe('call')
    expect(defaultVia(t('fnc'), t('tech', 'database'))).toBe('db')
    expect(defaultVia(t('fnc'), t('tech', 'api'))).toBe('rest')
    expect(defaultVia(t('fnc'), t('ext'))).toBe('rest')
    expect(defaultVia(t('fnc'), t('end', 'ok'))).toBe('ui')
    expect(defaultVia(t('tech'), t('fnc'))).toBe('call')
  })
})

describe('linkProblem (FR-LK-03)', () => {
  const n = (id: number, type: NodeType) => ({ id, type })
  it('blocks self links, into Start, into REQ, out of End, any Note and impl not from REQ', () => {
    expect(linkProblem(n(1, 'fnc'), n(1, 'fnc'), 'call')).toBe(LINK_SELF_TEXT)
    expect(linkProblem(n(1, 'fnc'), n(2, 'start'), 'call')).toBe(LINK_RULE_TEXT['to-start'])
    expect(linkProblem(n(1, 'fnc'), n(2, 'req'), 'call')).toBe(LINK_RULE_TEXT['to-req'])
    expect(linkProblem(n(1, 'end'), n(2, 'fnc'), 'call')).toBe(LINK_RULE_TEXT['from-end'])
    expect(linkProblem(n(1, 'note'), n(2, 'fnc'), 'call')).toBe(LINK_RULE_TEXT.note)
    expect(linkProblem(n(1, 'fnc'), n(2, 'note'), 'call')).toBe(LINK_RULE_TEXT.note)
    expect(linkProblem(n(1, 'fnc'), n(2, 'fnc'), 'impl')).toBe(LINK_RULE_TEXT['impl-not-req'])
  })
  it('allows the normal combinations', () => {
    expect(linkProblem(n(1, 'fnc'), n(2, 'tech'), 'db')).toBeNull()
    expect(linkProblem(n(1, 'req'), n(2, 'fnc'), 'impl')).toBeNull()
    expect(linkProblem(n(1, 'start'), n(2, 'fnc'), 'ui')).toBeNull()
    expect(linkProblem(n(1, 'fnc'), n(2, 'end'), 'ui')).toBeNull()
  })
})

describe('reqCoverage (FR-KH-08)', () => {
  const nodes = [
    { id: 1, type: 'req' as const },
    { id: 2, type: 'req' as const },
    { id: 3, type: 'fnc' as const },
    { id: 4, type: 'fnc' as const },
    { id: 5, type: 'tech' as const }
  ]
  const l = (fromNode: number, toNode: number, via: LinkData['via']) => ({ fromNode, toNode, via })
  it('counts distinct Function blocks reached by impl channels', () => {
    const c = reqCoverage(nodes, [
      l(1, 3, 'impl'),
      l(1, 3, 'impl'),
      l(1, 4, 'impl'),
      l(1, 5, 'impl'),
      l(2, 3, 'call')
    ])
    expect(c.get(1)).toBe(2)
    expect(c.get(2)).toBe(0)
    expect(c.has(3)).toBe(false)
    expect([...uncoveredReqs(c)]).toEqual([2])
  })
})

describe('sample project', () => {
  let kho: ReturnType<typeof makeKho>
  let data: ProjectData
  beforeEach(() => {
    kho = makeKho()
    const ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
    const file = findSampleFile(process.cwd())
    if (!file) throw new Error('sample not found')
    data = createProjectService(ctx).load(seedSampleProject(ctx, file))
  })
  afterEach(() => kho.cleanup())

  it('has 3 channels between F9.5 and Payment Provider and 6 pairs around F9.4', () => {
    const id = (key: string) => data.nodes.find((n) => n.key === key)!.id
    const pairs = groupByPair(data.links)
    const f9d = id('F9D')
    const prv = id('PRV')
    const [x, y] = [String(f9d), String(prv)].sort()
    expect(pairs.find((p) => p.key === `${x}|${y}`)?.links).toHaveLength(3)
    const f9c = String(id('F9C'))
    expect(pairs.filter((p) => p.a === f9c || p.b === f9c)).toHaveLength(6)
  })
})
