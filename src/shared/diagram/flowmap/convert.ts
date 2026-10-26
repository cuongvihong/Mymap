import type { LinkEnds } from '../focus'
import type { ScenarioNode } from '../scenario'
import type { FlowmapDoc, FlowmapScenario, ProjectData } from '../types'

/**
 * The project written with the ids of the file. Used by yaml.export and as the "current" side of
 * planMerge. A block's `fs` is resolved the same way the reader does (own file, else the file of
 * its group), so exporting and importing again reports no change. Only blocks that have real
 * coordinates (has_layout = 1) appear in `layout`.
 */
export function projectToDoc(data: ProjectData): FlowmapDoc {
  const groupKey = new Map(data.groups.map((g) => [g.id, g.key]))
  const groupFs = new Map(data.groups.map((g) => [g.id, g.fsFile]))
  const nodeKey = new Map(data.nodes.map((n) => [n.id, n.key]))
  const scenarioKey = new Map(data.scenarios.map((s) => [s.id, s.key]))

  const layout: FlowmapDoc['layout'] = {}
  for (const n of data.nodes) if (n.hasLayout) layout[n.key] = [n.x, n.y]

  const stepsOf = new Map<number, { idx: number; node: string; note: string }[]>()
  for (const st of data.steps) {
    const list = stepsOf.get(st.scenarioId) ?? []
    list.push({ idx: st.idx, node: nodeKey.get(st.nodeId) ?? '', note: st.note })
    stepsOf.set(st.scenarioId, list)
  }

  const scenarios: FlowmapScenario[] = data.scenarios.map((s) => ({
    id: s.key,
    type: s.type,
    title: s.title,
    parent: s.parentId === null ? null : (scenarioKey.get(s.parentId) ?? null),
    at: s.forkNodeId === null ? null : (nodeKey.get(s.forkNodeId) ?? null),
    steps: (stepsOf.get(s.id) ?? [])
      .sort((a, b) => a.idx - b.idx)
      .map(({ node, note }) => ({ node, note }))
  }))

  return {
    project: { name: data.project.name, docsRoot: data.project.docsRoot },
    groups: data.groups.map((g) => ({ id: g.key, title: g.title, fs: g.fsFile })),
    nodes: data.nodes.map((n) => ({
      id: n.key,
      type: n.type,
      subtype: n.subtype,
      group: n.groupId === null ? null : (groupKey.get(n.groupId) ?? null),
      code: n.code,
      title: n.title,
      body: n.body,
      fix: n.fixText,
      chips: n.chips,
      fs: n.fsFile ?? (n.groupId === null ? null : (groupFs.get(n.groupId) ?? null)),
      section: n.fsSection
    })),
    links: data.links.map((l) => ({
      id: l.key,
      from: nodeKey.get(l.fromNode) ?? '',
      to: nodeKey.get(l.toNode) ?? '',
      via: l.via,
      label: l.label,
      note: l.note
    })),
    scenarios,
    layout
  }
}

/** Scenarios of a project in the shape the path functions need, with database ids. */
export function dataScenarios(data: Pick<ProjectData, 'scenarios' | 'steps'>): ScenarioNode[] {
  const stepsOf = new Map<number, { idx: number; nodeId: number; note: string }[]>()
  for (const st of data.steps) {
    const list = stepsOf.get(st.scenarioId) ?? []
    list.push({ idx: st.idx, nodeId: st.nodeId, note: st.note })
    stepsOf.set(st.scenarioId, list)
  }
  return data.scenarios.map((s) => ({
    id: s.id,
    parentId: s.parentId,
    forkNodeId: s.forkNodeId,
    steps: (stepsOf.get(s.id) ?? [])
      .sort((a, b) => a.idx - b.idx)
      .map(({ nodeId, note }) => ({ nodeId, note }))
  }))
}

/** Scenarios of a file in the shape the path functions need, with the ids of the file. */
export function docScenarios(doc: FlowmapDoc): ScenarioNode[] {
  return doc.scenarios.map((s) => ({
    id: s.id,
    parentId: s.parent,
    forkNodeId: s.at,
    steps: s.steps.map((st) => ({ nodeId: st.node, note: st.note }))
  }))
}

export function dataLinkEnds(data: ProjectData): LinkEnds[] {
  return data.links.map((l) => ({ id: l.id, from: l.fromNode, to: l.toNode }))
}

export function docLinkEnds(doc: FlowmapDoc): LinkEnds[] {
  return doc.links.map((l) => ({ id: l.id, from: l.from, to: l.to }))
}
