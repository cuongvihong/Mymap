import { describe, expect, it } from 'vitest'
import {
  buildErrorReport,
  buildPrompt,
  parseFlowmap,
  planMerge,
  readFlowmap,
  serializeFlowmap,
  summarize,
  validateFlowmap
} from '../src/shared/diagram/flowmap'
import type { FlowmapDoc } from '../src/shared/diagram/types'
import { emptyDoc, sampleDoc, sampleText } from './helpers/sample'

const clone = (doc: FlowmapDoc): FlowmapDoc => JSON.parse(JSON.stringify(doc)) as FlowmapDoc
const keepAll = { removeMissing: false }

describe('the sample file', () => {
  it('has 4 groups, 31 blocks, 37 channels, 9 scenarios and a layout for every block', () => {
    const doc = sampleDoc()
    expect(doc.groups).toHaveLength(4)
    expect(doc.nodes).toHaveLength(31)
    expect(doc.links).toHaveLength(37)
    expect(doc.scenarios).toHaveLength(9)
    expect(Object.keys(doc.layout)).toHaveLength(31)
    expect(doc.project.name).toBe('MOE Education Account')
  })

  it('derives distinct ids for two channels with the same ends and kind', () => {
    const redirects = sampleDoc().links.filter((l) => l.from === 'F8A' && l.to === 'SGP')
    expect(redirects.map((l) => l.id)).toEqual(['F8A_SGP_redirect', 'F8A_SGP_redirect_2'])
  })

  it('fills in code and the file of the group', () => {
    const f9c = sampleDoc().nodes.find((n) => n.id === 'F9C')
    expect(f9c?.code).toBe('R9 · F9.4')
    expect(f9c?.fs).toBe('[Agile] FS 09.docx')
    const stp = sampleDoc().nodes.find((n) => n.id === 'STP')
    expect(stp?.fs).toBe('[Agile] FS 08.docx')
  })
})

describe('serialize', () => {
  it('serialize then parse gives the same document as the sample', () => {
    const doc = sampleDoc()
    const text = serializeFlowmap(doc)
    const again = readFlowmap(text)
    expect(again.issues).toEqual([])
    expect(again.doc).toEqual(doc)
  })

  it('writes keys in the fixed order of TDD 6.2', () => {
    const text = serializeFlowmap(sampleDoc())
    const top = [...text.matchAll(/^([a-z]+):/gm)].map((m) => m[1])
    expect(top).toEqual(['flowmap', 'project', 'groups', 'nodes', 'links', 'scenarios', 'layout'])
    const f9c = text.slice(text.indexOf('  - id: F9C'))
    const order = [...f9c.split('\n  - id:')[0]!.matchAll(/^ {4}([a-z]+):/gm)].map((m) => m[1])
    expect(order).toEqual(['type', 'group', 'code', 'title', 'body', 'fix', 'chips', 'section'])
  })

  it('leaves out fs when it equals the file of the group, and code when it equals the id', () => {
    const text = serializeFlowmap(sampleDoc())
    const f9c = text.slice(text.indexOf('  - id: F9C'), text.indexOf('  - id: STP'))
    expect(f9c).not.toContain('fs:')
    expect(text).toMatch(/- id: GOV[\s\S]*?fs: "?\[Agile\] FS R1V1\.0\.docx"?/)
    expect(text).not.toMatch(/code: STP/)
  })

  it('quotes what needs quoting and survives hard strings', () => {
    const doc = clone(sampleDoc())
    const node = doc.nodes[0]!
    node.title = 'Tiêu đề: có dấu hai chấm, dấu phẩy # và "nháy"'
    node.body = 'Dòng một\nDòng hai\tcó tab'
    node.chips = ['a, b', '[x]', 'true', '123', '']
    node.section = '§1 - mục'
    doc.scenarios[0]!.steps[0]!.note = 'note, có [ngoặc] và {móc}'
    const again = readFlowmap(serializeFlowmap(doc))
    expect(again.issues).toEqual([])
    expect(again.doc).toEqual(doc)
  })

  it('writes an explicit id only for a channel whose id is not the derived one', () => {
    const doc = clone(sampleDoc())
    doc.links[0]!.id = 'L-custom'
    const text = serializeFlowmap(doc)
    expect(text.match(/^ {2}- id: /gm)?.length).toBeGreaterThan(0)
    expect(text).toContain('  - id: L-custom\n    from: JOB')
    const again = readFlowmap(text)
    expect(again.doc).toEqual(doc)
  })

  it('round trips a project with no groups, no links and no layout', () => {
    const doc: FlowmapDoc = {
      ...emptyDoc(),
      project: { name: 'Trống', docsRoot: 'D:\\Tài liệu\\FS' },
      nodes: [
        {
          id: 'A',
          type: 'fnc',
          subtype: null,
          group: null,
          code: 'A',
          title: 'Một khối',
          body: '',
          fix: '',
          chips: [],
          fs: null,
          section: null
        }
      ]
    }
    const again = readFlowmap(serializeFlowmap(doc))
    expect(again.issues).toEqual([])
    expect(again.doc).toEqual(doc)
  })

  it('an empty scenario and steps without notes round trip', () => {
    const doc = clone(sampleDoc())
    doc.scenarios.push({
      id: 'Z-1',
      type: 'edge',
      title: 'Rỗng',
      parent: null,
      at: null,
      steps: []
    })
    doc.scenarios[0]!.steps[1]!.note = ''
    expect(readFlowmap(serializeFlowmap(doc)).doc).toEqual(doc)
  })
})

