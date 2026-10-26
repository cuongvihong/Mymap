import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DiagramContext } from '../src/main/diagram/context'
import { DiagramError } from '../src/main/diagram/errors'
import { findSampleFile, SEED_PROJECT_NAME, seedSampleProject } from '../src/main/diagram/seed'
import { createGroupService } from '../src/main/diagram/services/group'
import { createLinkService } from '../src/main/diagram/services/link'
import { createNodeService } from '../src/main/diagram/services/node'
import { createProjectService } from '../src/main/diagram/services/project'
import { createScenarioService } from '../src/main/diagram/services/scenario'
import { createYamlService } from '../src/main/diagram/services/yaml'
import { fullPath } from '../src/shared/diagram/scenario'
import { dataScenarios, projectToDoc, readFlowmap } from '../src/shared/diagram/flowmap'
import type { ProjectData } from '../src/shared/diagram/types'
import { makeKho, silentLogger } from './helpers/kho'
import { sampleDoc, sampleText } from './helpers/sample'

let kho: ReturnType<typeof makeKho>
let ctx: DiagramContext
let projectId: number

const svc = () => ({
  project: createProjectService(ctx),
  node: createNodeService(ctx),
  group: createGroupService(ctx),
  link: createLinkService(ctx),
  scenario: createScenarioService(ctx),
  yaml: createYamlService(ctx)
})

const KEEP = { removeMissing: false }

function load(): ProjectData {
  return createProjectService(ctx).load(projectId)
}
const nodeByKey = (data: ProjectData, key: string) => data.nodes.find((n) => n.key === key)!
const scenarioByKey = (data: ProjectData, key: string) => data.scenarios.find((s) => s.key === key)!
const stepKeys = (data: ProjectData, key: string) => {
  const id = scenarioByKey(data, key).id
  const nodeKey = new Map(data.nodes.map((n) => [n.id, n.key]))
  return data.steps
    .filter((s) => s.scenarioId === id)
    .sort((a, b) => a.idx - b.idx)
    .map((s) => nodeKey.get(s.nodeId))
}
const code = (fn: () => unknown): string => {
  try {
    fn()
  } catch (e) {
    if (e instanceof DiagramError) return e.code
    throw e
  }
  return 'NO_ERROR'
}

beforeEach(() => {
  kho = makeKho()
  ctx = { db: kho.db, khoRoot: kho.root, logger: silentLogger }
  projectId = createProjectService(ctx).create('Thử nghiệm').id
})
afterEach(() => kho.cleanup())

function importSample() {
  return svc().yaml.apply(projectId, sampleText(), KEEP)
}

