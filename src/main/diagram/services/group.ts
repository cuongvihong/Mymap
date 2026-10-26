import { newId } from '../../../shared/diagram/ids'
import {
  LIMITS,
  type GroupData,
  type GroupFrame,
  type NodeRemoveResult
} from '../../../shared/diagram/types'
import type { DiagramContext } from '../context'
import { DiagramError } from '../errors'
import * as groups from '../repo/groups'
import * as nodes from '../repo/nodes'
import * as projects from '../repo/projects'
import { finite, intArg, key, nullableText, plainObject, text } from './fields'
import { removeNodes, type ServiceOptions } from './node'

function frameOf(raw: unknown): GroupFrame | null {
  if (raw === null || raw === undefined) return null
  const o = plainObject(raw, 'frame')
  const w = finite(o['w'], 'frame.w')
  const h = finite(o['h'], 'frame.h')
  if (w <= 0 || h <= 0) throw new DiagramError('INVALID_ARGUMENT', 'frame must have a size')
  return { x: finite(o['x'], 'frame.x'), y: finite(o['y'], 'frame.y'), w, h }
}

export function createGroupService(ctx: DiagramContext, _options: ServiceOptions = {}) {
  const { db, logger } = ctx

  const requireGroup = (id: unknown): groups.GroupRecord => {
    const g = groups.getGroup(db, intArg(id, 'id'))
    if (!g) throw new DiagramError('GROUP_NOT_FOUND', 'Group not found')
    return g
  }

  const plain = (g: groups.GroupRecord): GroupData => {
    const { projectId: _p, ...data } = g
    void _p
    return data
  }

  return {
    create(projectId: unknown, rawInput: unknown): GroupData {
      const record = projects.getProject(db, intArg(projectId, 'projectId'))
      if (!record) throw new DiagramError('PROJECT_NOT_FOUND', 'Project not found')
      const input = plainObject(rawInput, 'input')
      const taken = new Set(groups.groupKeys(db, record.id))
      const groupKey = input['key'] === undefined ? newId('G', taken) : key(input['key'], taken)
      const title = text(input['title'], 'title', LIMITS.title, true)
      const fsFile = nullableText(input['fsFile'], 'fsFile', 260)
      const id = groups.insertGroup(db, {
        projectId: record.id,
        key: groupKey,
        title,
        fsFile,
        sortOrder: groups.nextSortOrder(db, record.id),
        frame: frameOf(input['frame'])
      })
      logger.info('group created', { id })
      return plain(requireGroup(id))
    },

    update(id: unknown, rawPatch: unknown): GroupData {
      const g = requireGroup(id)
      const patch = plainObject(rawPatch, 'patch')
      const next = {
        title: 'title' in patch ? text(patch['title'], 'title', LIMITS.title, true) : g.title,
        fsFile: 'fsFile' in patch ? nullableText(patch['fsFile'], 'fsFile', 260) : g.fsFile,
        collapsed: 'collapsed' in patch ? patch['collapsed'] === true : g.collapsed,
        sortOrder: 'sortOrder' in patch ? finite(patch['sortOrder'], 'sortOrder') : g.sortOrder,
        frame: 'frame' in patch ? frameOf(patch['frame']) : g.frame
      }
      groups.updateGroup(db, g.id, next)
      return plain(requireGroup(g.id))
    },

    /** keepNodes: the members stay and leave the group. Otherwise they are deleted with it. */
    remove(id: unknown, keepNodes: unknown): NodeRemoveResult {
      const g = requireGroup(id)
      return db.transaction(() => {
        let result: NodeRemoveResult = { removed: [], affected: [], detached: [] }
        if (keepNodes !== true) {
          const members = nodes.idsInGroup(db, g.id)
          if (members.length > 0) result = removeNodes(db, g.projectId, members)
        }
        groups.deleteGroup(db, g.id)
        logger.info('group removed', { id: g.id, nodes: result.removed.length })
        return result
      })()
    }
  }
}

export type GroupService = ReturnType<typeof createGroupService>
