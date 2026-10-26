import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { GRID_CELL, gridPositions } from '../../../shared/diagram/geometry'
import {
  projectToDoc,
  readFlowmap,
  serializeFlowmap,
  planMerge,
  summarize
} from '../../../shared/diagram/flowmap'
import { looksLikeMermaid, parseMermaid } from '../../../shared/diagram/mermaid'
import { slugify } from '../../../shared/diagram/normalize'
import {
  type FlowmapDoc,
  type FlowmapIssue,
  type FlowmapNode,
  type ImportFile,
  type MergeOptions,
  type MergePlan,
  type MergeSummary,
  type ProjectData,
  type ProjectSummary,
  type YamlExportResult,
  type YamlPreview
} from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as groups from '../repo/groups'
import * as links from '../repo/links'
import * as nodes from '../repo/nodes'
import * as projects from '../repo/projects'
import * as scenarios from '../repo/scenarios'
import { loadProjectData } from './data'
import { intArg, plainObject } from './fields'
import { removeNodes, type ServiceOptions } from './node'
import { createProjectService } from './project'

/** Largest file the import accepts, in bytes. */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024

const EMPTY_DOC: FlowmapDoc = {
  project: { name: null, docsRoot: null },
  groups: [],
  nodes: [],
  links: [],
  scenarios: [],
  layout: {}
}

/**
 * Flowmap YAML or a Mermaid flowchart. The warnings of a Mermaid file (lines it skipped) are
 * returned as issues of severity `warning`, so the import dialog lists them like YAML warnings.
 */
export function readImportText(text: string): { doc: FlowmapDoc | null; issues: FlowmapIssue[] } {
  if (!looksLikeMermaid(text)) return readFlowmap(text)
  const parsed = parseMermaid(text)
  const issues: FlowmapIssue[] = parsed.warnings.map((w) => ({
    line: w.line,
    col: 1,
    path: 'mermaid',
    code: 'UNKNOWN_KEY',
    severity: parsed.doc ? 'warning' : 'error',
    message: `dòng ${w.line}, cột 1: ${w.message}`
  }))
  if (parsed.doc && parsed.doc.nodes.length === 0) {
    issues.push({
      line: 1,
      col: 1,
      path: 'mermaid',
      code: 'REQUIRED',
      severity: 'error',
      message: 'dòng 1, cột 1: File Mermaid không có khối nào.'
    })
    return { doc: null, issues }
  }
  return { doc: parsed.doc, issues }
}

function mergeOptions(raw: unknown): MergeOptions {
  const o = raw === undefined ? {} : plainObject(raw, 'options')
  return { removeMissing: o['removeMissing'] === true }
}

function textArg(raw: unknown): string {
  if (typeof raw !== 'string') throw new DiagramError('INVALID_ARGUMENT', 'text must be a string')
  return raw
}