describe('yaml.apply of the sample', () => {
  it('creates 4 groups, 31 blocks, 37 channels, 9 scenarios with the layout of the file', () => {
    const { summary } = importSample()
    expect(summary.add).toEqual({ groups: 4, nodes: 31, links: 37, scenarios: 9 })
    const data = load()
    expect(data.groups).toHaveLength(4)
    expect(data.nodes).toHaveLength(31)
    expect(data.links).toHaveLength(37)
    expect(data.scenarios).toHaveLength(9)
    const layout = sampleDoc().layout
    for (const n of data.nodes) {
      expect([n.x, n.y], n.key).toEqual(layout[n.key])
      expect(n.hasLayout).toBe(true)
    }
    expect(data.images).toEqual([])
    expect(data.pins).toEqual([])
  })

  it('stores steps in order, scenario parents and fork points', () => {
    importSample()
    const data = load()
    expect(stepKeys(data, 'P-01')).toHaveLength(13)
    expect(stepKeys(data, 'N-05')).toEqual(['F9D', 'F9E', 'EFL'])
    const n05 = scenarioByKey(data, 'N-05')
    expect(n05.parentId).toBe(scenarioByKey(data, 'A-01').id)
    expect(n05.forkNodeId).toBe(nodeByKey(data, 'F9D').id)
    const path = fullPath(dataScenarios(data), n05.id)
    expect(path).toHaveLength(14)
    expect(path.at(-1)?.nodeId).toBe(nodeByKey(data, 'EFL').id)
  })

  it('fills search_norm without accents and keeps fs of the group on the block', () => {
    importSample()
    const row = kho.db
      .prepare("SELECT search_norm, fs_file FROM dg_nodes WHERE key = 'F8A'")
      .get() as { search_norm: string; fs_file: string }
    expect(row.search_norm).toContain('dang nhap singpass')
    expect(row.search_norm).not.toMatch(/[\u00c0-\u1ef9]/)
    expect(row.fs_file).toBe('[Agile] FS 08.docx')
  })

  it('a second import reports 0 add, 0 update, 0 remove', () => {
    importSample()
    const again = svc().yaml.preview(projectId, sampleText(), { removeMissing: true })
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.summary.unchanged).toBe(true)
    const applied = importSample()
    expect(applied.summary.unchanged).toBe(true)
    expect(load().nodes).toHaveLength(31)
  })

  it('rejects text with errors and writes nothing (FR-YM-02 step 1)', () => {
    const bad = sampleText().replace('to: F1A', 'to: NOPE')
    const preview = svc().yaml.preview(projectId, bad, KEEP)
    expect(preview.ok).toBe(false)
    expect(preview.issues.some((i) => i.code === 'REF_MISSING')).toBe(true)
    expect(code(() => svc().yaml.apply(projectId, bad, KEEP))).toBe('YAML_INVALID')
    expect(load().nodes).toHaveLength(0)
  })

  it('rolls back everything when it fails half way', () => {
    let calls = 0
    const flaky = createYamlService(ctx, {
      now: () => {
        if (++calls > 5) throw new Error('boom')
        return new Date()
      }
    })
    expect(() => flaky.apply(projectId, sampleText(), KEEP)).toThrow('boom')
    const data = load()
    expect(data.nodes).toHaveLength(0)
    expect(data.groups).toHaveLength(0)
    expect(data.links).toHaveLength(0)
    expect(data.scenarios).toHaveLength(0)
  })

  it('keeps hand placed positions when the file has no layout (BR-04, FR-YM-02 AC2)', () => {
    importSample()
    const f9c = nodeByKey(load(), 'F9C')
    svc().node.move([{ id: f9c.id, x: 5, y: 6 }])
    const edited = sampleText()
      .replace(/^layout:[\s\S]*$/m, '')
      .replace(
        'Gọi sổ cái Function 1 trừ tiền',
        'Nội dung mới từ YAML. Gọi sổ cái Function 1 trừ tiền'
      )
    const result = svc().yaml.apply(projectId, edited, KEEP)
    expect(result.summary.update.nodes).toBe(1)
    const after = nodeByKey(result.data, 'F9C')
    expect(after.body).toContain('Nội dung mới từ YAML.')
    expect([after.x, after.y]).toEqual([5, 6])
  })

  it('a file with layout moves the block', () => {
    importSample()
    const edited = sampleText().replace('F9C: [2440, 260]', 'F9C: [100, 200]')
    const result = svc().yaml.apply(projectId, edited, KEEP)
    expect(result.summary.update.nodes).toBe(1)
    const after = nodeByKey(result.data, 'F9C')
    expect([after.x, after.y]).toEqual([100, 200])
  })

  it('new blocks without coordinates wait on a 300 x 200 grid with has_layout = 0', () => {
    const text = `flowmap: 1
nodes:
  - { id: A, type: fnc, title: Một }
  - { id: B, type: fnc, title: Hai }
  - { id: C, type: fnc, title: Ba }
`
    const result = svc().yaml.apply(projectId, text, KEEP)
    const nodes = result.data.nodes
    expect(nodes.every((n) => !n.hasLayout)).toBe(true)
    expect(nodes.map((n) => [n.x, n.y])).toEqual([
      [0, 0],
      [300, 0],
      [600, 0]
    ])
    // a later import adds one more: it lands in the next cell, below nothing placed yet
    const more = text + '  - { id: D, type: fnc, title: Bốn }\n'
    const second = svc().yaml.apply(projectId, more, KEEP)
    expect(second.data.nodes.map((n) => [n.x, n.y])).toEqual([
      [0, 0],
      [300, 0],
      [600, 0],
      [900, 0]
    ])
  })

  it('removeMissing deletes the blocks that are not in the file, with their channels and steps', () => {
    importSample()
    const without = sampleText()
      .replace(/ {2}- id: ESK\n(?: {4}.*\n)+/, '')
      .replace(/ {2}ESK: \[.*\]\n/, '')
      .replace(/ {6}- \[ESK, .*\]\n/, '')
    const keepRun = svc().yaml.preview(projectId, without, KEEP)
    expect(keepRun.ok && keepRun.summary.remove.nodes).toBe(0)
    const run = svc().yaml.apply(projectId, without, { removeMissing: true })
    expect(run.summary.remove.nodes).toBe(1)
    expect(run.data.nodes).toHaveLength(30)
    expect(run.data.nodes.some((n) => n.key === 'ESK')).toBe(false)
    expect(stepKeys(run.data, 'N-01')).toEqual(['F1A'])
  })

  it('docs_root of the file is used only when the folder exists here', () => {
    // The sample names a real folder on the author's PC, so point it at one that exists nowhere.
    const text = sampleText().replace(/docs_root:.*$/m, 'docs_root: "/khong/ton/tai/o/dau/ca"')
    expect(text).toContain('/khong/ton/tai')
    svc().yaml.apply(projectId, text, KEEP)
    expect(load().project.docsRoot).toBeNull()
    const real = `flowmap: 1\nproject:\n  name: X\n  docs_root: ${JSON.stringify(kho.root)}\nnodes: []\n`
    svc().yaml.apply(projectId, real, KEEP)
    expect(load().project.docsRoot).toBe(kho.root)
  })
})

