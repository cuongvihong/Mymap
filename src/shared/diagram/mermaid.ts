import {
  LIMITS,
  type FlowmapDoc,
  type FlowmapGroup,
  type FlowmapLink,
  type FlowmapNode
} from './types'
import { deriveLinkKey, sanitizeId } from './ids'

/**
 * Mermaid flowchart, the subset of TDD 6.7. Written by hand, no Mermaid library.
 *
 * Import: `flowchart` or `graph` with a direction, nodes `A`, `A[t]`, `A(t)`, `A{t}`, `A([t])`,
 * edges `-->`, `---`, `-.->`, `==>` with a label `-->|t|` or `-- t -->`, `subgraph id [title]`
 * and `%%` comments. Anything else is skipped with a warning that names the line.
 */

export interface MermaidWarning {
  /** 1 based line of the text. */
  line: number
  message: string
}

export interface MermaidResult {
  doc: FlowmapDoc | null
  warnings: MermaidWarning[]
}

const HEADER = /^(?:flowchart|graph)\b/i
const DIRECTIONS = new Set(['LR', 'RL', 'TD', 'TB', 'BT'])

/** True when the first line that is not a comment declares a flowchart. */
export function looksLikeMermaid(text: string): boolean {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('%%')) continue
    return HEADER.test(line)
  }
  return false
}

type Shape = 'plain' | 'round' | 'cond' | 'stadium'

interface Draft {
  id: string
  label: string
  shape: Shape
  group: string | null
  order: number
}

interface RawEdge {
  from: string
  to: string
  label: string
  dotted: boolean
  line: number
}

const clamp = (s: string, max: number): string => [...s].slice(0, max).join('')

/** Text between the brackets: surrounding quotes and `<br>` are removed. */
function cleanLabel(raw: string): string {
  let s = raw.trim()
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1)
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ID_CHARS = /[\p{L}\p{N}_]/u

/** Node id such as `A`, `F9_3`. Returns the id and the index after it, or null. */
function readId(s: string, at: number): { id: string; end: number } | null {
  let end = at
  while (end < s.length && ID_CHARS.test(s.charAt(end))) end++
  return end > at ? { id: s.slice(at, end), end } : null
}

interface ReadNode {
  id: string
  label: string | null
  shape: Shape
  end: number
  /** A shape Mermaid has but this subset does not: drawn as a plain block. */
  odd: boolean
}

const OPENERS: { open: string; close: string; shape: Shape; odd?: boolean }[] = [
  { open: '([', close: '])', shape: 'stadium' },
  { open: '((', close: '))', shape: 'round', odd: true },
  { open: '[[', close: ']]', shape: 'plain', odd: true },
  { open: '{{', close: '}}', shape: 'cond', odd: true },
  { open: '[(', close: ')]', shape: 'plain', odd: true },
  { open: '[', close: ']', shape: 'plain' },
  { open: '(', close: ')', shape: 'round' },
  { open: '{', close: '}', shape: 'cond' }
]

function readNode(s: string, at: number): ReadNode | null {
  const id = readId(s, at)
  if (!id) return null
  const rest = s.slice(id.end)
  for (const o of OPENERS) {
    if (!rest.startsWith(o.open)) continue
    // Find the closer, skipping over quoted text.
    let i = id.end + o.open.length
    let quoted = false
    while (i < s.length) {
      const ch = s.charAt(i)
      if (ch === '"') quoted = !quoted
      if (!quoted && s.startsWith(o.close, i)) {
        return {
          id: id.id,
          label: cleanLabel(s.slice(id.end + o.open.length, i)),
          shape: o.shape,
          end: i + o.close.length,
          odd: o.odd === true
        }
      }
      i++
    }
    return null
  }
  return { id: id.id, label: null, shape: 'plain', end: id.end, odd: false }
}

interface ReadEdge {
  label: string
  dotted: boolean
  end: number
}

const EDGE_FORMS: { re: RegExp; dotted: boolean; labelled: boolean }[] = [
  { re: /^--\s+(.+?)\s+(?:-->|---)/, dotted: false, labelled: true },
  { re: /^-\.\s+(.+?)\s+\.->?/, dotted: true, labelled: true },
  { re: /^==\s+(.+?)\s+==>?/, dotted: false, labelled: true },
  { re: /^(?:-\.->|-\.-)/, dotted: true, labelled: false },
  { re: /^(?:-->|---|==>|===|~~~)/, dotted: false, labelled: false }
]

function readEdge(s: string, at: number): ReadEdge | null {
  const rest = s.slice(at)
  for (const form of EDGE_FORMS) {
    const m = form.re.exec(rest)
    if (!m) continue
    let end = at + m[0].length
    let label = form.labelled ? cleanLabel(m[1] ?? '') : ''
    if (!form.labelled) {
      const after = /^\s*\|([^|]*)\|/.exec(s.slice(end))
      if (after) {
        label = cleanLabel(after[1] ?? '')
        end += after[0].length
      }
    }
    return { label, dotted: form.dotted, end }
  }
  return null
}

