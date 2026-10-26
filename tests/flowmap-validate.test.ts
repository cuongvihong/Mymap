import { describe, expect, it } from 'vitest'
import { parseFlowmap, readFlowmap, validateFlowmap } from '../src/shared/diagram/flowmap'
import { FLOWMAP_ISSUE_CODES, type FlowmapIssueCode } from '../src/shared/diagram/types'
import { sampleText } from './helpers/sample'

const BASE = `flowmap: 1
groups:
  - id: G1
    title: Nhóm
nodes:
  - id: A
    type: start
    title: Bắt đầu
  - id: B
    type: fnc
    group: G1
    title: Hàm B
  - id: C
    type: end
    subtype: ok
    title: Xong
links:
  - { from: A, to: B, via: ui }
  - { from: B, to: C, via: ui }
scenarios:
  - id: P-01
    type: pos
    title: Chính
    steps:
      - [A, mở]
      - [B, xử lý]
      - [C, xong]
`

const check = (text: string) => validateFlowmap(parseFlowmap(text))
const errors = (text: string) => check(text).filter((i) => i.severity === 'error')
const swap = (from: string, to: string) => {
  expect(BASE).toContain(from)
  return BASE.replace(from, to)
}
const at = (text: string, code: FlowmapIssueCode) => {
  const found = check(text).filter((i) => i.code === code)
  expect(
    found.length,
    `expected ${code}, got ${JSON.stringify(check(text).map((i) => i.code))}`
  ).toBeGreaterThan(0)
  return found[0]!
}

describe('validate: the base text and the sample', () => {
  it('the base text has no issue', () => {
    expect(check(BASE)).toEqual([])
  })

  it('the sample file has 0 errors and 0 warnings', () => {
    expect(check(sampleText())).toEqual([])
  })

  it('every code of TDD 6.4 is listed', () => {
    expect([...FLOWMAP_ISSUE_CODES].sort()).toEqual(
      [
        'ENUM',
        'ID_DUPLICATE',
        'ID_FORMAT',
        'LENGTH',
        'LINK_RULE',
        'LINK_SELF',
        'REF_MISSING',
        'REQUIRED',
        'SCN_CYCLE',
        'SCN_FORK',
        'UNKNOWN_KEY',
        'VERSION',
        'YAML_SYNTAX'
      ].sort()
    )
  })
})