describe('yaml.export', () => {
  it('writes the file into xuat/ and importing it again reports 0 changes', () => {
    importSample()
    const out = svc().yaml.export(projectId)
    expect(out.file).toBe('xuat/thu-nghiem.flowmap.yaml')
    expect(existsSync(join(kho.root, out.file))).toBe(true)
    expect(readFileSync(join(kho.root, out.file), 'utf8')).toBe(out.text)
    const again = svc().yaml.preview(projectId, out.text, { removeMissing: true })
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.summary.unchanged).toBe(true)
  })

  it('an export imported into another project gives the same content', () => {
    importSample()
    const out = svc().yaml.export(projectId)
    const other = svc().project.create('Bản sao').id
    svc().yaml.apply(other, out.text, KEEP)
    const a = projectToDoc(load())
    const b = projectToDoc(svc().project.load(other))
    expect({ ...b, project: a.project }).toEqual(a)
  })

  it('keeps edits made after the import: a block, a channel and a scenario step', () => {
    importSample()
    const s = svc()
    const data = load()
    s.node.update(nodeByKey(data, 'F9C').id, { title: 'Trả bằng EA (sửa)', chips: ['Một', 'Hai'] })
    const created = s.link.create(projectId, {
      fromNode: nodeByKey(data, 'F9A').id,
      toNode: nodeByKey(data, 'F9C').id,
      via: 'call',
      label: 'Kênh thêm tay'
    })
    expect(created.key).toBe('F9A_F9C_call')
    const text = s.yaml.export(projectId).text
    const parsed = readFlowmap(text)
    expect(parsed.issues).toEqual([])
    expect(parsed.doc?.nodes.find((n) => n.id === 'F9C')?.chips).toEqual(['Một', 'Hai'])
    const again = s.yaml.preview(projectId, text, { removeMissing: true })
    if (again.ok) expect(again.summary.unchanged).toBe(true)
  })
})

