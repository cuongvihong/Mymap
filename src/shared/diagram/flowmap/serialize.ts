import { stringify } from 'yaml'
import { deriveLinkKey } from '../ids'
import type { FlowmapDoc, FlowmapLink } from '../types'

/** A string as YAML text. Plain when that is safe, otherwise quoted. `flow` is true inside [ ]. */
function q(value: string, flow = false): string {
  if (value === '') return '""'
  if (/[\n\r\t]/.test(value) || (flow && /[,[\]{}]/.test(value))) return JSON.stringify(value)
  const out = stringify(value, { lineWidth: 0 }).trimEnd()
  return out.includes('\n') ? JSON.stringify(value) : out
}

const num = (n: number): string => String(Number(n.toFixed(2)))

/**
 * Which links must carry an explicit `id` so that reading the text gives the same ids back.
 * A link needs none when its id equals the key that the reader would derive for it.
 */
function explicitLinkIds(links: readonly FlowmapLink[]): Set<number> {
  const explicit = new Set<number>()
  for (let round = 0; round <= links.length; round++) {
    const taken = new Set<string>()
    for (const i of explicit) taken.add((links[i] as FlowmapLink).id)
    const next = new Set(explicit)
    links.forEach((l, i) => {
      if (explicit.has(i)) return
      const derived = deriveLinkKey(l.from, l.to, l.via, taken)
      taken.add(derived)
      if (derived !== l.id) next.add(i)
    })
    if (next.size === explicit.size) return explicit
    explicit.clear()
    for (const i of next) explicit.add(i)
  }
  return new Set(links.map((_, i) => i))
}

/**
 * Writes a project as Flowmap YAML (TDD 6.2). Keys come in a fixed order, empty optional fields
 * are left out, and `fs` is left out of a block when it equals the file of its group.
 */
export function serializeFlowmap(doc: FlowmapDoc): string {
  const out: string[] = []
  out.push('flowmap: 1')
  out.push('project:')
  out.push(`  name: ${q(doc.project.name ?? '')}`)
  if (doc.project.docsRoot) out.push(`  docs_root: ${q(doc.project.docsRoot)}`)

  if (doc.groups.length > 0) {
    out.push('groups:')
    for (const g of doc.groups) {
      out.push(`  - id: ${q(g.id)}`)
      out.push(`    title: ${q(g.title)}`)
      if (g.fs) out.push(`    fs: ${q(g.fs)}`)
    }
  }

  const fsOfGroup = new Map(doc.groups.map((g) => [g.id, g.fs]))
  out.push(doc.nodes.length > 0 ? 'nodes:' : 'nodes: []')
  for (const n of doc.nodes) {
    out.push(`  - id: ${q(n.id)}`)
    out.push(`    type: ${n.type}`)
    if (n.subtype) out.push(`    subtype: ${q(n.subtype)}`)
    if (n.group) out.push(`    group: ${q(n.group)}`)
    if (n.code !== n.id) out.push(`    code: ${q(n.code)}`)
    out.push(`    title: ${q(n.title)}`)
    if (n.body) out.push(`    body: ${q(n.body)}`)
    if (n.fix) out.push(`    fix: ${q(n.fix)}`)
    if (n.chips.length > 0) out.push(`    chips: [${n.chips.map((c) => q(c, true)).join(', ')}]`)
    const inherited = n.group ? (fsOfGroup.get(n.group) ?? null) : null
    if (n.fs && n.fs !== inherited) out.push(`    fs: ${q(n.fs)}`)
    if (n.section) out.push(`    section: ${q(n.section)}`)
  }

  if (doc.links.length > 0) {
    const explicit = explicitLinkIds(doc.links)
    out.push('links:')
    doc.links.forEach((l, i) => {
      const lead = explicit.has(i) ? `  - id: ${q(l.id)}\n    from: ` : '  - from: '
      out.push(`${lead}${q(l.from)}`)
      out.push(`    to: ${q(l.to)}`)
      out.push(`    via: ${l.via}`)
      if (l.label) out.push(`    label: ${q(l.label)}`)
      if (l.note) out.push(`    note: ${q(l.note)}`)
    })
  }

  if (doc.scenarios.length > 0) {
    out.push('scenarios:')
    for (const s of doc.scenarios) {
      out.push(`  - id: ${q(s.id)}`)
      out.push(`    type: ${s.type}`)
      if (s.parent) out.push(`    parent: ${q(s.parent)}`)
      if (s.at) out.push(`    at: ${q(s.at)}`)
      out.push(`    title: ${q(s.title)}`)
      if (s.steps.length === 0) {
        out.push('    steps: []')
      } else {
        out.push('    steps:')
        for (const st of s.steps) {
          out.push(
            st.note
              ? `      - [${q(st.node, true)}, ${q(st.note, true)}]`
              : `      - [${q(st.node, true)}]`
          )
        }
      }
    }
  }

  const layoutKeys = doc.nodes.map((n) => n.id).filter((id) => doc.layout[id])
  if (layoutKeys.length > 0) {
    out.push('layout:')
    for (const id of layoutKeys) {
      const [x, y] = doc.layout[id] as [number, number]
      out.push(`  ${q(id)}: [${num(x)}, ${num(y)}]`)
    }
  }

  return out.join('\n') + '\n'
}