describe('validate: one case per error code, with line and column', () => {
  it('YAML_SYNTAX: bad indent points at the broken line', () => {
    const issue = at('flowmap: 1\nnodes:\n  - id: A\n   type: fnc\n', 'YAML_SYNTAX')
    expect(issue.severity).toBe('error')
    expect(issue.line).toBe(4)
    expect(issue.message).toMatch(/^dòng 4, cột \d+: /)
  })

  it('YAML_SYNTAX: a key written twice', () => {
    const issue = at('flowmap: 1\nnodes:\n  - id: A\n    id: B\n', 'YAML_SYNTAX')
    expect(issue.line).toBe(4)
    expect(issue.col).toBe(5)
  })

  it('VERSION: missing line points at the start of the file', () => {
    const issue = at('nodes: []\n', 'VERSION')
    expect([issue.line, issue.col]).toEqual([1, 1])
  })

  it('VERSION: a number other than 1 points at the value', () => {
    const issue = at('flowmap: 2\n', 'VERSION')
    expect([issue.line, issue.col]).toEqual([1, 10])
  })

  it('REQUIRED: a block without title points at the block', () => {
    const issue = at(swap('    title: Hàm B\n', ''), 'REQUIRED')
    expect([issue.line, issue.col]).toEqual([9, 5])
    expect(issue.path).toBe('nodes[1]')
    expect(issue.message).toContain('"title"')
  })

  it('REQUIRED: a channel without via', () => {
    const issue = at(swap('{ from: A, to: B, via: ui }', '{ from: A, to: B }'), 'REQUIRED')
    expect([issue.line, issue.col]).toEqual([18, 5])
    expect(issue.path).toBe('links[0]')
  })

  it('REQUIRED: a scenario without steps', () => {
    const text = swap('    steps:\n      - [A, mở]\n      - [B, xử lý]\n      - [C, xong]\n', '')
    const issue = at(text, 'REQUIRED')
    expect(issue.path).toBe('scenarios[0]')
    expect([issue.line, issue.col]).toEqual([21, 5])
  })

  it('REQUIRED: a block of type end needs a subtype', () => {
    const issue = at(swap('    subtype: ok\n', ''), 'REQUIRED')
    expect(issue.path).toBe('nodes[2]')
    expect(issue.message).toContain('subtype')
  })

  it('ID_FORMAT: a space in an id points at the id', () => {
    const issue = at(swap('  - id: B\n', '  - id: "B 2"\n'), 'ID_FORMAT')
    expect([issue.line, issue.col]).toEqual([9, 9])
    expect(issue.path).toBe('nodes[1].id')
  })

  it('ID_DUPLICATE: the second use is reported', () => {
    const issue = at(swap('  - id: C\n', '  - id: A\n'), 'ID_DUPLICATE')
    expect([issue.line, issue.col]).toEqual([13, 9])
    expect(issue.message).toContain('nodes[0]')
  })

  it('ENUM: an unknown block type', () => {
    const issue = at(swap('    type: fnc\n', '    type: function\n'), 'ENUM')
    expect([issue.line, issue.col]).toEqual([10, 11])
  })

  it('ENUM: a subtype that does not belong to the type', () => {
    const issue = at(swap('    type: start\n', '    type: start\n    subtype: robot\n'), 'ENUM')
    expect(issue.path).toBe('nodes[0].subtype')
  })

  it('ENUM: an unknown via', () => {
    const issue = at(swap('{ from: A, to: B, via: ui }', '{ from: A, to: B, via: grpc }'), 'ENUM')
    expect(issue.path).toBe('links[0].via')
  })

  it('REF_MISSING: the example of TDD 6.4, a link to an undeclared block', () => {
    const issue = at(
      swap('{ from: A, to: B, via: ui }', '{ from: A, to: FNC-09, via: ui }'),
      'REF_MISSING'
    )
    expect(issue.path).toBe('links[0].to')
    expect([issue.line, issue.col]).toEqual([18, 20])
    expect(issue.message).toBe(
      'dòng 18, cột 20: links[0].to trỏ tới "FNC-09" chưa được khai báo trong nodes'
    )
  })

  it('REF_MISSING: group, step and parent', () => {
    expect(at(swap('    group: G1\n', '    group: G9\n'), 'REF_MISSING').path).toBe(
      'nodes[1].group'
    )
    expect(at(swap('      - [B, xử lý]', '      - [ZZ, xử lý]'), 'REF_MISSING').path).toBe(
      'scenarios[0].steps[1][0]'
    )
    const withParent = swap('    title: Chính\n', '    title: Chính\n    parent: P-99\n    at: A\n')
    expect(at(withParent, 'REF_MISSING').path).toBe('scenarios[0].parent')
  })

  it('REF_MISSING: a layout entry for a block that does not exist', () => {
    const issue = at(BASE + 'layout:\n  Z: [1, 2]\n', 'REF_MISSING')
    expect(issue.path).toBe('layout.Z')
    expect(issue.line).toBe(29)
  })

  it('LINK_SELF', () => {
    const issue = at(
      swap('{ from: A, to: B, via: ui }', '{ from: B, to: B, via: ui }'),
      'LINK_SELF'
    )
    expect(issue.path).toBe('links[0].to')
    expect(issue.line).toBe(18)
  })

  it('LINK_RULE: into a Start block', () => {
    const issue = at(
      swap('{ from: A, to: B, via: ui }', '{ from: B, to: A, via: ui }'),
      'LINK_RULE'
    )
    expect(issue.path).toBe('links[0].to')
    expect(issue.message).toContain('Start')
  })

  it('LINK_RULE: out of an End block', () => {
    const issue = at(
      swap('{ from: B, to: C, via: ui }', '{ from: C, to: B, via: ui }'),
      'LINK_RULE'
    )
    expect(issue.path).toBe('links[1].from')
  })

  it('LINK_RULE: into a REQ block and via impl from a non REQ block', () => {
    const withReq = swap(
      '  - id: C\n',
      '  - id: R\n    type: req\n    title: Yêu cầu\n  - id: C\n'
    ).replace('{ from: B, to: C, via: ui }', '{ from: B, to: R, via: ui }')
    expect(at(withReq, 'LINK_RULE').path).toBe('links[1].to')
    const impl = swap('{ from: B, to: C, via: ui }', '{ from: B, to: C, via: impl }')
    expect(at(impl, 'LINK_RULE').path).toBe('links[1].via')
  })

  it('LINK_RULE: a Note block takes no channel', () => {
    const withNote = swap(
      '  - id: C\n',
      '  - id: N\n    type: note\n    title: Ghi chú\n  - id: C\n'
    ).replace('{ from: B, to: C, via: ui }', '{ from: B, to: N, via: ui }')
    expect(at(withNote, 'LINK_RULE').path).toBe('links[1].to')
  })

  const branch = (extra: string) =>
    `  - id: Q-01\n    type: neg\n    title: Nhánh\n${extra}    steps:\n      - [B, rẽ]\n      - [C, hỏng]\n`

  it('SCN_CYCLE: two scenarios that are each other parent', () => {
    const text =
      BASE.replace('    title: Chính\n', '    title: Chính\n    parent: Q-01\n    at: B\n') +
      branch('    parent: P-01\n    at: B\n')
    const issue = at(text, 'SCN_CYCLE')
    expect(issue.path).toBe('scenarios[0].parent')
    expect(issue.line).toBe(24)
    // one issue per loop, not one per member
    expect(check(text).filter((i) => i.code === 'SCN_CYCLE')).toHaveLength(1)
  })

  it('SCN_FORK: the fork point is not on the path of the parent (BR-06)', () => {
    const good = BASE + branch('    parent: P-01\n    at: B\n')
    expect(errors(good)).toEqual([])
    const bad = BASE.replace('      - [B, xử lý]\n', '') + branch('    parent: P-01\n    at: B\n')
    const issue = at(bad, 'SCN_FORK')
    expect(issue.path).toBe('scenarios[1].at')
  })

  it('SCN_FORK: the first step is not the fork point (BR-08)', () => {
    const text =
      BASE +
      `  - id: Q-01\n    type: neg\n    parent: P-01\n    at: B\n    title: Nhánh\n    steps:\n      - [C, sai]\n`
    const issue = at(text, 'SCN_FORK')
    expect(issue.path).toBe('scenarios[1].steps[0]')
    expect(issue.line).toBe(34)
  })

  it('SCN_FORK: a branch without at', () => {
    const text =
      BASE +
      `  - id: Q-01\n    type: neg\n    parent: P-01\n    title: Nhánh\n    steps:\n      - [B, rẽ]\n`
    expect(at(text, 'SCN_FORK').message).toContain('"at"')
  })

  it('LENGTH: title over 80 characters', () => {
    const issue = at(swap('    title: Hàm B\n', `    title: ${'x'.repeat(81)}\n`), 'LENGTH')
    expect(issue.path).toBe('nodes[1].title')
    expect([issue.line, issue.col]).toEqual([12, 12])
  })

  it('LENGTH: seven chips and a long chip', () => {
    const seven = swap('    title: Hàm B\n', '    title: Hàm B\n    chips: [a, b, c, d, e, f, g]\n')
    expect(at(seven, 'LENGTH').path).toBe('nodes[1].chips')
    const longChip = swap(
      '    title: Hàm B\n',
      `    title: Hàm B\n    chips: ["${'c'.repeat(25)}"]\n`
    )
    expect(at(longChip, 'LENGTH').path).toBe('nodes[1].chips[0]')
  })

  it('LENGTH: channel label and note, block body and fix', () => {
    const label = swap(
      '{ from: A, to: B, via: ui }',
      `{ from: A, to: B, via: ui, label: "${'l'.repeat(81)}" }`
    )
    expect(at(label, 'LENGTH').path).toBe('links[0].label')
    const body = swap('    title: Hàm B\n', `    title: Hàm B\n    body: "${'b'.repeat(601)}"\n`)
    expect(at(body, 'LENGTH').path).toBe('nodes[1].body')
    const fix = swap('    title: Hàm B\n', `    title: Hàm B\n    fix: "${'f'.repeat(201)}"\n`)
    expect(at(fix, 'LENGTH').path).toBe('nodes[1].fix')
  })

  it('UNKNOWN_KEY is a warning that does not block the import', () => {
    const text = swap('    title: Hàm B\n', '    title: Hàm B\n    mau: do\n')
    const issue = at(text, 'UNKNOWN_KEY')
    expect(issue.severity).toBe('warning')
    expect([issue.line, issue.col]).toEqual([13, 5])
    const read = readFlowmap(text)
    expect(read.doc).not.toBeNull()
    expect(read.issues).toHaveLength(1)
  })
})