describe('node service', () => {
  it('creates a block with a generated key, code = key, and a place on the grid', () => {
    const a = svc().node.create(projectId, { type: 'fnc', title: 'Một khối' })
    expect(a).toMatchObject({ key: 'F1', code: 'F1', hasLayout: false, x: 0, y: 0, subtype: null })
    const b = svc().node.create(projectId, { type: 'fnc', title: 'Khối nữa' })
    expect(b).toMatchObject({ key: 'F2', x: 300, y: 0 })
    const req = svc().node.create(projectId, { type: 'req', title: 'Yêu cầu' })
    expect(req.key).toBe('REQ1')
    const end = svc().node.create(projectId, { type: 'end', title: 'Xong' })
    expect(end.subtype).toBe('ok')
  })

  it('a block with coordinates is placed as given and has a layout (BR-04)', () => {
    const n = svc().node.create(projectId, {
      type: 'tech',
      subtype: 'database',
      title: 'Bảng',
      x: 12.5,
      y: -3
    })
    expect(n).toMatchObject({ x: 12.5, y: -3, hasLayout: true, subtype: 'database' })
  })

  it('placeholders go below the placed blocks', () => {
    svc().node.create(projectId, { type: 'fnc', title: 'Đã đặt', x: 100, y: 500 })
    const n = svc().node.create(projectId, { type: 'fnc', title: 'Chưa đặt' })
    expect([n.x, n.y]).toEqual([100, 700])
  })

  it('rejects bad input with a specific code', () => {
    const s = svc().node
    expect(code(() => s.create(projectId, { type: 'zzz', title: 'x' }))).toBe('ENUM_INVALID')
    expect(code(() => s.create(projectId, { type: 'fnc', title: '  ' }))).toBe('FIELD_REQUIRED')
    expect(code(() => s.create(projectId, { type: 'fnc' }))).toBe('FIELD_REQUIRED')
    expect(code(() => s.create(projectId, { type: 'fnc', title: 5 }))).toBe('INVALID_ARGUMENT')
    expect(code(() => s.create(projectId, { type: 'fnc', title: 'x'.repeat(81) }))).toBe(
      'FIELD_TOO_LONG'
    )
    expect(
      code(() => s.create(projectId, { type: 'fnc', title: 'x', body: 'b'.repeat(601) }))
    ).toBe('FIELD_TOO_LONG')
    expect(
      code(() =>
        s.create(projectId, { type: 'fnc', title: 'x', chips: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })
      )
    ).toBe('FIELD_TOO_LONG')
    expect(code(() => s.create(projectId, { type: 'tech', subtype: 'robot', title: 'x' }))).toBe(
      'ENUM_INVALID'
    )
    expect(code(() => s.create(projectId, { type: 'fnc', title: 'x', key: 'bad key' }))).toBe(
      'KEY_INVALID'
    )
    expect(code(() => s.create(projectId, { type: 'fnc', title: 'x', groupId: 999 }))).toBe(
      'GROUP_NOT_FOUND'
    )
    expect(code(() => s.create(99999, { type: 'fnc', title: 'x' }))).toBe('PROJECT_NOT_FOUND')
    s.create(projectId, { type: 'fnc', title: 'x', key: 'K1' })
    expect(code(() => s.create(projectId, { type: 'fnc', title: 'y', key: 'K1' }))).toBe(
      'KEY_DUPLICATE'
    )
  })

  it('update recomputes search_norm and checks the fields', () => {
    const n = svc().node.create(projectId, { type: 'fnc', title: 'Đăng nhập', fixText: 'Màn hình' })
    const updated = svc().node.update(n.id, { title: 'Thanh toán', chips: ['Cổng online'] })
    expect(updated.title).toBe('Thanh toán')
    const row = kho.db.prepare('SELECT search_norm FROM dg_nodes WHERE id = ?').get(n.id) as {
      search_norm: string
    }
    expect(row.search_norm).toBe('f1 thanh toan man hinh cong online')
    expect(code(() => svc().node.update(n.id, { title: '' }))).toBe('FIELD_REQUIRED')
    expect(code(() => svc().node.update(9999, { title: 'x' }))).toBe('NODE_NOT_FOUND')
  })

  it('move saves a batch and marks the blocks as laid out', () => {
    const a = svc().node.create(projectId, { type: 'fnc', title: 'A' })
    const b = svc().node.create(projectId, { type: 'fnc', title: 'B' })
    svc().node.move([
      { id: a.id, x: 10, y: 20 },
      { id: b.id, x: 30, y: 40 }
    ])
    const data = load()
    expect(data.nodes.map((n) => [n.x, n.y, n.hasLayout])).toEqual([
      [10, 20, true],
      [30, 40, true]
    ])
    expect(code(() => svc().node.move([{ id: a.id, x: Number.NaN, y: 0 }]))).toBe(
      'INVALID_ARGUMENT'
    )
  })

  it('setGroup moves blocks into a group and out again', () => {
    const g = svc().group.create(projectId, { title: 'Nhóm FS' })
    const n = svc().node.create(projectId, { type: 'fnc', title: 'A' })
    svc().node.setGroup([n.id], g.id)
    expect(load().nodes[0]?.groupId).toBe(g.id)
    svc().node.setGroup([n.id], null)
    expect(load().nodes[0]?.groupId).toBeNull()
  })
})