export function createYamlService(ctx: DiagramContext, options: ServiceOptions = {}) {
  const { db, khoRoot, logger } = ctx
  const now = options.now ?? (() => new Date())
  const iso = () => now().toISOString()

  const requireProject = (id: unknown): projects.ProjectRecord => {
    const record = projects.getProject(db, intArg(id, 'projectId'))
    if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
    return record
  }

  function writePlan(
    record: projects.ProjectRecord,
    plan: MergePlan,
    docsRoot: string | null
  ): void {
    const pid = record.id
    const groupId = groups.keyToId(db, pid)

    // groups
    let groupOrder = groups.nextSortOrder(db, pid)
    for (const g of plan.add.groups) {
      groupId.set(
        g.id,
        groups.insertGroup(db, {
          projectId: pid,
          key: g.id,
          title: g.title,
          fsFile: g.fs,
          sortOrder: groupOrder++
        })
      )
    }
    for (const c of plan.update.groups) {
      const id = groupId.get(c.id) as number
      const current = groups.getGroup(db, id) as groups.GroupRecord
      groups.updateGroup(db, id, {
        title: c.after.title,
        fsFile: c.after.fs,
        collapsed: current.collapsed,
        sortOrder: current.sortOrder,
        frame: current.frame
      })
    }

    // blocks
    const nodeId = nodes.keyToId(db, pid)
    const write = (
      n: FlowmapNode,
      at: { x: number; y: number; hasLayout: boolean; collapsed: boolean }
    ) => ({
      key: n.id,
      type: n.type,
      subtype: n.subtype,
      code: n.code,
      title: n.title,
      body: n.body,
      fixText: n.fix,
      chips: n.chips,
      fsFile: n.fs,
      fsSection: n.section,
      groupId: n.group === null ? null : (groupId.get(n.group) ?? null),
      ...at
    })
    const unplaced: number[] = []
    for (const n of plan.add.nodes) {
      const spot = plan.layout[n.id]
      const id = nodes.insertNode(
        db,
        pid,
        write(n, {
          x: spot?.[0] ?? 0,
          y: spot?.[1] ?? 0,
          hasLayout: spot !== undefined,
          collapsed: false
        }),
        iso()
      )
      nodeId.set(n.id, id)
      if (!spot) unplaced.push(id)
    }
    for (const c of plan.update.nodes) {
      const id = nodeId.get(c.id) as number
      const current = nodes.getNode(db, id) as nodes.NodeRecord
      const spot = plan.layout[c.id]
      nodes.updateNode(
        db,
        id,
        write(c.after, {
          x: spot?.[0] ?? current.x,
          y: spot?.[1] ?? current.y,
          hasLayout: spot !== undefined ? true : current.hasLayout,
          collapsed: current.collapsed
        }),
        iso()
      )
    }
    if (unplaced.length > 0) {
      // BR-04: blocks without coordinates wait on a 300 x 200 grid below the placed ones.
      const state = nodes.layoutState(db, pid)
      const origin = { x: state.minX, y: state.placed > 0 ? state.maxY + GRID_CELL.h : 0 }
      const spots = gridPositions(state.pending, origin)
      // pending includes the blocks just inserted, so earlier placeholders keep their slots first
      const all = db
        .prepare('SELECT id FROM dg_nodes WHERE project_id = ? AND has_layout = 0 ORDER BY id')
        .all(pid) as { id: number }[]
      all.forEach((row, i) => {
        if (!unplaced.includes(row.id)) return
        const spot = spots[i]
        if (spot)
          db.prepare('UPDATE dg_nodes SET x = ?, y = ? WHERE id = ?').run(spot.x, spot.y, row.id)
      })
    }

    // channels
    const linkId = links.keyToId(db, pid)
    let linkOrder = links.nextSortOrder(db, pid)
    for (const l of plan.add.links) {
      linkId.set(
        l.id,
        links.insertLink(db, {
          projectId: pid,
          key: l.id,
          fromNode: nodeId.get(l.from) as number,
          toNode: nodeId.get(l.to) as number,
          via: l.via,
          label: l.label,
          note: l.note,
          sortOrder: linkOrder++
        })
      )
    }
    for (const c of plan.update.links) {
      links.updateLink(db, linkId.get(c.id) as number, {
        fromNode: nodeId.get(c.after.from) as number,
        toNode: nodeId.get(c.after.to) as number,
        via: c.after.via,
        label: c.after.label,
        note: c.after.note
      })
    }

    // scenarios: insert first, then set parents, because a parent can come later in the file
    const scenarioId = scenarios.keyToId(db, pid)
    let scenarioOrder = scenarios.nextSortOrder(db, pid)
    for (const s of plan.add.scenarios) {
      scenarioId.set(
        s.id,
        scenarios.insertScenario(db, {
          projectId: pid,
          key: s.id,
          type: s.type,
          title: s.title,
          parentId: null,
          forkNodeId: null,
          sortOrder: scenarioOrder++
        })
      )
    }
    const touched = [...plan.add.scenarios, ...plan.update.scenarios.map((c) => c.after)]
    for (const s of plan.update.scenarios) {
      const id = scenarioId.get(s.id) as number
      const current = scenarios.getScenario(db, id) as scenarios.ScenarioRecord
      scenarios.updateScenario(db, id, {
        type: s.after.type,
        title: s.after.title,
        parentId: current.parentId,
        forkNodeId: current.forkNodeId,
        sortOrder: current.sortOrder
      })
    }
    for (const s of touched) {
      const id = scenarioId.get(s.id) as number
      scenarios.setParent(
        db,
        id,
        s.parent === null ? null : (scenarioId.get(s.parent) ?? null),
        s.at === null ? null : (nodeId.get(s.at) ?? null)
      )
      scenarios.replaceSteps(
        db,
        id,
        s.steps.map((st) => ({ nodeId: nodeId.get(st.node) as number, note: st.note }))
      )
    }

    // removals, only when the box was ticked
    for (const key of plan.remove.scenarios)
      scenarios.deleteScenarios(db, [scenarioId.get(key) as number])
    for (const key of plan.remove.links) links.deleteLinks(db, [linkId.get(key) as number])
    const gone = plan.remove.nodes.map((key) => nodeId.get(key) as number)
    if (gone.length > 0) removeNodes(db, pid, gone)
    for (const key of plan.remove.groups) groups.deleteGroup(db, groupId.get(key) as number)

    // docs_root from the file is used only when the project has none and the folder exists here
    if (docsRoot && !record.docsRoot && existsSync(docsRoot) && statSync(docsRoot).isDirectory()) {
      projects.updateDocsRoot(db, pid, docsRoot, iso())
    }
  }

  function previewAgainst(current: FlowmapDoc, rawText: unknown, rawOptions: unknown): YamlPreview {
    const result = readImportText(textArg(rawText))
    if (!result.doc) return { ok: false, issues: result.issues }
    const plan = planMerge(current, result.doc, mergeOptions(rawOptions))
    return {
      ok: true,
      issues: result.issues,
      summary: summarize(plan),
      plan,
      projectName: result.doc.project.name
    }
  }

  function preview(projectId: unknown, rawText: unknown, rawOptions: unknown): YamlPreview {
    const record = requireProject(projectId)
    return previewAgainst(projectToDoc(loadProjectData(db, record)), rawText, rawOptions)
  }

  function applyTo(
    record: projects.ProjectRecord,
    rawText: unknown,
    rawOptions: unknown
  ): MergeSummary {
    const checked = preview(record.id, rawText, rawOptions)
    if (!checked.ok) {
      const first = checked.issues.find((i) => i.severity === 'error')
      throw new DiagramError('YAML_INVALID', first?.message ?? 'YAML is not valid')
    }
    const docsRoot = readImportText(textArg(rawText)).doc?.project.docsRoot ?? null
    db.transaction(() => writePlan(record, checked.plan, docsRoot))()
    logger.info('yaml applied', {
      id: record.id,
      added: checked.summary.add.nodes,
      updated: checked.summary.update.nodes
    })
    return checked.summary
  }

  return {
    /** Writes `<Kho>/xuat/<project>.flowmap.yaml` and returns the text too (FR-YM-01). */
    export(projectId: unknown): YamlExportResult {
      const record = requireProject(projectId)
      const text = serializeFlowmap(projectToDoc(loadProjectData(db, record)))
      const folder = join(khoRoot, 'xuat')
      mkdirSync(folder, { recursive: true })
      const file = `xuat/${slugify(record.name)}.flowmap.yaml`
      writeFileSync(join(khoRoot, file), text, 'utf8')
      logger.info('yaml exported', { id: record.id })
      return { text, file }
    },

    preview,

    /** Runs preview again, then writes the whole plan in one transaction. A failure rolls everything back. */
    apply(
      projectId: unknown,
      rawText: unknown,
      rawOptions: unknown
    ): { summary: MergeSummary; data: ProjectData } {
      const record = requireProject(projectId)
      const summary = applyTo(record, rawText, rawOptions)
      return { summary, data: loadProjectData(db, requireProject(projectId)) }
    },

    /** The welcome screen import: the same check, against an empty project. */
    previewNew(rawText: unknown): YamlPreview {
      return previewAgainst(EMPTY_DOC, rawText, {})
    },

    /** Creates the project only when the text is valid, then imports it. */
    applyNew(
      rawName: unknown,
      rawText: unknown
    ): { project: ProjectSummary; summary: MergeSummary } {
      const checked = previewAgainst(EMPTY_DOC, rawText, {})
      if (!checked.ok) {
        const first = checked.issues.find((i) => i.severity === 'error')
        throw new DiagramError('YAML_INVALID', first?.message ?? 'YAML is not valid')
      }
      const projectService = createProjectService(ctx)
      const created = projectService.create(rawName)
      try {
        const summary = applyTo(requireProject(created.id), rawText, {})
        return {
          project: projectService.list().find((p) => p.id === created.id) ?? created,
          summary
        }
      } catch (error) {
        projectService.remove(created.id)
        throw error
      }
    },

    /** Reads a file chosen in the dialog. A BOM is dropped. Never writes. */
    readFile(absolute: string): ImportFile {
      let size: number
      try {
        size = statSync(absolute).size
      } catch {
        throw new DiagramError('IMPORT_UNREADABLE', 'The file cannot be read')
      }
      if (size > IMPORT_MAX_BYTES)
        throw new DiagramError('IMPORT_TOO_LARGE', 'The file is too large')
      try {
        const text = readFileSync(absolute, 'utf8').replace(/^\uFEFF/, '')
        return { name: basename(absolute), text }
      } catch {
        throw new DiagramError('IMPORT_UNREADABLE', 'The file cannot be read')
      }
    }
  }
}

export type YamlService = ReturnType<typeof createYamlService>