describe('validate: forgiving input', () => {
  it('steps as objects and as arrays give the same document', () => {
    const asObject = BASE.replace(/ {6}- \[(\w), ([^\]]+)\]/g, '      - { node: $1, note: $2 }')
    const a = readFlowmap(BASE).doc
    const b = readFlowmap(asObject).doc
    expect(a).not.toBeNull()
    expect(b).toEqual(a)
  })

  it('a note with commas in a flow step is joined back, as in the example of TDD 6.2', () => {
    const text = BASE.replace('[B, xử lý]', '[B, Số dư 20.00, invoice 50.00, chọn chia đôi]')
    const doc = readFlowmap(text).doc
    expect(doc?.scenarios[0]?.steps[1]).toEqual({
      node: 'B',
      note: 'Số dư 20.00, invoice 50.00, chọn chia đôi'
    })
  })

  it('numbers stay text: id 1.1 is "1.1"', () => {
    const text = 'flowmap: 1\nnodes:\n  - id: 1.1\n    type: fnc\n    title: Số\n'
    expect(readFlowmap(text).doc?.nodes[0]?.id).toBe('1.1')
  })

  it('a node takes the file of its group when it has none', () => {
    const text = BASE.replace('    title: Nhóm\n', '    title: Nhóm\n    fs: "FS 01.docx"\n')
    const doc = readFlowmap(text).doc
    expect(doc?.nodes.find((n) => n.id === 'B')?.fs).toBe('FS 01.docx')
    expect(doc?.nodes.find((n) => n.id === 'A')?.fs).toBeNull()
  })

  it('an empty file is a VERSION error, not a crash', () => {
    expect(check('').map((i) => i.code)).toEqual(['VERSION'])
  })
})