describe('deleting a block that scenarios walk through (FR-SUA-06)', () => {
  it('deleting F9D keeps A-01 contiguous, lists A-01, N-05, E-02, and N-05 becomes a root', () => {
    importSample()
    const before = load()
    const f9d = nodeByKey(before, 'F9D')
    const impact = svc().node.impact([f9d.id])
    expect(impact.map((s) => s.key)).toEqual(['A-01', 'N-05', 'E-02'])
    expect(load().nodes).toHaveLength(31) // impact writes nothing

    const result = svc().node.remove([f9d.id])
    expect(result.removed).toEqual([f9d.id])
    expect(result.affected.map((s) => s.key)).toEqual(['A-01', 'N-05', 'E-02'])
    expect(result.detached.map((s) => s.key)).toEqual(['N-05'])

    const data = load()
    expect(data.nodes).toHaveLength(30)
    // A-01 had F9B, F9C, F9D, F9E, EPD at idx 0..4
    expect(stepKeys(data, 'A-01')).toEqual(['F9B', 'F9C', 'F9E', 'EPD'])
    const idx = (key: string) =>
      data.steps.filter((s) => s.scenarioId === scenarioByKey(data, key).id).map((s) => s.idx)
    expect(idx('A-01')).toEqual([0, 1, 2, 3])
    // N-05 forked at F9D, so it is a root scenario with its remaining steps
    const n05 = scenarioByKey(data, 'N-05')
    expect(n05.parentId).toBeNull()
    expect(n05.forkNodeId).toBeNull()
    expect(stepKeys(data, 'N-05')).toEqual(['F9E', 'EFL'])
    expect(idx('N-05')).toEqual([0, 1])
    // E-02 still hangs from N-05 at F9E
    const e02 = scenarioByKey(data, 'E-02')
    expect(e02.parentId).toBe(n05.id)
    expect(e02.forkNodeId).toBe(nodeByKey(data, 'F9E').id)
    // the channels of F9D are gone
    expect(data.links.some((l) => l.fromNode === f9d.id || l.toNode === f9d.id)).toBe(false)
    expect(data.links).toHaveLength(37 - 6)
  })

  it('deleting a block no scenario uses affects nothing', () => {
    importSample()
    const f8c = nodeByKey(load(), 'F8C')
    const result = svc().node.remove([f8c.id])
    expect(result.affected).toEqual([])
    expect(result.detached).toEqual([])
  })

  it('removing several blocks at once renumbers every scenario', () => {
    importSample()
    const data = load()
    svc().node.remove([
      nodeByKey(data, 'F1A').id,
      nodeByKey(data, 'F3A').id,
      nodeByKey(data, 'EPD').id
    ])
    const after = load()
    for (const sc of after.scenarios) {
      const idx = after.steps.filter((s) => s.scenarioId === sc.id).map((s) => s.idx)
      expect(idx, sc.key).toEqual(idx.map((_, i) => i))
    }
    expect(stepKeys(after, 'P-01')).not.toContain('F1A')
  })

  it('removing a group with keepNodes false removes its blocks too', () => {
    importSample()
    const r9 = load().groups.find((g) => g.key === 'R9')!
    const result = svc().group.remove(r9.id, false)
    expect(result.removed).toHaveLength(5)
    expect(load().nodes).toHaveLength(26)
    expect(load().groups).toHaveLength(3)
  })

  it('removing a group with keepNodes true keeps them without a group', () => {
    importSample()
    const r9 = load().groups.find((g) => g.key === 'R9')!
    const result = svc().group.remove(r9.id, true)
    expect(result.removed).toEqual([])
    const data = load()
    expect(data.nodes).toHaveLength(31)
    expect(nodeByKey(data, 'F9C').groupId).toBeNull()
  })
})

