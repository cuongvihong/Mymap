import type { Database } from 'better-sqlite3'
import { GRID_CELL, gridPositions } from '../../../shared/diagram/geometry'
import { NODE_KEY_PREFIX, newId } from '../../../shared/diagram/ids'
import { scenariosForkedAt, scenariosUsingNodes } from '../../../shared/diagram/scenario'
import {
  END_SUBTYPES,
  LIMITS,
  NODE_TYPES,
  START_SUBTYPES,
  TECH_SUBTYPES,
  type AffectedScenario,
  type NodeData,
  type NodeInput,
  type NodeMove,
  type NodeRemoveResult,
  type NodeType
} from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as groups from '../repo/groups'
import * as nodes from '../repo/nodes'
import * as projects from '../repo/projects'
import * as scenarios from '../repo/scenarios'
import {
  finite,
  freeText,
  intArg,
  intList,
  key,
  nullableText,
  oneOf,
  plainObject,
  text
} from './fields'
import { scenarioNodes } from './scenarioTree'

export interface ServiceOptions {
  now?: () => Date
}

function subtypeFor(type: NodeType, raw: unknown): string | null {
  const given = raw === undefined || raw === null || raw === '' ? null : raw
  switch (type) {
    case 'tech':
      return given === null ? null : oneOf(given, TECH_SUBTYPES, 'subtype')
    case 'start':
      return given === null ? null : oneOf(given, START_SUBTYPES, 'subtype')
    case 'end':
      return given === null ? 'ok' : oneOf(given, END_SUBTYPES, 'subtype')
    case 'note':
      return given === null ? null : text(given, 'subtype', 20)
    default:
      return null
  }
}

function chipsOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new DiagramError('INVALID_ARGUMENT', 'chips must be a list')
  const out = raw.map((c) => text(c, 'chip', LIMITS.chip)).filter((c) => c !== '')
  if (out.length > LIMITS.chips) {
    throw new DiagramError('FIELD_TOO_LONG', `At most ${LIMITS.chips} chips`)
  }
  return out
}

/**
 * Removes blocks, cleans up the scenarios and reports what changed (FR-SUA-06).
 * Shared by node.remove, group.remove and yaml.apply. Must run inside a transaction.
 */
export function removeNodes(
  db: Database,
  projectId: number,
  ids: readonly number[]
): NodeRemoveResult {
  const tree = scenarioNodes(db, projectId)
  const all = new Map(scenarios.listScenarios(db, projectId).map((s) => [s.id, s]))
  const describe = (list: (string | number)[]): AffectedScenario[] =>
    list.map((id) => {
      const s = all.get(id as number)
      return { id: s?.id ?? Number(id), key: s?.key ?? '', title: s?.title ?? '' }
    })

  const affected = describe(scenariosUsingNodes(tree, ids))
  const detached = describe(scenariosForkedAt(tree, ids))
  const owners = scenarios.scenarioIdsWithSteps(db, ids)

  scenarios.detachForksAt(db, ids)
  nodes.deleteNodes(db, ids)
  for (const id of owners) scenarios.renumberSteps(db, id)
  return { removed: [...ids], affected, detached }
}

