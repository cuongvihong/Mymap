import { deriveLinkKey } from '../ids'
import type {
  FlowmapDoc,
  FlowmapIssue,
  FlowmapLayout,
  FlowmapLink,
  FlowmapScenario,
  NodeType,
  ScenarioType,
  ViaType
} from '../types'
import { parseFlowmap } from './parse'
import { validateFlowmap } from './validate'

type Obj = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const orNull = (v: unknown): string | null => {
  const s = str(v).trim()
  return s === '' ? null : s
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Obj =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {}

/**
 * Turns a document that passed validation into a FlowmapDoc: defaults are filled in
 * (code = id, fs = fs of the group) and link ids are derived where the file gives none.
 * Call it only when validateFlowmap found no errors.
 */
export function buildDoc(raw: unknown): FlowmapDoc {
  const root = obj(raw)
  const project = obj(root['project'])

  const groups = arr(root['groups']).map((g) => {
    const o = obj(g)
    return { id: str(o['id']), title: str(o['title']).trim(), fs: orNull(o['fs']) }
  })
  const fsOfGroup = new Map(groups.map((g) => [g.id, g.fs]))

  const nodes = arr(root['nodes']).map((n) => {
    const o = obj(n)
    const id = str(o['id'])
    const type = str(o['type']) as NodeType
    const group = orNull(o['group'])
    const subtype = orNull(o['subtype'])
    const keepsSubtype = type === 'tech' || type === 'start' || type === 'end' || type === 'note'
    return {
      id,
      type,
      subtype: keepsSubtype ? subtype : null,
      group,
      code: orNull(o['code']) ?? id,
      title: str(o['title']).trim(),
      body: str(o['body']),
      fix: str(o['fix']),
      chips: arr(o['chips']).map((c) => str(c)),
      fs: orNull(o['fs']) ?? (group ? (fsOfGroup.get(group) ?? null) : null),
      section: orNull(o['section'])
    }
  })

  // Link ids: explicit ones first, so derived keys never collide with them.
  const linksRaw = arr(root['links']).map(obj)
  const taken = new Set<string>()
  for (const l of linksRaw) {
    const id = orNull(l['id'])
    if (id) taken.add(id)
  }
  const links: FlowmapLink[] = linksRaw.map((l) => {
    const from = str(l['from'])
    const to = str(l['to'])
    const via = str(l['via']) as ViaType
    let id = orNull(l['id'])
    if (!id) {
      id = deriveLinkKey(from, to, via, taken)
      taken.add(id)
    }
    return { id, from, to, via, label: str(l['label']), note: str(l['note']) }
  })

  const scenarios: FlowmapScenario[] = arr(root['scenarios']).map((s) => {
    const o = obj(s)
    return {
      id: str(o['id']),
      type: str(o['type']) as ScenarioType,
      title: str(o['title']).trim(),
      parent: orNull(o['parent']),
      at: orNull(o['at']),
      steps: arr(o['steps']).map((st) => {
        if (Array.isArray(st)) return { node: str(st[0]), note: str(st[1]) }
        const so = obj(st)
        return { node: str(so['node']), note: str(so['note']) }
      })
    }
  })

  const layout: FlowmapLayout = {}
  for (const [key, value] of Object.entries(obj(root['layout']))) {
    const v = arr(value)
    layout[key] = [Number(v[0]), Number(v[1])]
  }

  return {
    project: { name: orNull(project['name']), docsRoot: orNull(project['docs_root']) },
    groups,
    nodes,
    links,
    scenarios,
    layout
  }
}

export interface ReadResult {
  /** The document, or null when there is at least one error. */
  doc: FlowmapDoc | null
  /** Errors and warnings, sorted by position. */
  issues: FlowmapIssue[]
}

/** Parse, validate and build in one call. */
export function readFlowmap(text: string): ReadResult {
  const parsed = parseFlowmap(text)
  const issues = validateFlowmap(parsed)
  if (issues.some((i) => i.severity === 'error')) return { doc: null, issues }
  return { doc: buildDoc(parsed.raw), issues }
}