const skipSpaces = (s: string, at: number): number => {
  let i = at
  while (i < s.length && /\s/.test(s.charAt(i))) i++
  return i
}

/** Id usable as a key (BR-01): letters, digits and `_`, at most 40 characters. */
function keyOf(raw: string, taken: Map<string, string>): string {
  const known = taken.get(raw)
  if (known) return known
  const base = sanitizeId(raw).replace(/-/g, '_') || 'N'
  let key = base
  const used = new Set(taken.values())
  let n = 2
  while (used.has(key)) key = `${clamp(base, LIMITS.id - 4)}_${n++}`
  taken.set(raw, key)
  return key
}

export function parseMermaid(text: string): MermaidResult {
  const warnings: MermaidWarning[] = []
  const warn = (line: number, message: string) => warnings.push({ line, message })
  const lines = text.split(/\r?\n/)

  const nodes = new Map<string, Draft>()
  const edges: RawEdge[] = []
  const groups: { id: string; title: string }[] = []
  const groupIds = new Map<string, string>()
  const stack: string[] = []
  let seenHeader = false
  let order = 0

  const touch = (id: string, label: string | null, shape: Shape): void => {
    const current = nodes.get(id)
    const group = stack.length > 0 ? (stack[stack.length - 1] as string) : null
    if (!current) {
      nodes.set(id, { id, label: label ?? '', shape, group, order: order++ })
      return
    }
    if (label !== null && current.label === '') {
      current.label = label
      current.shape = shape
    }
    if (current.group === null && group !== null) current.group = group
  }

  lines.forEach((raw, index) => {
    const no = index + 1
    let line = raw.trim()
    if (line === '' || line.startsWith('%%')) return
    line = line.replace(/;\s*$/, '')
    if (!seenHeader) {
      if (!HEADER.test(line)) {
        warn(no, 'Chưa thấy dòng flowchart hoặc graph, dòng này được bỏ qua.')
        return
      }
      seenHeader = true
      const dir = /^\w+\s+(\w+)/.exec(line)?.[1]?.toUpperCase()
      if (dir && !DIRECTIONS.has(dir)) warn(no, `Hướng ${dir} không hỗ trợ, bỏ qua.`)
      return
    }
    if (/^end$/i.test(line)) {
      if (stack.length > 0) stack.pop()
      else warn(no, 'Dòng end không đóng subgraph nào, bỏ qua.')
      return
    }
    const sub = /^subgraph\s+(.+)$/i.exec(line)
    if (sub) {
      const body = (sub[1] as string).trim()
      let id: string
      let title: string
      const bracket = /^([\p{L}\p{N}_]+)\s*\[(.*)\]$/u.exec(body)
      if (bracket) {
        id = bracket[1] as string
        title = cleanLabel(bracket[2] as string)
      } else {
        title = cleanLabel(body)
        id = /^[\p{L}\p{N}_]+$/u.test(title) ? title : `G${groups.length + 1}`
      }
      const key = keyOf(id, groupIds)
      if (stack.length > 0) warn(no, 'Subgraph lồng nhau, nhóm trong được tách thành nhóm riêng.')
      if (!groups.some((g) => g.id === key)) groups.push({ id: key, title: title || id })
      stack.push(key)
      return
    }
    if (/^(?:direction|classDef|class|style|linkStyle|click|accTitle|accDescr)\b/.test(line)) {
      warn(no, `Dòng "${clamp(line, 40)}" không hỗ trợ, bỏ qua.`)
      return
    }
    // A statement: node (edge node)*
    let at = skipSpaces(line, 0)
    const first = readNode(line, at)
    if (!first) {
      warn(no, `Dòng "${clamp(line, 40)}" không hỗ trợ, bỏ qua.`)
      return
    }
    if (first.odd) warn(no, `Dạng khối của ${first.id} không hỗ trợ, coi như khối Function.`)
    touch(first.id, first.label, first.shape)
    let prev = first.id
    at = skipSpaces(line, first.end)
    let broken = false
    while (at < line.length) {
      const edge = readEdge(line, at)
      if (!edge) {
        broken = true
        break
      }
      at = skipSpaces(line, edge.end)
      const next = readNode(line, at)
      if (!next) {
        broken = true
        break
      }
      if (next.odd) warn(no, `Dạng khối của ${next.id} không hỗ trợ, coi như khối Function.`)
      touch(next.id, next.label, next.shape)
      edges.push({ from: prev, to: next.id, label: edge.label, dotted: edge.dotted, line: no })
      prev = next.id
      at = skipSpaces(line, next.end)
    }
    if (broken) warn(no, `Phần "${clamp(line.slice(at), 40)}" không hỗ trợ, bỏ qua.`)
  })

  if (!seenHeader) {
    return {
      doc: null,
      warnings: [{ line: 1, message: 'Không thấy dòng flowchart hoặc graph ở đầu file.' }]
    }
  }
  if (stack.length > 0) warn(lines.length, 'Có subgraph chưa đóng bằng end.')

  const keys = new Map<string, string>()
  const ordered = [...nodes.values()].sort((a, b) => a.order - b.order)
  for (const n of ordered) keyOf(n.id, keys)
  const incoming = new Set(edges.map((e) => e.to))
  const outgoing = new Set(edges.map((e) => e.from))

  const docNodes: FlowmapNode[] = ordered.map((n) => {
    const id = keys.get(n.id) as string
    let type: FlowmapNode['type'] = 'fnc'
    let subtype: string | null = null
    if (n.shape === 'cond') type = 'cond'
    else if (n.shape === 'stadium') {
      if (!incoming.has(n.id)) type = 'start'
      else if (!outgoing.has(n.id)) {
        type = 'end'
        subtype = 'ok'
      }
    }
    const title = clamp(n.label || n.id, LIMITS.title)
    return {
      id,
      type,
      subtype,
      group: n.group,
      code: clamp(id, LIMITS.code),
      title,
      body: '',
      fix: '',
      chips: [],
      fs: null,
      section: null
    }
  })

  const usedLinkKeys = new Set<string>()
  const docLinks: FlowmapLink[] = edges.map((e) => {
    const from = keys.get(e.from) as string
    const to = keys.get(e.to) as string
    const via = e.dotted ? 'db' : 'call'
    const id = deriveLinkKey(from, to, via, usedLinkKeys)
    usedLinkKeys.add(id)
    return { id, from, to, via, label: clamp(e.label, LIMITS.label), note: '' }
  })

  const used = new Set(docNodes.map((n) => n.group).filter((g): g is string => g !== null))
  const docGroups: FlowmapGroup[] = groups
    .filter((g) => used.has(g.id))
    .map((g) => ({ id: g.id, title: clamp(g.title, 80), fs: null }))

  return {
    doc: {
      project: { name: null, docsRoot: null },
      groups: docGroups,
      nodes: docNodes,
      links: docLinks,
      scenarios: [],
      layout: {}
    },
    warnings
  }
}