describe('link service', () => {
  it('derives a key from the ends and the kind, with a counter for repeats', () => {
    const a = svc().node.create(projectId, { type: 'fnc', title: 'A' })
    const b = svc().node.create(projectId, { type: 'ext', title: 'B' })
    const one = svc().link.create(projectId, {
      fromNode: a.id,
      toNode: b.id,
      via: 'rest',
      label: 'Một'
    })
    const two = svc().link.create(projectId, {
      fromNode: a.id,
      toNode: b.id,
      via: 'rest',
      label: 'Hai'
    })
    expect([one.key, two.key]).toEqual(['F1_X1_rest', 'F1_X1_rest_2'])
    expect(one.sortOrder).toBeLessThan(two.sortOrder)
  })

  it('enforces FR-LK-03', () => {
    const start = svc().node.create(projectId, { type: 'start', title: 'S' })
    const fnc = svc().node.create(projectId, { type: 'fnc', title: 'F' })
    const req = svc().node.create(projectId, { type: 'req', title: 'R' })
    const end = svc().node.create(projectId, { type: 'end', title: 'E' })
    const note = svc().node.create(projectId, { type: 'note', title: 'N' })
    const c = (from: number, to: number, via: string) =>
      code(() => svc().link.create(projectId, { fromNode: from, toNode: to, via }))
    expect(c(fnc.id, fnc.id, 'call')).toBe('LINK_SELF')
    expect(c(fnc.id, start.id, 'ui')).toBe('LINK_RULE')
    expect(c(fnc.id, req.id, 'ui')).toBe('LINK_RULE')
    expect(c(end.id, fnc.id, 'ui')).toBe('LINK_RULE')
    expect(c(note.id, fnc.id, 'ui')).toBe('LINK_RULE')
    expect(c(fnc.id, note.id, 'ui')).toBe('LINK_RULE')
    expect(c(fnc.id, end.id, 'impl')).toBe('LINK_RULE')
    expect(c(req.id, fnc.id, 'impl')).toBe('NO_ERROR')
    expect(c(start.id, fnc.id, 'ui')).toBe('NO_ERROR')
    expect(c(fnc.id, fnc.id + 999, 'ui')).toBe('NODE_NOT_FOUND')
    expect(c(fnc.id, end.id, 'grpc')).toBe('ENUM_INVALID')
  })

  it('update revalidates and remove deletes', () => {
    const a = svc().node.create(projectId, { type: 'fnc', title: 'A' })
    const b = svc().node.create(projectId, { type: 'fnc', title: 'B' })
    const l = svc().link.create(projectId, { fromNode: a.id, toNode: b.id, via: 'call' })
    expect(svc().link.update(l.id, { label: 'Nhãn' }).label).toBe('Nhãn')
    expect(code(() => svc().link.update(l.id, { toNode: a.id }))).toBe('LINK_SELF')
    expect(code(() => svc().link.update(l.id, { label: 'x'.repeat(81) }))).toBe('FIELD_TOO_LONG')
    expect(code(() => svc().link.update(l.id, { note: 'x'.repeat(301) }))).toBe('FIELD_TOO_LONG')
    svc().link.remove([l.id])
    expect(load().links).toEqual([])
    expect(code(() => svc().link.remove([l.id]))).toBe('LINK_NOT_FOUND')
  })
})