describe('planMerge (TDD 6.5)', () => {
  it('importing the sample into an empty project adds 31 blocks, 37 channels, 9 scenarios', () => {
    const plan = planMerge(emptyDoc(), sampleDoc(), keepAll)
    expect(plan.add.groups).toHaveLength(4)
    expect(plan.add.nodes).toHaveLength(31)
    expect(plan.add.links).toHaveLength(37)
    expect(plan.add.scenarios).toHaveLength(9)
    expect(Object.keys(plan.layout)).toHaveLength(31)
    const s = summarize(plan)
    expect(s.unchanged).toBe(false)
    expect(s.add).toEqual({ groups: 4, nodes: 31, links: 37, scenarios: 9 })
  })

  it('a second import is 0 add, 0 update, 0 remove (FR-YM-02 AC1)', () => {
    const doc = sampleDoc()
    const plan = planMerge(clone(doc), doc, { removeMissing: true })
    const s = summarize(plan)
    expect(s.add).toEqual({ groups: 0, nodes: 0, links: 0, scenarios: 0 })
    expect(s.update).toEqual({ groups: 0, nodes: 0, links: 0, scenarios: 0 })
    expect(s.remove).toEqual({ groups: 0, nodes: 0, links: 0, scenarios: 0 })
    expect(s.keep.nodes).toBe(31)
    expect(s.unchanged).toBe(true)
    expect(plan.layout).toEqual({})
  })

  it('changing the body of one block is 1 update and the position stays', () => {
    const current = sampleDoc()
    const incoming = clone(current)
    incoming.nodes.find((n) => n.id === 'F9C')!.body = 'Nội dung đã sửa.'
    incoming.layout = {} // a file without layout
    const plan = planMerge(current, incoming, keepAll)
    expect(plan.update.nodes).toHaveLength(1)
    expect(plan.update.nodes[0]).toMatchObject({ id: 'F9C', fields: ['body'] })
    expect(plan.layout).toEqual({})
    expect(summarize(plan).update).toEqual({ groups: 0, nodes: 1, links: 0, scenarios: 0 })
  })

  it('a file without layout never counts as a position change (FR-YM-02 AC2)', () => {
    const current = sampleDoc()
    current.layout['F9C'] = [999, 999] // dragged by hand
    const incoming = clone(sampleDoc())
    incoming.layout = {}
    const plan = planMerge(current, incoming, keepAll)
    expect(summarize(plan).unchanged).toBe(true)
  })

  it('adding layout for a block changes its coordinates', () => {
    const current = sampleDoc()
    const incoming = clone(current)
    incoming.layout['F9C'] = [100, 200]
    const plan = planMerge(current, incoming, keepAll)
    expect(plan.update.nodes).toEqual([expect.objectContaining({ id: 'F9C', fields: ['layout'] })])
    expect(plan.layout).toEqual({ F9C: [100, 200] })
  })

  it('a block that has no coordinates yet takes them from the file', () => {
    const current = sampleDoc()
    delete current.layout['F9C'] // has_layout = 0 in the database
    const plan = planMerge(current, sampleDoc(), keepAll)
    expect(plan.layout).toEqual({ F9C: [2440, 260] })
    expect(plan.update.nodes.map((c) => c.id)).toEqual(['F9C'])
  })

  it('new blocks in a file without layout get no coordinates', () => {
    const incoming = clone(sampleDoc())
    incoming.layout = {}
    const plan = planMerge(emptyDoc(), incoming, keepAll)
    expect(plan.add.nodes).toHaveLength(31)
    expect(plan.layout).toEqual({})
  })

  it('remove is empty unless the box is ticked', () => {
    const current = sampleDoc()
    const incoming = clone(current)
    incoming.nodes = incoming.nodes.filter((n) => n.id !== 'ESK')
    incoming.links = incoming.links.filter((l) => l.from !== 'ESK' && l.to !== 'ESK')
    delete incoming.layout['ESK']
    expect(planMerge(current, incoming, keepAll).remove.nodes).toEqual([])
    expect(planMerge(current, incoming, { removeMissing: true }).remove.nodes).toEqual(['ESK'])
    expect(planMerge(current, incoming, { removeMissing: false }).keep.nodes).toHaveLength(30)
  })

  it('detects changes in channels, scenario steps and groups', () => {
    const current = sampleDoc()
    const incoming = clone(current)
    incoming.links[0]!.label = 'Nhãn mới'
    incoming.scenarios[0]!.steps[0]!.note = 'Ghi chú bước mới'
    incoming.groups[0]!.title = 'Tên nhóm mới'
    const plan = planMerge(current, incoming, keepAll)
    expect(plan.update.links[0]?.fields).toEqual(['label'])
    expect(plan.update.scenarios[0]?.fields).toEqual(['steps'])
    expect(plan.update.groups[0]?.fields).toEqual(['title'])
  })
})