// -- export ------------------------------------------------------------------------------------

export interface MermaidSource {
  groups: { id: string; title: string }[]
  nodes: {
    id: string
    type: FlowmapNode['type']
    subtype: string | null
    title: string
    group: string | null
  }[]
  links: { from: string; to: string; via: string; label: string }[]
}

/** Text safe inside `["..."]` or `|...|`: no quotes, bars or line breaks. */
function safeText(s: string): string {
  return s
    .replace(/["]/g, "'")
    .replace(/[|]/g, '/')
    .replace(/[\r\n]+/g, ' ')
    .trim()
}

/** Mermaid id: letters, digits and `_`. Collisions get a suffix. */
function exportIds(ids: readonly string[]): Map<string, string> {
  const out = new Map<string, string>()
  const used = new Set<string>()
  for (const id of ids) {
    let base = id.replace(/[^A-Za-z0-9_]/g, '_')
    if (/^\d/.test(base)) base = `n${base}`
    if (base === '' || /^end$/i.test(base)) base = `${base}_`
    let key = base
    let n = 2
    while (used.has(key)) key = `${base}_${n++}`
    used.add(key)
    out.set(id, key)
  }
  return out
}

/** Flowchart for pasting into a document. Images, pins, scenarios and "Nơi sửa" are not exported. */
export function toMermaid(source: MermaidSource): string {
  const ids = exportIds([...source.groups.map((g) => g.id), ...source.nodes.map((n) => n.id)])
  const nodeId = (id: string) => ids.get(id) as string
  const shape = (n: MermaidSource['nodes'][number]): string => {
    const text = `"${safeText(n.title)}"`
    if (n.type === 'cond') return `{${text}}`
    if (n.type === 'start' || n.type === 'end') return `([${text}])`
    return `[${text}]`
  }
  const out: string[] = ['flowchart LR']
  const nodeLine = (n: MermaidSource['nodes'][number], indent: string) =>
    `${indent}${nodeId(n.id)}${shape(n)}`
  for (const g of source.groups) {
    out.push(`  subgraph ${nodeId(g.id)} ["${safeText(g.title)}"]`)
    for (const n of source.nodes) if (n.group === g.id) out.push(nodeLine(n, '    '))
    out.push('  end')
  }
  const known = new Set(source.groups.map((g) => g.id))
  for (const n of source.nodes)
    if (n.group === null || !known.has(n.group)) out.push(nodeLine(n, '  '))
  for (const l of source.links) {
    const label = safeText(l.label === '' ? l.via : `${l.via}: ${l.label}`)
    const arrow = l.via === 'db' ? '-.->' : '-->'
    out.push(`  ${nodeId(l.from)} ${arrow}|${label}| ${nodeId(l.to)}`)
  }
  return `${out.join('\n')}\n`
}

export function docToMermaid(doc: FlowmapDoc): string {
  return toMermaid({
    groups: doc.groups.map((g) => ({ id: g.id, title: g.title })),
    nodes: doc.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      subtype: n.subtype,
      title: n.title,
      group: n.group
    })),
    links: doc.links.map((l) => ({ from: l.from, to: l.to, via: l.via, label: l.label }))
  })
}