export function createNodeService(ctx: DiagramContext, options: ServiceOptions = {}) {
  const { db, logger } = ctx
  const now = options.now ?? (() => new Date())
  const iso = () => now().toISOString()

  const requireProject = (id: unknown): projects.ProjectRecord => {
    const record = projects.getProject(db, intArg(id, 'projectId'))
    if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
    return record
  }

  const requireNode = (id: unknown): nodes.NodeRecord => {
    const node = nodes.getNode(db, intArg(id, 'id'))
    if (!node) throw new DiagramError('NODE_NOT_FOUND', 'Block not found')
    return node
  }

  function checkGroup(projectId: number, groupId: unknown): number | null {
    if (groupId === null || groupId === undefined) return null
    const g = groups.getGroup(db, intArg(groupId, 'groupId'))
    if (!g || g.projectId !== projectId)
      throw new DiagramError('GROUP_NOT_FOUND', 'Group not found')
    return g.id
  }

  /** Copies the fields that are present in `patch` over `base`, checking each one. */
  function apply(
    projectId: number,
    base: nodes.NodeWrite,
    patch: Record<string, unknown>
  ): nodes.NodeWrite {
    const out = { ...base }
    if ('code' in patch) out.code = text(patch['code'], 'code', LIMITS.code)
    if ('title' in patch) out.title = text(patch['title'], 'title', LIMITS.title, true)
    if ('body' in patch) out.body = freeText(patch['body'], 'body', LIMITS.body)
    if ('fixText' in patch) out.fixText = text(patch['fixText'], 'fixText', LIMITS.fix)
    if ('chips' in patch) out.chips = chipsOf(patch['chips'])
    if ('fsFile' in patch) out.fsFile = nullableText(patch['fsFile'], 'fsFile', 260)
    if ('fsSection' in patch)
      out.fsSection = nullableText(patch['fsSection'], 'fsSection', LIMITS.section)
    if ('groupId' in patch) out.groupId = checkGroup(projectId, patch['groupId'])
    if ('subtype' in patch) out.subtype = subtypeFor(out.type, patch['subtype'])
    if ('collapsed' in patch) out.collapsed = patch['collapsed'] === true
    if (out.code === '') out.code = out.key
    return out
  }

  const dataOf = (id: number): NodeData => {
    const { projectId: _projectId, ...data } = requireNode(id)
    void _projectId
    return data
  }

  return {
    create(projectId: unknown, rawInput: unknown): NodeData {
      const record = requireProject(projectId)
      const input = plainObject(rawInput, 'input') as Record<string, unknown> & Partial<NodeInput>
      const type = oneOf(input['type'], NODE_TYPES, 'type')
      const taken = new Set(nodes.nodeKeys(db, record.id))
      const nodeKey =
        input['key'] === undefined ? newId(NODE_KEY_PREFIX[type], taken) : key(input['key'], taken)

      const run = db.transaction(() => {
        const base: nodes.NodeWrite = {
          key: nodeKey,
          type,
          subtype: subtypeFor(type, undefined),
          code: nodeKey,
          title: '',
          body: '',
          fixText: '',
          chips: [],
          fsFile: null,
          fsSection: null,
          groupId: null,
          x: 0,
          y: 0,
          hasLayout: false,
          collapsed: false
        }
        const node = apply(record.id, base, input)
        if (node.title === '') throw new DiagramError('FIELD_REQUIRED', 'title is required')
        if (input['x'] !== undefined || input['y'] !== undefined) {
          node.x = finite(input['x'], 'x')
          node.y = finite(input['y'], 'y')
          node.hasLayout = input['hasLayout'] !== false
        } else {
          // BR-04: no coordinates yet, so wait on the temporary grid until a layout is run.
          const state = nodes.layoutState(db, record.id)
          const origin = { x: state.minX, y: state.placed > 0 ? state.maxY + GRID_CELL.h : 0 }
          const spot = gridPositions(state.pending + 1, origin)[state.pending]
          node.x = spot?.x ?? 0
          node.y = spot?.y ?? 0
          node.hasLayout = false
        }
        const id = nodes.insertNode(db, record.id, node, iso())
        return id
      })
      const id = run()
      logger.info('node created', { id })
      return dataOf(id)
    },

    update(id: unknown, rawPatch: unknown): NodeData {
      const node = requireNode(id)
      const patch = plainObject(rawPatch, 'patch')
      const { id: _id, projectId, ...data } = node
      void _id
      const base: nodes.NodeWrite = { ...data }
      const next = apply(projectId, base, patch)
      if (next.title === '') throw new DiagramError('FIELD_REQUIRED', 'title is required')
      nodes.updateNode(db, node.id, next, iso())
      return dataOf(node.id)
    },

    remove(rawIds: unknown): NodeRemoveResult {
      const ids = intList(rawIds, 'ids')
      const found = nodes.getNodes(db, ids)
      if (found.length !== ids.length) throw new DiagramError('NODE_NOT_FOUND', 'Block not found')
      const projectIds = new Set(found.map((n) => n.projectId))
      if (projectIds.size !== 1) {
        throw new DiagramError('INVALID_ARGUMENT', 'Blocks belong to different projects')
      }
      const projectId = found[0]?.projectId as number
      const result = db.transaction(() => removeNodes(db, projectId, ids))()
      logger.info('nodes removed', { count: ids.length, affected: result.affected.length })
      return result
    },

    /** The scenarios a removal would touch, for the confirmation box. Writes nothing. */
    impact(rawIds: unknown): AffectedScenario[] {
      const ids = intList(rawIds, 'ids')
      const found = nodes.getNodes(db, ids)
      if (found.length !== ids.length) throw new DiagramError('NODE_NOT_FOUND', 'Block not found')
      const projectId = found[0]?.projectId as number
      const all = new Map(scenarios.listScenarios(db, projectId).map((s) => [s.id, s]))
      return scenariosUsingNodes(scenarioNodes(db, projectId), ids).map((sid) => {
        const s = all.get(sid as number)
        return { id: s?.id ?? Number(sid), key: s?.key ?? '', title: s?.title ?? '' }
      })
    },

    /** One call after a drag ends. Every moved block now has real coordinates. */
    move(rawBatch: unknown): null {
      if (!Array.isArray(rawBatch))
        throw new DiagramError('INVALID_ARGUMENT', 'batch must be a list')
      const batch = rawBatch.map((b) => {
        const o = plainObject(b, 'move') as unknown as NodeMove
        return { id: intArg(o.id, 'id'), x: finite(o.x, 'x'), y: finite(o.y, 'y') }
      })
      db.transaction(() => {
        for (const m of batch) {
          requireNode(m.id)
          nodes.setPosition(db, m.id, m.x, m.y)
        }
      })()
      return null
    },

    setGroup(rawIds: unknown, groupId: unknown): null {
      const ids = intList(rawIds, 'ids')
      db.transaction(() => {
        for (const id of ids) {
          const node = requireNode(id)
          nodes.setGroupOf(db, id, checkGroup(node.projectId, groupId))
        }
      })()
      return null
    }
  }
}

export type NodeService = ReturnType<typeof createNodeService>