describe('prompt', () => {
  it('contains the rules, the value table and an example with 3 blocks, 3 channels, 1 scenario', () => {
    const text = buildPrompt()
    expect(text).toContain('Bạn là BA.')
    expect(text).toContain('Cần thống nhất:')
    expect(text).toContain('nodes[].type: fnc, req, tech, ext, start, end, cond, note')
    const example = text.slice(text.indexOf('flowmap: 1'))
    const parsed = readFlowmap(example)
    expect(parsed.issues).toEqual([])
    expect(parsed.doc?.nodes).toHaveLength(3)
    expect(parsed.doc?.links).toHaveLength(3)
    expect(parsed.doc?.scenarios).toHaveLength(1)
  })

  it('the example uses content that is in the sample', () => {
    const sample = sampleDoc()
    const example = readFlowmap(buildPrompt().slice(buildPrompt().indexOf('flowmap: 1'))).doc!
    for (const n of example.nodes) {
      expect(sample.nodes.find((s) => s.id === n.id)).toEqual(n)
    }
  })

  it('builds the error report for the AI', () => {
    const issues = validateFlowmap(parseFlowmap('flowmap: 2\n')).map((i) => i.message)
    const report = buildErrorReport(issues)
    expect(report).toContain('còn 1 lỗi')
    expect(report).toContain(issues[0]!)
  })

  it('sample text is untouched by the tests', () => {
    expect(sampleText()).toContain('flowmap: 1')
  })
})