describe('scenario service', () => {
  it('creates a positive scenario and a valid branch, with keys such as P-01', () => {
    const a = svc().node.create(projectId, { type: 'start', title: 'A' })
    const b = svc().node.create(projectId, { type: 'fnc', title: 'B' })
    const c = svc().node.create(projectId, { type: 'end', title: 'C' })
    const pos = svc().scenario.create(projectId, {
      type: 'pos',
      title: 'Chính',
      steps: [{ nodeId: a.id }, { nodeId: b.id, note: 'xử lý' }, { nodeId: c.id }]
    })
    expect(pos.scenario.key).toBe('P-01')
    expect(pos.steps.map((s) => s.idx)).toEqual([0, 1, 2])
    const neg = svc().scenario.create(projectId, {
      type: 'neg',
      title: 'Nhánh',
      parentId: pos.scenario.id,
      forkNodeId: b.id,
      steps: [{ nodeId: b.id }, { nodeId: c.id }]
    })
    expect(neg.scenario).toMatchObject({ key: 'N-01', parentId: pos.scenario.id, forkNodeId: b.id })
    expect(svc().scenario.create(projectId, { type: 'pos', title: 'Hai' }).scenario.key).toBe(
      'P-02'
    )
  })

  it('enforces BR-06 to BR-08 on create, update and setSteps', () => {
    const a = svc().node.create(projectId, { type: 'start', title: 'A' })
    const b = svc().node.create(projectId, { type: 'fnc', title: 'B' })
    const c = svc().node.create(projectId, { type: 'end', title: 'C' })
    const x = svc().node.create(projectId, { type: 'fnc', title: 'X' })
    const pos = svc().scenario.create(projectId, {
      type: 'pos',
      title: 'Chính',
      steps: [{ nodeId: a.id }, { nodeId: b.id }, { nodeId: c.id }]
    })
    const make = (extra: object) =>
      code(() => svc().scenario.create(projectId, { type: 'neg', title: 'N', ...extra }))
    // BR-06: fork not on the path of the parent
    expect(make({ parentId: pos.scenario.id, forkNodeId: x.id, steps: [{ nodeId: x.id }] })).toBe(
      'SCENARIO_RULE'
    )
    // a branch without a fork point
    expect(make({ parentId: pos.scenario.id, steps: [{ nodeId: b.id }] })).toBe('SCENARIO_RULE')
    // BR-08: first step is not the fork point
    expect(make({ parentId: pos.scenario.id, forkNodeId: b.id, steps: [{ nodeId: c.id }] })).toBe(
      'SCENARIO_RULE'
    )
    // a fork without a parent
    expect(make({ forkNodeId: b.id })).toBe('SCENARIO_RULE')
    expect(make({ parentId: 9999, forkNodeId: b.id })).toBe('SCENARIO_NOT_FOUND')
    expect(make({ steps: [{ nodeId: 9999 }] })).toBe('NODE_NOT_FOUND')

    const branch = svc().scenario.create(projectId, {
      type: 'neg',
      title: 'Nhánh',
      parentId: pos.scenario.id,
      forkNodeId: b.id,
      steps: [{ nodeId: b.id }]
    })
    // BR-07: the parent cannot hang below its own branch
    expect(
      code(() =>
        svc().scenario.update(pos.scenario.id, { parentId: branch.scenario.id, forkNodeId: b.id })
      )
    ).toBe('SCENARIO_RULE')
    expect(
      code(() =>
        svc().scenario.update(pos.scenario.id, { parentId: pos.scenario.id, forkNodeId: b.id })
      )
    ).toBe('SCENARIO_RULE')
    // setSteps: the branch must still start at its fork point
    expect(code(() => svc().scenario.setSteps(branch.scenario.id, [{ nodeId: c.id }]))).toBe(
      'SCENARIO_RULE'
    )
    // setSteps on the parent must keep the fork point of the branch on its path
    expect(
      code(() => svc().scenario.setSteps(pos.scenario.id, [{ nodeId: a.id }, { nodeId: c.id }]))
    ).toBe('SCENARIO_RULE')
    expect(
      svc().scenario.setSteps(pos.scenario.id, [{ nodeId: a.id }, { nodeId: b.id }])
    ).toHaveLength(2)
    // title and type edits are free
    expect(
      svc().scenario.update(branch.scenario.id, { title: 'Đổi tên', type: 'alt' })
    ).toMatchObject({ title: 'Đổi tên', type: 'alt' })
  })

  it('remove with cascade deletes the scenario and all branches below it', () => {
    importSample()
    const a01 = scenarioByKey(load(), 'A-01')
    const result = svc().scenario.remove(a01.id, 'cascade')
    expect(result.removed).toHaveLength(3)
    const data = load()
    expect(data.scenarios.map((s) => s.key)).not.toContain('N-05')
    expect(data.scenarios.map((s) => s.key)).not.toContain('E-02')
    expect(data.scenarios).toHaveLength(6)
    // steps of the deleted scenarios are gone too
    expect(data.steps.every((s) => data.scenarios.some((x) => x.id === s.scenarioId))).toBe(true)
  })

  it('remove with promote lifts the branches to the parent and keeps their paths (FR-KB-07)', () => {
    importSample()
    const before = load()
    const paths = (data: ProjectData, key: string) =>
      fullPath(dataScenarios(data), scenarioByKey(data, key).id).map((s) => s.nodeId)
    const n05Path = paths(before, 'N-05')
    const e02Path = paths(before, 'E-02')
    const result = svc().scenario.remove(scenarioByKey(before, 'A-01').id, 'promote')
    expect(result.removed).toHaveLength(1)
    expect(result.promoted.map((s) => s.key)).toEqual(['N-05'])
    const data = load()
    const n05 = scenarioByKey(data, 'N-05')
    expect(n05.parentId).toBe(scenarioByKey(data, 'P-01').id)
    expect(n05.forkNodeId).toBe(nodeByKey(data, 'F9B').id)
    expect(paths(data, 'N-05')).toEqual(n05Path)
    expect(paths(data, 'E-02')).toEqual(e02Path)
    expect(stepKeys(data, 'N-05')).toEqual(['F9B', 'F9C', 'F9D', 'F9E', 'EFL'])
  })

  it('promoting the branches of a root scenario makes them roots with the whole path', () => {
    importSample()
    const before = load()
    const n02Path = fullPath(dataScenarios(before), scenarioByKey(before, 'N-02').id).map(
      (s) => s.nodeId
    )
    svc().scenario.remove(scenarioByKey(before, 'P-01').id, 'promote')
    const data = load()
    const n02 = scenarioByKey(data, 'N-02')
    expect(n02.parentId).toBeNull()
    expect(fullPath(dataScenarios(data), n02.id).map((s) => s.nodeId)).toEqual(n02Path)
    expect(data.scenarios).toHaveLength(8)
  })
})

describe('project.load and the dev seed', () => {
  it('load returns every table', () => {
    importSample()
    const data = load()
    expect(data.groups).toHaveLength(4)
    expect(data.nodes).toHaveLength(31)
    expect(data.links).toHaveLength(37)
    expect(data.scenarios).toHaveLength(9)
    expect(data.steps.length).toBe(13 + 2 + 2 + 2 + 3 + 2 + 5 + 3 + 2)
    expect(data.settings).toEqual({ channelMode: 'one', playImages: true, theme: 'dark' })
  })

  it('MAPAPP_SEED creates "MOE Education Account" once', () => {
    const sample = findSampleFile(join(__dirname, '..'))
    expect(sample).not.toBeNull()
    const id = seedSampleProject(ctx, sample!)
    expect(id).not.toBeNull()
    const project = createProjectService(ctx).load(id!)
    expect(project.project.name).toBe(SEED_PROJECT_NAME)
    expect(project.nodes).toHaveLength(31)
    expect(project.links).toHaveLength(37)
    expect(project.scenarios).toHaveLength(9)
    expect(project.groups).toHaveLength(4)
    expect(seedSampleProject(ctx, sample!)).toBeNull()
    expect(createProjectService(ctx).list()).toHaveLength(2)
  })
})
